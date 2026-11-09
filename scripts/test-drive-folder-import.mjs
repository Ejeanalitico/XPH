import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Ejecuta el código real de Apps Script en Node con dobles de Drive y Sheets.
// El objetivo es detectar una regresión del límite 1,000 y la cuota de 50k/celda.
const source = readFileSync(new URL('../google-apps-script.js', import.meta.url), 'utf8');
const properties = {};
const props = {
  getProperty: (key) => properties[key] || '',
  getProperties: () => ({ ...properties }),
  deleteProperty: (key) => { delete properties[key]; },
  setProperties: (values) => Object.assign(properties, values),
};

class MemorySheet {
  constructor() {
    this.rows = [
      ['Clave', 'Valor_JSON', 'Ultima_Actualizacion'],
      ['database_json_payload', JSON.stringify({ old: true }), '2026-01-01'],
    ];
    this.maxRows = 1000;
    this.failNextWrite = false;
  }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(_at, number) { this.maxRows += number; }
  deleteRows(start, count) { this.rows.splice(start - 1, count); }
  getRange(row, column, height = 1, width = 1) {
    return {
      getValues: () => Array.from({ length: height }, (_, i) =>
        Array.from({ length: width }, (_, j) => this.rows[row - 1 + i]?.[column - 1 + j] ?? '')),
      setValues: (rows) => {
        if (this.failNextWrite) {
          this.failNextWrite = false;
          throw new Error('Fallo simulado de Sheets');
        }
        for (let i = 0; i < rows.length; i++) {
          const target = row - 1 + i;
          if (!this.rows[target]) this.rows[target] = [];
          for (let j = 0; j < rows[i].length; j++) {
            const value = String(rows[i][j] ?? '');
            assert.ok(value.length <= 50000, 'Una celda superó el máximo de 50k');
            this.rows[target][column - 1 + j] = value;
          }
        }
      },
    };
  }
}

const sheet = new MemorySheet();
const db = {
  getSheetByName: () => sheet,
  getId: () => 'spreadsheet-test',
  getUrl: () => 'https://example.invalid/sheet',
};
let driveFiles = [];
const makeIterator = (start) => {
  let position = start;
  return {
    hasNext: () => position < driveFiles.length,
    next: () => driveFiles[position++],
    getContinuationToken: () => String(position),
  };
};
const context = {
  PropertiesService: { getScriptProperties: () => props },
  Logger: { log: () => undefined },
  Utilities: {
    Charset: { UTF_8: 'UTF-8' },
    getUuid: () => '12345678-1234-1234-1234-123456789012',
    base64EncodeWebSafe: (str) => Buffer.from(str, 'utf8').toString('base64url'),
    base64DecodeWebSafe: (str) => Buffer.from(str, 'base64url'),
    newBlob: (data) => ({ getDataAsString: () => Buffer.from(data).toString('utf8') }),
  },
  DriveApp: {
    Access: { ANYONE_WITH_LINK: 'anyone' },
    Permission: { VIEW: 'reader' },
    getFolderById: () => ({ getFiles: () => makeIterator(0) }),
    continueFileIterator: (token) => makeIterator(Number(token)),
  },
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'google-apps-script.js' });
context.getDatabaseSpreadsheet = () => db;
context.ensureBusinessSchema = () => {};

// Lectura de una configuración legacy, migración a múltiples celdas y rollback
// en caso de escritura incompleta.
assert.equal(context.loadActiveConfig(), JSON.stringify({ old: true }));
const bigConfig = JSON.stringify({
  galleryImages: Array.from({ length: 4000 }, (_, i) => ({
    id: 'file-' + i, galleryId: 'Speed Fest', title: 'Fotografía número ' + i,
  })),
  unicode: 'XV años: sesión en México ' + 'áéíóú'.repeat(1000),
});
assert.ok(bigConfig.length > 50000);
context.saveActiveConfig(db, bigConfig);
assert.equal(context.loadActiveConfig(), bigConfig);
assert.ok(sheet.rows.length > 3, 'No se generaron fragmentos en Sheets');
sheet.rows.push(['config_chunk_b64:unfinished:1/1', 'interrupted', '']);
assert.equal(context.loadActiveConfig(), bigConfig, 'La versión incompleta sustituyó a la válida');
sheet.failNextWrite = true;
assert.throws(() => context.saveActiveConfig(db, JSON.stringify({ corrupted: true })));
assert.equal(context.loadActiveConfig(), bigConfig, 'Se perdió la configuración tras un fallo');

// 1,417 fotografías + archivos no compatibles. Todos deben recuperarse
// mediante pageToken sin truncar, duplicar o generar páginas vacías.
driveFiles = Array.from({ length: 1417 }, (_, i) => ({
  getId: () => 'file-' + String(i).padStart(5, '0'),
  getName: () => 'DSC_' + i + '.jpg',
  getMimeType: () => 'image/jpeg',
  setSharing: () => undefined,
}));
driveFiles.push(...Array.from({ length: 17 }, (_, i) => ({
  getId: () => 'document-' + i,
  getName: () => 'other-' + i + '.pdf',
  getMimeType: () => 'application/pdf',
  setSharing: () => undefined,
})));
let cursor = '';
const returned = new Set();
let pages = 0;
let scanned = 0;
do {
  const page = context.handleBusinessAction(db, 'driveFolderImport', {
    folderId: 'folder-test', pageToken: cursor, pageSize: 100,
  });
  pages++;
  scanned += page.scanned;
  assert.ok(page.scanned <= 100);
  for (const file of page.files) {
    assert.ok(!returned.has(file.id), 'Drive duplicó un archivo en la paginación');
    returned.add(file.id);
  }
  cursor = page.nextPageToken;
  assert.ok(pages < 25, 'Iteración infinita');
} while (cursor);
assert.equal(returned.size, 1417);
assert.equal(scanned, 1434);
assert.equal(pages, 15);
console.log('OK: 1,417 imágenes en 15 páginas, sin duplicados, y configuración grande recuperable.');