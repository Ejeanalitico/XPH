/**
 * =========================================================================
 * GOOGLE APPS SCRIPT — XPH GOOGLE SHEETS DATABASE & AUDIT LOG ENGINE
 * =========================================================================
 * Nombre de la Hoja de Cálculo: XPH_DATABASE_PRODUCCION
 * Configuración requerida en Propiedades del script:
 * XPH_SPREADSHEET_ID, XPH_FOLDER_ID y XPH_API_SECRET.
 * =========================================================================
 */

var XPH_PROPERTIES = PropertiesService.getScriptProperties();
var SPREADSHEET_ID = XPH_PROPERTIES.getProperty('XPH_SPREADSHEET_ID') || '';
var FOLDER_ID = XPH_PROPERTIES.getProperty('XPH_FOLDER_ID') || '';
var SPREADSHEET_NAME = "XPH_DATABASE_PRODUCCION";

function jsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function isAuthorizedApiSecret(candidate) {
  var expected = XPH_PROPERTIES.getProperty('XPH_API_SECRET') || '';
  return Boolean(expected && candidate && String(candidate) === String(expected));
}

function unauthorizedOutput() {
  return jsonOutput({ status: 'error', message: 'Solicitud no autorizada.' });
}

/**
 * Función de inicialización y migración manual.
 * Ejecuta esta función una vez en el editor de Apps Script para autorizar y migrar todas las tablas.
 */
function initDatabase() {
  var ss = getDatabaseSpreadsheet();
  if (ss) {
    initSpreadsheetSheets(ss);
    
    // Migrar y sincronizar estado inicial
    var raw = loadActiveConfig();
    if (raw) {
      try {
        var cfg = JSON.parse(raw);
        if (cfg.packages) syncPackagesTable(ss, cfg.packages);
        if (cfg.galleryImages) syncGalleryTable(ss, cfg.galleryImages);
        if (cfg.quotes) syncQuotesTable(ss, cfg.quotes);
      } catch (_) {}
    }
    
    logAudit(ss, 'INICIALIZACION_SISTEMA', 'Base de datos inicializada y migrada a 10 columnas en Paquetes_Precios', '-', 'Admin XPH');
    Logger.log('Base de datos configurada y vinculada: ' + ss.getUrl());
    return ss.getUrl();
  }
}

/**
 * Obtiene la hoja de cálculo exacta por su SPREADSHEET_ID físico
 */
function getDatabaseSpreadsheet() {
  try {
    if (SPREADSHEET_ID) {
      try {
        var ssById = SpreadsheetApp.openById(SPREADSHEET_ID);
        if (ssById) {
          initSpreadsheetSheets(ssById);
          return ssById;
        }
      } catch (eId) {
        Logger.log('Spreadsheet openById notice: ' + eId);
      }
    }

    var legacySpreadsheetUrl = XPH_PROPERTIES.getProperty('xph_spreadsheet_url') || '';
    var legacySpreadsheetMatch = legacySpreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (legacySpreadsheetMatch && legacySpreadsheetMatch[1]) {
      try {
        var ssByLegacyUrl = SpreadsheetApp.openById(legacySpreadsheetMatch[1]);
        if (ssByLegacyUrl) {
          initSpreadsheetSheets(ssByLegacyUrl);
          return ssByLegacyUrl;
        }
      } catch (eLegacy) {
        Logger.log('Spreadsheet legacy URL notice: ' + eLegacy);
      }
    }

    var folder;
    try {
      folder = DriveApp.getFolderById(FOLDER_ID);
    } catch (_) {
      folder = DriveApp.getRootFolder();
    }

    var files = folder.getFilesByName(SPREADSHEET_NAME);
    var ss = null;

    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create(SPREADSHEET_NAME);
      var file = DriveApp.getFileById(ss.getId());
      folder.addFile(file);
      try { DriveApp.getRootFolder().removeFile(file); } catch (_) {}
      // La base de datos permanece privada. La web accede únicamente mediante el proxy autenticado.
    }

    if (ss) {
      initSpreadsheetSheets(ss);
    }
    return ss;
  } catch (e) {
    Logger.log('Spreadsheet error: ' + e);
    return null;
  }
}

/**
 * Inicializa y da formato a las 5 pestañas de la base de datos
 */
function initSpreadsheetSheets(ss) {
  if (!ss) return;
  try {
    var sheetsMap = {
      'Config_Activa': ['Clave', 'Valor_JSON', 'Ultima_Actualizacion'],
      'Historial_Auditoria': ['Fecha_Hora', 'Accion', 'Detalles_Cambio', 'ID_Elemento', 'Usuario', 'Estado'],
      'Galeria_Fotos': ['ID_Foto', 'Titulo', 'Categoria', 'URL_Google_Drive', 'Ubicacion', 'Fecha_Carga', 'Estado'],
      'Cotizaciones_Citas': ['ID_Cotizacion', 'Fecha_Registro', 'Cliente', 'Email', 'WhatsApp', 'Evento', 'Paquete', 'Total_MXN', 'Pago_Inicial_MXN', 'Saldo_Pendiente_MXN', 'Fecha_Evento', 'Ciudad', 'Estado_Cotizacion', 'Notas'],
      'Paquetes_Precios': ['Categoria', 'ID_Paquete', 'Nombre_Paquete', 'Precio_Base_MXN', 'Precio_Final_Por_Confirmar', 'Insignia_Badge', 'Descripcion', 'Que_Incluye', 'No_Incluye', 'Ultima_Modificacion'],
      'CRM_Clientes': ['id', 'recordType', 'name', 'phone', 'email', 'eventType', 'eventDate', 'eventLocation', 'packageName', 'totalAmount', 'paidAmount', 'status', 'source', 'firstContactAt', 'lastContactAt', 'nextAction', 'nextActionAt', 'notes', 'contractId', 'createdAt', 'updatedAt', 'honoreeName', 'address', 'eventTime', 'serviceHours', 'campaign', 'objection', 'followUpAttempts', 'suggestedMessage', 'lossReason', 'estimatedCost', 'allocatedAdCost'],
      'Gastos': ['id', 'date', 'category', 'subcategory', 'concept', 'supplier', 'paymentMethod', 'paymentStatus', 'amount', 'notes', 'createdAt', 'updatedAt', 'relatedClientId', 'receiptReference', 'account'],
      'Contratos': ['id', 'clientId', 'clientName', 'folio', 'eventType', 'eventDate', 'status', 'originalFileName', 'originalFileId', 'clientSignedFileId', 'finalFileId', 'signatureFileId', 'tokenHash', 'tokenExpiresAt', 'tokenStatus', 'sentAt', 'viewedAt', 'acceptedAt', 'clientSignedAt', 'ownerAuthorizedAt', 'documentHash', 'signedDocumentHash', 'finalDocumentHash', 'signerIp', 'signerUserAgent', 'consentText', 'createdAt', 'updatedAt'],
      'Firma_Administrador': ['id', 'fileId', 'updatedAt']
    };

    for (var sheetName in sheetsMap) {
      var sheet = ss.getSheetByName(sheetName);
      var headers = sheetsMap[sheetName];

      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }

      // Siempre forzar encabezados estructurados actualizados en la Fila 1
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#161C28')
        .setFontColor('#D4AF37')
        .setFontWeight('bold')
        .setFontFamily('Arial');
      sheet.setFrozenRows(1);
    }

    var defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) {
      try { ss.deleteSheet(defaultSheet); } catch (_) {}
    }
  } catch (e) {
    Logger.log('Error init sheets: ' + e);
  }
}

/**
 * Registra una acción en la tabla Historial_Auditoria
 */
function logAudit(ss, action, details, elementId, user) {
  if (!ss) return;
  try {
    var sheet = ss.getSheetByName('Historial_Auditoria');
    if (sheet) {
      sheet.appendRow([
        new Date().toISOString(),
        action || 'MODIFICACION_GENERAL',
        typeof details === 'object' ? JSON.stringify(details) : (details || 'Cambio guardado'),
        elementId || '-',
        user || 'Admin XPH',
        'APLICADO_EXITOSO'
      ]);
    }
  } catch (e) {
    Logger.log('Error audit log: ' + e);
  }
}

/**
 * Sincroniza físicamente la tabla Galeria_Fotos en Google Sheets
 */
function syncGalleryTable(ss, galleryImages) {
  if (!ss) return;
  try {
    var sheet = ss.getSheetByName('Galeria_Fotos');
    if (!sheet) {
      sheet = ss.insertSheet('Galeria_Fotos');
    }

    var headers = ['ID_Foto', 'Titulo', 'Categoria', 'URL_Google_Drive', 'Ubicacion', 'Fecha_Carga', 'Estado'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#161C28')
      .setFontColor('#D4AF37')
      .setFontWeight('bold')
      .setFontFamily('Arial');
    sheet.setFrozenRows(1);

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, headers.length)).clearContent();
    }

    if (Array.isArray(galleryImages) && galleryImages.length > 0) {
      var rows = [];
      var now = new Date().toISOString().split('T')[0];

      galleryImages.forEach(function(img) {
        if (!img || !img.url || img.url.startsWith('data:image/')) return;
        rows.push([
          img.id || ('img-' + Date.now()),
          img.title || 'Fotografía de Galería',
          (img.category || 'bodas').toLowerCase(),
          img.url || '',
          img.location || 'Polanco, CDMX',
          now,
          'ACTIVO'
        ]);
      });

      if (rows.length > 0) {
        var range = sheet.getRange(2, 1, rows.length, 7);
        range.setValues(rows);
        range.setVerticalAlignment('top');
      }
    }
  } catch (e) {
    Logger.log('Error sync gallery: ' + e);
  }
}

/**
 * Sincroniza físicamente la tabla Paquetes_Precios en Google Sheets con las 10 columnas exactas:
 * Categoria | ID_Paquete | Nombre_Paquete | Precio_Base_MXN | Precio_Final_Por_Confirmar | Insignia_Badge | Descripcion | Que_Incluye (en una sola columna multilínea) | No_Incluye | Ultima_Modificacion
 */
function syncPackagesTable(ss, packages) {
  if (!ss) return;
  try {
    var sheet = ss.getSheetByName('Paquetes_Precios');
    if (!sheet) {
      sheet = ss.insertSheet('Paquetes_Precios');
    }

    var headers = ['Categoria', 'ID_Paquete', 'Nombre_Paquete', 'Precio_Base_MXN', 'Precio_Final_Por_Confirmar', 'Insignia_Badge', 'Descripcion', 'Que_Incluye', 'No_Incluye', 'Ultima_Modificacion'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#161C28')
      .setFontColor('#D4AF37')
      .setFontWeight('bold')
      .setFontFamily('Arial');
    sheet.setFrozenRows(1);

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, headers.length)).clearContent();
    }

    if (packages && typeof packages === 'object') {
      var rows = [];
      var now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      var categoryDisplayNames = {
        'bodas': 'BODAS DESTINATION & CDMX',
        'xv-anos': 'QUINCEAÑERAS (XV AÑOS)',
        'bautizos': 'BAUTIZOS & EVENTOS FAMILIARES',
        'retratos': 'RETRATOS & EDITORIAL',
        'empresarial': 'EMPRESARIAL & BRANDING'
      };

      for (var cat in packages) {
        var list = packages[cat];
        if (Array.isArray(list)) {
          var catLabel = categoryDisplayNames[cat] || cat.toUpperCase();
          list.forEach(function(pkg) {
            var rawFeats = pkg.features || pkg.includes || [];
            var rawNotIncludes = pkg.notIncludes || [];

            // Todos los 'Que_Incluye' van en UNA SOLA COLUMNA formateados con viñetas
            var includesFormatted = Array.isArray(rawFeats)
              ? rawFeats.map(function(f) { return '• ' + f; }).join('\n')
              : (rawFeats ? '• ' + rawFeats : '');

            var notIncludesFormatted = Array.isArray(rawNotIncludes)
              ? rawNotIncludes.map(function(f) { return '✕ ' + f; }).join('\n')
              : '';

            var priceNum = Number(pkg.price) || 0;
            rows.push([
              catLabel,
              pkg.id || '',
              pkg.name || '',
              priceNum,
              'Sí',
              pkg.badge || '',
              pkg.description || '',
              includesFormatted,
              notIncludesFormatted,
              now
            ]);
          });
        }
      }

      if (rows.length > 0) {
        var range = sheet.getRange(2, 1, rows.length, 10);
        range.setValues(rows);
        range.setWrap(true);
        range.setVerticalAlignment('top');
      }
    }
  } catch (e) {
    Logger.log('Error sync packages: ' + e);
  }
}

/**
 * Sincroniza la tabla Cotizaciones_Citas en Google Sheets
 */
function syncQuotesTable(ss, quotes) {
  if (!ss) return;
  try {
    var sheet = ss.getSheetByName('Cotizaciones_Citas');
    if (!sheet) {
      sheet = ss.insertSheet('Cotizaciones_Citas');
    }

    var headers = ['ID_Cotizacion', 'Fecha_Registro', 'Cliente', 'Email', 'WhatsApp', 'Evento', 'Paquete', 'Total_MXN', 'Pago_Inicial_MXN', 'Saldo_Pendiente_MXN', 'Fecha_Evento', 'Ciudad', 'Estado_Cotizacion', 'Notas'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#161C28')
      .setFontColor('#D4AF37')
      .setFontWeight('bold')
      .setFontFamily('Arial');
    sheet.setFrozenRows(1);

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, headers.length)).clearContent();
    }

    if (Array.isArray(quotes) && quotes.length > 0) {
      var rows = [];
      quotes.forEach(function(q) {
        var totalNum = Number(q.total) || 0;
        var hasPayment = q.depositAmount !== undefined && q.depositAmount !== null && q.depositAmount !== '';
        var depNum = hasPayment ? Math.max(0, Number(q.depositAmount) || 0) : '';
        rows.push([
          q.id || '',
          q.createdAt || new Date().toISOString().split('T')[0],
          q.clientName || '',
          q.clientEmail || '',
          q.clientPhone || '',
          q.eventType || '',
          q.packageName || '',
          totalNum,
          depNum,
          hasPayment ? Math.max(0, totalNum - depNum) : '',
          q.eventDate || '',
          q.eventCity || 'CDMX',
          q.status || 'Pendiente',
          q.notes || ''
        ]);
      });
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 14).setValues(rows);
      }
    }
  } catch (e) {
    Logger.log('Error sync quotes: ' + e);
  }
}

/**
 * Guarda la última versión activa en la pestaña Config_Activa y en Properties
 */
function saveActiveConfig(ss, configJsonString) {
  if (ss) {
    try {
      var sheet = ss.getSheetByName('Config_Activa');
      if (sheet) {
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.deleteRows(2, lastRow - 1);
        }
        sheet.appendRow(['database_json_payload', configJsonString, new Date().toISOString()]);
      }
    } catch (e) {
      Logger.log('Error save active config: ' + e);
    }
  }

  var props = PropertiesService.getScriptProperties();
  var CHUNK_SIZE = 8000;
  var totalChunks = Math.ceil(configJsonString.length / CHUNK_SIZE);
  var previousTotalChunks = parseInt(props.getProperty('xph_total_chunks') || '0', 10);
  
  var newProps = {
    'xph_total_chunks': totalChunks.toString(),
    'xph_updated_at': new Date().toISOString()
  };

  if (ss) {
    try {
      newProps['xph_spreadsheet_id'] = ss.getId();
      newProps['xph_spreadsheet_url'] = ss.getUrl();
    } catch (_) {}
  }
  
  for (var i = 0; i < totalChunks; i++) {
    newProps['chunk_' + i] = configJsonString.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  }
  
  // Conserva las propiedades privadas del proyecto (XPH_API_SECRET,
  // XPH_SPREADSHEET_ID y XPH_FOLDER_ID). El segundo argumento en `true`
  // borraba todas las claves que no pertenecían a la configuración activa y
  // dejaba al proxy de Vercel sin autorización después de cada guardado.
  props.setProperties(newProps, false);

  // Si la configuración nueva ocupa menos fragmentos, elimina únicamente los
  // fragmentos sobrantes de la versión anterior.
  for (var staleChunk = totalChunks; staleChunk < previousTotalChunks; staleChunk++) {
    props.deleteProperty('chunk_' + staleChunk);
  }
}

/**
 * Lee la última versión activa de la base de datos
 */
function loadActiveConfig() {
  var props = PropertiesService.getScriptProperties();
  var totalChunksStr = props.getProperty('xph_total_chunks');
  
  if (totalChunksStr) {
    var totalChunks = parseInt(totalChunksStr, 10);
    var fullString = '';
    for (var i = 0; i < totalChunks; i++) {
      fullString += (props.getProperty('chunk_' + i) || '');
    }
    if (fullString) return fullString;
  }

  try {
    var ss = getDatabaseSpreadsheet();
    if (ss) {
      var sheet = ss.getSheetByName('Config_Activa');
      if (sheet && sheet.getLastRow() >= 2) {
        return sheet.getRange(2, 2).getValue() || '';
      }
    }
  } catch (_) {}

  return '';
}

var BUSINESS_HEADERS = {
  clients: ['id', 'recordType', 'name', 'phone', 'email', 'eventType', 'eventDate', 'eventLocation', 'packageName', 'totalAmount', 'paidAmount', 'status', 'source', 'firstContactAt', 'lastContactAt', 'nextAction', 'nextActionAt', 'notes', 'contractId', 'createdAt', 'updatedAt', 'honoreeName', 'address', 'eventTime', 'serviceHours', 'campaign', 'objection', 'followUpAttempts', 'suggestedMessage', 'lossReason', 'estimatedCost', 'allocatedAdCost'],
  expenses: ['id', 'date', 'category', 'subcategory', 'concept', 'supplier', 'paymentMethod', 'paymentStatus', 'amount', 'notes', 'createdAt', 'updatedAt', 'relatedClientId', 'receiptReference', 'account'],
  contracts: ['id', 'clientId', 'clientName', 'folio', 'eventType', 'eventDate', 'status', 'originalFileName', 'originalFileId', 'clientSignedFileId', 'finalFileId', 'signatureFileId', 'tokenHash', 'tokenExpiresAt', 'tokenStatus', 'sentAt', 'viewedAt', 'acceptedAt', 'clientSignedAt', 'ownerAuthorizedAt', 'documentHash', 'signedDocumentHash', 'finalDocumentHash', 'signerIp', 'signerUserAgent', 'consentText', 'createdAt', 'updatedAt'],
  ownerSignature: ['id', 'fileId', 'updatedAt']
};

function businessNow() {
  return new Date().toISOString();
}

function businessId(prefix) {
  return String(prefix || 'xph') + '-' + Utilities.getUuid();
}

function cleanBusinessText(value, maxLength) {
  return String(value === undefined || value === null ? '' : value).trim().substring(0, maxLength || 2000);
}

function readBusinessRecords(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.filter(function(row) { return cleanBusinessText(row[0], 200) !== ''; }).map(function(row) {
    var record = {};
    headers.forEach(function(header, index) { record[header] = row[index] === undefined || row[index] === null ? '' : row[index]; });
    return record;
  });
}

function upsertBusinessRecord(ss, sheetName, headers, record) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initSpreadsheetSheets(ss);
    sheet = ss.getSheetByName(sheetName);
  }
  var rowNumber = -1;
  if (sheet.getLastRow() >= 2) {
    var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(record.id)) { rowNumber = i + 2; break; }
    }
  }
  var row = headers.map(function(header) {
    var value = record[header];
    return value === undefined || value === null ? '' : value;
  });
  if (rowNumber > 0) sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);
  return record;
}

function findBusinessRecord(ss, sheetName, headers, id) {
  var records = readBusinessRecords(ss, sheetName, headers);
  for (var i = 0; i < records.length; i++) if (String(records[i].id) === String(id)) return records[i];
  return null;
}

function getContractsFolder() {
  var parent;
  try { parent = DriveApp.getFolderById(FOLDER_ID); } catch (_) { parent = DriveApp.getRootFolder(); }
  var folders = parent.getFoldersByName('Contratos_XPH');
  return folders.hasNext() ? folders.next() : parent.createFolder('Contratos_XPH');
}

function base64Blob(dataUrl, mimeType, filename) {
  var value = cleanBusinessText(dataUrl, 20000000);
  if (value.indexOf(',') > -1) value = value.split(',').pop();
  return Utilities.newBlob(Utilities.base64Decode(value.replace(/\s/g, '')), mimeType, filename);
}

function fileBase64(fileId) {
  var blob = DriveApp.getFileById(fileId).getBlob();
  return Utilities.base64Encode(blob.getBytes());
}

function tokenHashFromRaw(token) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token || ''), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
}

function publicContractRecord(record) {
  return {
    id: record.id || '',
    clientId: record.clientId || '',
    clientName: record.clientName || '',
    folio: record.folio || '',
    eventType: record.eventType || '',
    eventDate: record.eventDate || '',
    status: record.status || 'Borrador',
    originalFileName: record.originalFileName || '',
    expiresAt: record.tokenExpiresAt || '',
    sentAt: record.sentAt || '',
    viewedAt: record.viewedAt || '',
    acceptedAt: record.acceptedAt || '',
    clientSignedAt: record.clientSignedAt || '',
    ownerAuthorizedAt: record.ownerAuthorizedAt || '',
    documentHash: record.documentHash || '',
    finalDocumentHash: record.finalDocumentHash || '',
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || ''
  };
}

function resolveSigningContract(ss, token) {
  var hash = tokenHashFromRaw(token);
  var contracts = readBusinessRecords(ss, 'Contratos', BUSINESS_HEADERS.contracts);
  for (var i = 0; i < contracts.length; i++) {
    var contract = contracts[i];
    if (String(contract.tokenHash || '') !== hash) continue;
    if (String(contract.tokenStatus || '') !== 'ACTIVO') throw new Error('La liga ya no está activa.');
    if (!contract.tokenExpiresAt || new Date(contract.tokenExpiresAt).getTime() <= Date.now()) throw new Error('La liga de firma ha caducado.');
    if (['Firmado por cliente', 'Finalizado', 'Cancelado'].indexOf(String(contract.status || '')) >= 0) throw new Error('El contrato ya no admite esta firma.');
    return contract;
  }
  throw new Error('Liga de firma inválida.');
}

function normalizedClient(input, existing) {
  var current = existing || {};
  var timestamp = businessNow();
  return {
    id: cleanBusinessText(input.id || current.id || businessId('crm'), 120),
    recordType: cleanBusinessText(input.recordType || current.recordType || 'Prospecto', 40),
    name: cleanBusinessText(input.name !== undefined ? input.name : current.name, 160),
    phone: cleanBusinessText(input.phone !== undefined ? input.phone : current.phone, 40),
    email: cleanBusinessText(input.email !== undefined ? input.email : current.email, 180),
    eventType: cleanBusinessText(input.eventType !== undefined ? input.eventType : current.eventType, 100),
    eventDate: cleanBusinessText(input.eventDate !== undefined ? input.eventDate : current.eventDate, 40),
    eventLocation: cleanBusinessText(input.eventLocation !== undefined ? input.eventLocation : current.eventLocation, 500),
    packageName: cleanBusinessText(input.packageName !== undefined ? input.packageName : current.packageName, 180),
    totalAmount: Math.max(0, Number(input.totalAmount !== undefined ? input.totalAmount : current.totalAmount) || 0),
    paidAmount: Math.max(0, Number(input.paidAmount !== undefined ? input.paidAmount : current.paidAmount) || 0),
    status: cleanBusinessText(input.status || current.status || 'Nuevo', 60),
    source: cleanBusinessText(input.source !== undefined ? input.source : current.source, 180),
    firstContactAt: cleanBusinessText(input.firstContactAt !== undefined ? input.firstContactAt : current.firstContactAt, 40),
    lastContactAt: cleanBusinessText(input.lastContactAt !== undefined ? input.lastContactAt : current.lastContactAt, 40),
    nextAction: cleanBusinessText(input.nextAction !== undefined ? input.nextAction : current.nextAction, 300),
    nextActionAt: cleanBusinessText(input.nextActionAt !== undefined ? input.nextActionAt : current.nextActionAt, 50),
    notes: cleanBusinessText(input.notes !== undefined ? input.notes : current.notes, 4000),
    contractId: cleanBusinessText(input.contractId !== undefined ? input.contractId : current.contractId, 120),
    createdAt: cleanBusinessText(current.createdAt || input.createdAt || timestamp, 40),
    updatedAt: timestamp,
    honoreeName: cleanBusinessText(input.honoreeName !== undefined ? input.honoreeName : current.honoreeName, 240),
    address: cleanBusinessText(input.address !== undefined ? input.address : current.address, 600),
    eventTime: cleanBusinessText(input.eventTime !== undefined ? input.eventTime : current.eventTime, 20),
    serviceHours: Math.max(0, Math.min(48, Number(input.serviceHours !== undefined ? input.serviceHours : current.serviceHours) || 0)),
    campaign: cleanBusinessText(input.campaign !== undefined ? input.campaign : current.campaign, 200),
    objection: cleanBusinessText(input.objection !== undefined ? input.objection : current.objection, 1000),
    followUpAttempts: Math.max(0, Math.min(100, Math.floor(Number(input.followUpAttempts !== undefined ? input.followUpAttempts : current.followUpAttempts) || 0))),
    suggestedMessage: cleanBusinessText(input.suggestedMessage !== undefined ? input.suggestedMessage : current.suggestedMessage, 4000),
    lossReason: cleanBusinessText(input.lossReason !== undefined ? input.lossReason : current.lossReason, 1000),
    estimatedCost: Math.max(0, Number(input.estimatedCost !== undefined ? input.estimatedCost : current.estimatedCost) || 0),
    allocatedAdCost: Math.max(0, Number(input.allocatedAdCost !== undefined ? input.allocatedAdCost : current.allocatedAdCost) || 0)
  };
}

function normalizedExpense(input, existing) {
  var current = existing || {};
  var timestamp = businessNow();
  return {
    id: cleanBusinessText(input.id || current.id || businessId('gasto'), 120),
    date: cleanBusinessText(input.date || current.date || timestamp.substring(0, 10), 40),
    category: cleanBusinessText(input.category || current.category || 'Equipo y fotografía', 100),
    subcategory: cleanBusinessText(input.subcategory !== undefined ? input.subcategory : current.subcategory, 180),
    concept: cleanBusinessText(input.concept !== undefined ? input.concept : current.concept, 300),
    supplier: cleanBusinessText(input.supplier !== undefined ? input.supplier : current.supplier, 200),
    paymentMethod: cleanBusinessText(input.paymentMethod !== undefined ? input.paymentMethod : current.paymentMethod, 100),
    paymentStatus: cleanBusinessText(input.paymentStatus || current.paymentStatus || 'Pagado', 40),
    amount: Math.max(0, Number(input.amount !== undefined ? input.amount : current.amount) || 0),
    notes: cleanBusinessText(input.notes !== undefined ? input.notes : current.notes, 3000),
    createdAt: cleanBusinessText(current.createdAt || input.createdAt || timestamp, 40),
    updatedAt: timestamp,
    relatedClientId: cleanBusinessText(input.relatedClientId !== undefined ? input.relatedClientId : current.relatedClientId, 120),
    receiptReference: cleanBusinessText(input.receiptReference !== undefined ? input.receiptReference : current.receiptReference, 200),
    account: cleanBusinessText(input.account || current.account || 'Banco', 40)
  };
}

function handleBusinessAction(ss, action, payload) {
  payload = payload || {};
  if (action === 'businessSnapshot') {
    var signatureRows = readBusinessRecords(ss, 'Firma_Administrador', BUSINESS_HEADERS.ownerSignature);
    return {
      status: 'success',
      snapshot: {
        clients: readBusinessRecords(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients),
        expenses: readBusinessRecords(ss, 'Gastos', BUSINESS_HEADERS.expenses),
        contracts: readBusinessRecords(ss, 'Contratos', BUSINESS_HEADERS.contracts).map(publicContractRecord),
        ownerSignatureConfigured: Boolean(signatureRows.length && signatureRows[0].fileId)
      }
    };
  }

  if (action === 'crmUpsert') {
    var clientInput = payload.client || {};
    var existingClient = clientInput.id ? findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, clientInput.id) : null;
    var client = normalizedClient(clientInput, existingClient);
    if (!client.name && !client.phone) throw new Error('Registra por lo menos el nombre o el teléfono.');
    var clientStatuses = ['Nuevo', 'Contactado', 'Cotización enviada', 'Seguimiento', 'Cierre prioritario', 'Contratado', 'No interesado', 'Archivado'];
    if (clientStatuses.indexOf(client.status) < 0) throw new Error('Estado de cliente no válido.');
    if (client.totalAmount > 0 && client.paidAmount > client.totalAmount) throw new Error('Lo pagado no puede ser mayor al total contratado.');
    upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, client);
    logAudit(ss, 'CRM_CLIENTE_GUARDADO', client.name || client.phone || client.id, client.id, 'Admin XPH');
    return { status: 'success', client: client };
  }

  if (action === 'expenseUpsert') {
    var expenseInput = payload.expense || {};
    var existingExpense = expenseInput.id ? findBusinessRecord(ss, 'Gastos', BUSINESS_HEADERS.expenses, expenseInput.id) : null;
    var expense = normalizedExpense(expenseInput, existingExpense);
    var expenseCategories = ['Equipo y fotografía', 'Maquillaje e insumos', 'Transporte', 'Comida', 'Gastos personales', 'Publicidad', 'Otros del negocio'];
    if (expenseCategories.indexOf(expense.category) < 0) throw new Error('Categoría de gasto no válida.');
    if (['Pagado', 'Pendiente'].indexOf(expense.paymentStatus) < 0) throw new Error('Estado de gasto no válido.');
    if (['Banco', 'Efectivo', 'Bote de reserva', 'Otro'].indexOf(expense.account) < 0) throw new Error('Cuenta de gasto no válida.');
    if (!expense.concept || expense.amount <= 0) throw new Error('El gasto requiere concepto y monto válido.');
    upsertBusinessRecord(ss, 'Gastos', BUSINESS_HEADERS.expenses, expense);
    logAudit(ss, 'GASTO_GUARDADO', expense.category + ': ' + expense.concept, expense.id, 'Admin XPH');
    return { status: 'success', expense: expense };
  }

  if (action === 'contractUpload') {
    var upload = payload.contract || {};
    if (!upload.clientId || !upload.clientName || !upload.folio || !upload.base64) throw new Error('Contrato incompleto.');
    var contractId = businessId('contrato');
    var filename = cleanBusinessText(upload.filename || ('Contrato-' + upload.folio + '.pdf'), 220);
    var originalFile = getContractsFolder().createFile(base64Blob(upload.base64, 'application/pdf', filename));
    var created = businessNow();
    var contract = {
      id: contractId,
      clientId: cleanBusinessText(upload.clientId, 120),
      clientName: cleanBusinessText(upload.clientName, 180),
      folio: cleanBusinessText(upload.folio, 100),
      eventType: cleanBusinessText(upload.eventType, 120),
      eventDate: cleanBusinessText(upload.eventDate, 40),
      status: 'Preparado',
      originalFileName: filename,
      originalFileId: originalFile.getId(),
      clientSignedFileId: '', finalFileId: '', signatureFileId: '', tokenHash: '', tokenExpiresAt: '', tokenStatus: '',
      sentAt: '', viewedAt: '', acceptedAt: '', clientSignedAt: '', ownerAuthorizedAt: '', documentHash: '', signedDocumentHash: '', finalDocumentHash: '', signerIp: '', signerUserAgent: '', consentText: '',
      createdAt: created, updatedAt: created
    };
    upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, contract);
    var linkedClient = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, contract.clientId);
    if (linkedClient) {
      linkedClient.contractId = contract.id;
      linkedClient.updatedAt = created;
      upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, linkedClient);
    }
    logAudit(ss, 'CONTRATO_PRIVADO_CARGADO', contract.folio, contract.id, 'Admin XPH');
    return { status: 'success', contract: publicContractRecord(contract) };
  }

  if (action === 'contractCreateLink') {
    var linkContract = findBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, payload.contractId);
    if (!linkContract) throw new Error('Contrato no encontrado.');
    if (['Firmado por cliente', 'Finalizado', 'Cancelado'].indexOf(String(linkContract.status || '')) >= 0) throw new Error('El contrato ya no admite una liga nueva.');
    linkContract.tokenHash = cleanBusinessText(payload.tokenHash, 180);
    linkContract.tokenExpiresAt = cleanBusinessText(payload.expiresAt, 50);
    linkContract.tokenStatus = 'ACTIVO';
    linkContract.status = 'Enviado';
    linkContract.sentAt = businessNow();
    linkContract.updatedAt = linkContract.sentAt;
    upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, linkContract);
    logAudit(ss, 'LIGA_FIRMA_CREADA', 'Liga móvil privada con vencimiento ' + linkContract.tokenExpiresAt, linkContract.id, 'Admin XPH');
    return { status: 'success', contract: publicContractRecord(linkContract) };
  }

  if (action === 'contractInvalidate') {
    var invalidHash = tokenHashFromRaw(payload.token);
    var invalidContracts = readBusinessRecords(ss, 'Contratos', BUSINESS_HEADERS.contracts);
    for (var c = 0; c < invalidContracts.length; c++) {
      if (String(invalidContracts[c].tokenHash || '') === invalidHash) {
        invalidContracts[c].tokenStatus = 'INVALIDADO_ESCRITORIO';
        if (String(invalidContracts[c].status || '') === 'Enviado' || String(invalidContracts[c].status || '') === 'Visto') invalidContracts[c].status = 'Preparado';
        invalidContracts[c].updatedAt = businessNow();
        upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, invalidContracts[c]);
        logAudit(ss, 'LIGA_FIRMA_INVALIDADA', 'La liga fue abierta desde un dispositivo no móvil.', invalidContracts[c].id, 'Sistema XPH');
        break;
      }
    }
    return { status: 'success' };
  }

  if (action === 'contractResolve') {
    var resolved = resolveSigningContract(ss, payload.token);
    if (payload.markViewed) {
      resolved.viewedAt = resolved.viewedAt || businessNow();
      resolved.status = 'Visto';
      resolved.updatedAt = businessNow();
      upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, resolved);
    }
    var resolvedOutput = { status: 'success', contract: publicContractRecord(resolved) };
    if (payload.includePdf) resolvedOutput.pdfBase64 = fileBase64(resolved.originalFileId);
    return resolvedOutput;
  }

  if (action === 'contractCompleteSignature') {
    var signedContract = resolveSigningContract(ss, payload.token);
    var folder = getContractsFolder();
    var signedName = 'Firmado-cliente-' + (signedContract.folio || signedContract.id) + '.pdf';
    var signedFile = folder.createFile(base64Blob(payload.signedPdfBase64, 'application/pdf', signedName));
    var signatureFile = folder.createFile(base64Blob(payload.signatureDataUrl, 'image/png', 'Firma-cliente-' + signedContract.id + '.png'));
    var audit = payload.audit || {};
    signedContract.clientSignedFileId = signedFile.getId();
    signedContract.signatureFileId = signatureFile.getId();
    signedContract.tokenStatus = 'CONSUMIDO';
    signedContract.status = 'Firmado por cliente';
    signedContract.acceptedAt = cleanBusinessText(audit.acceptedAt || businessNow(), 50);
    signedContract.clientSignedAt = businessNow();
    signedContract.documentHash = cleanBusinessText(payload.originalDocumentHash, 180);
    signedContract.signedDocumentHash = cleanBusinessText(payload.signedDocumentHash, 180);
    signedContract.signerIp = cleanBusinessText(audit.ip, 150);
    signedContract.signerUserAgent = cleanBusinessText(audit.userAgent, 900);
    signedContract.consentText = cleanBusinessText(audit.consentText, 600);
    signedContract.updatedAt = signedContract.clientSignedAt;
    upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, signedContract);
    logAudit(ss, 'CONTRATO_FIRMADO_CLIENTE', signedContract.folio + ' | hash ' + signedContract.signedDocumentHash, signedContract.id, signedContract.clientName);
    return { status: 'success', contract: publicContractRecord(signedContract) };
  }

  if (action === 'ownerSignatureSave') {
    var ownerFile = getContractsFolder().createFile(base64Blob(payload.signatureDataUrl, 'image/png', 'Firma-Javier-' + Date.now() + '.png'));
    var signatureRecord = { id: 'xavi-owner-signature', fileId: ownerFile.getId(), updatedAt: businessNow() };
    upsertBusinessRecord(ss, 'Firma_Administrador', BUSINESS_HEADERS.ownerSignature, signatureRecord);
    logAudit(ss, 'FIRMA_ADMIN_GUARDADA', 'Firma privada de autorización actualizada.', signatureRecord.id, 'Admin XPH');
    return { status: 'success' };
  }

  if (action === 'contractAdminPdfData') {
    var adminContract = findBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, payload.contractId);
    if (!adminContract) throw new Error('Contrato no encontrado.');
    var requestedVersion = cleanBusinessText(payload.version || 'latest', 20);
    var selectedFileId = '';
    if (requestedVersion === 'original') selectedFileId = adminContract.originalFileId;
    else if (requestedVersion === 'signed') selectedFileId = adminContract.clientSignedFileId;
    else if (requestedVersion === 'final') selectedFileId = adminContract.finalFileId;
    else selectedFileId = adminContract.finalFileId || adminContract.clientSignedFileId || adminContract.originalFileId;
    if (!selectedFileId) throw new Error('La versión solicitada del contrato no está disponible.');
    return { status: 'success', pdfBase64: fileBase64(selectedFileId), folio: adminContract.folio || adminContract.id };
  }

  if (action === 'contractFinalizeData') {
    var finalSource = findBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, payload.contractId);
    if (!finalSource || String(finalSource.status || '') !== 'Firmado por cliente' || !finalSource.clientSignedFileId) throw new Error('El cliente todavía no ha firmado este contrato.');
    var ownerRows = readBusinessRecords(ss, 'Firma_Administrador', BUSINESS_HEADERS.ownerSignature);
    if (!ownerRows.length || !ownerRows[0].fileId) throw new Error('Guarda primero la firma privada de Javier.');
    return { status: 'success', pdfBase64: fileBase64(finalSource.clientSignedFileId), ownerSignatureDataUrl: 'data:image/png;base64,' + fileBase64(ownerRows[0].fileId) };
  }

  if (action === 'contractFinalize') {
    var finalContract = findBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, payload.contractId);
    if (!finalContract || String(finalContract.status || '') !== 'Firmado por cliente') throw new Error('Contrato no disponible para autorización.');
    var finalName = 'Contrato-final-' + (finalContract.folio || finalContract.id) + '.pdf';
    var finalFile = getContractsFolder().createFile(base64Blob(payload.finalizedPdfBase64, 'application/pdf', finalName));
    finalContract.finalFileId = finalFile.getId();
    finalContract.finalDocumentHash = cleanBusinessText(payload.finalDocumentHash, 180);
    finalContract.ownerAuthorizedAt = cleanBusinessText(payload.authorizedAt || businessNow(), 50);
    finalContract.status = 'Finalizado';
    finalContract.updatedAt = businessNow();
    upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, finalContract);
    logAudit(ss, 'CONTRATO_FINALIZADO', finalContract.folio + ' | hash ' + finalContract.finalDocumentHash, finalContract.id, 'Javier Garcia');
    return { status: 'success', contract: publicContractRecord(finalContract) };
  }

  throw new Error('Acción privada no reconocida.');
}

/**
 * =========================================================================
 * ENDPOINT POST: Subidas a Drive + Actualizaciones en Tablas Google Sheets
 * =========================================================================
 */
function doPost(e) {
  try {
    var rawBase64 = '';
    var mimeType = 'image/jpeg';
    var filename = 'foto_xph_' + Date.now() + '.jpg';
    var title = '';
    var category = 'bodas';
    var location = 'Polanco, CDMX';
    var action = '';
    var configData = '';
    var auditType = '';
    var auditDetails = '';
    var apiSecret = '';
    var payload = {};

    if (e && e.postData && e.postData.contents) {
      var raw = e.postData.contents;
      var parsed = false;

      try {
        var j = JSON.parse(raw);
        if (typeof j === 'object' && j !== null) {
          action       = j.action || '';
          configData   = j.configData || '';
          rawBase64    = j.base64 || '';
          mimeType     = j.mimeType || mimeType;
          filename     = j.filename || filename;
          title        = j.title || '';
          category     = j.category || category;
          location     = j.location || location;
          auditType    = j.auditType || '';
          auditDetails = j.auditDetails || '';
          apiSecret    = j.apiSecret || '';
          payload      = j.payload && typeof j.payload === 'object' ? j.payload : {};
          parsed = true;
        }
      } catch (_) {}

      if (!parsed) {
        var params = {};
        raw.split('&').forEach(function(part) {
          var kv = part.split('=');
          if (kv.length >= 2) {
            params[decodeURIComponent(kv[0])] = decodeURIComponent(kv.slice(1).join('=').replace(/\+/g, ' '));
          }
        });
        action       = params['action'] || action;
        configData   = params['configData'] || configData;
        rawBase64    = params['base64'] || rawBase64;
        mimeType     = params['mimeType'] || mimeType;
        filename     = params['filename'] || filename;
        title        = params['title'] || title;
        category     = params['category'] || category;
        location     = params['location'] || location;
        auditType    = params['auditType'] || auditType;
        auditDetails = params['auditDetails'] || auditDetails;
        apiSecret    = params['apiSecret'] || apiSecret;
      }
    }

    if (e && e.parameter) {
      action       = e.parameter['action'] || action;
      configData   = e.parameter['configData'] || configData;
      rawBase64    = e.parameter['base64'] || rawBase64;
      mimeType     = e.parameter['mimeType'] || mimeType;
      filename     = e.parameter['filename'] || filename;
      title        = e.parameter['title'] || title;
      category     = e.parameter['category'] || category;
      location     = e.parameter['location'] || location;
      auditType    = e.parameter['auditType'] || auditType;
      auditDetails = e.parameter['auditDetails'] || auditDetails;
      apiSecret    = e.parameter['apiSecret'] || apiSecret;
    }

    if (!isAuthorizedApiSecret(apiSecret)) return unauthorizedOutput();

    var ss = getDatabaseSpreadsheet();

    var businessActions = [
      'businessSnapshot', 'crmUpsert', 'expenseUpsert', 'contractUpload', 'contractCreateLink',
      'contractInvalidate', 'contractResolve', 'contractCompleteSignature', 'ownerSignatureSave',
      'contractAdminPdfData', 'contractFinalizeData', 'contractFinalize'
    ];
    if (businessActions.indexOf(action) >= 0) {
      if (action === 'businessSnapshot' || action === 'contractAdminPdfData') {
        return jsonOutput(handleBusinessAction(ss, action, payload));
      }
      var businessLock = LockService.getScriptLock();
      businessLock.waitLock(30000);
      try {
        return jsonOutput(handleBusinessAction(ss, action, payload));
      } finally {
        businessLock.releaseLock();
      }
    }

    // ACCIÓN 1: GUARDAR Y SINCRONIZAR EN GOOGLE SHEETS
    if (action === 'saveConfig' || (configData && configData.length > 0)) {
      var configObj = {};
      try {
        configObj = typeof configData === 'string' ? JSON.parse(configData) : configData;
      } catch (_) {
        configObj = {};
      }

      // Obtener estado previo y combinar (merge) para integridad de datos
      var prevConfig = {};
      try {
        var prevRaw = loadActiveConfig();
        if (prevRaw) prevConfig = JSON.parse(prevRaw);
      } catch (_) {}

      var mergedConfig = {
        packages:         configObj.packages !== undefined ? configObj.packages : (prevConfig.packages || {}),
        addons:           configObj.addons !== undefined ? configObj.addons : (prevConfig.addons || []),
        footerContact:    configObj.footerContact !== undefined ? configObj.footerContact : (prevConfig.footerContact || {}),
        promotionPopup:   configObj.promotionPopup !== undefined ? configObj.promotionPopup : (prevConfig.promotionPopup || null),
        testimonials:     configObj.testimonials !== undefined ? configObj.testimonials : (prevConfig.testimonials || []),
        quotes:           configObj.quotes !== undefined ? configObj.quotes : (prevConfig.quotes || []),
        adminCredentials: configObj.adminCredentials !== undefined ? configObj.adminCredentials : (prevConfig.adminCredentials || {}),
        galleryImages:    configObj.galleryImages !== undefined ? configObj.galleryImages : (prevConfig.galleryImages || [])
      };

      var jsonStr = JSON.stringify(mergedConfig);
      saveActiveConfig(ss, jsonStr);

      if (ss) {
        if (mergedConfig.galleryImages) syncGalleryTable(ss, mergedConfig.galleryImages);
        if (mergedConfig.packages) syncPackagesTable(ss, mergedConfig.packages);
        if (mergedConfig.quotes) syncQuotesTable(ss, mergedConfig.quotes);

        logAudit(
          ss,
          auditType || 'ACTUALIZACION_CONFIGURACION',
          auditDetails || 'Cambios guardados en base de datos',
          '-',
          'Admin XPH'
        );
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        spreadsheetUrl: ss ? ss.getUrl() : '',
        message: 'Base de datos sincronizada en Google Sheets con éxito'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACCIÓN 2: SUBIR FOTOGRAFÍA A GOOGLE DRIVE Y REGISTRAR EN TABLA GALERIA_FOTOS
    if (action !== 'uploadPhoto' && !rawBase64) {
      // No es una subida de foto, retornar éxito neutro
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Acción no reconocida o datos de imagen faltantes.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!rawBase64) {
      throw new Error('No se recibieron datos de imagen (base64).');
    }

    if (rawBase64.indexOf(',') > -1) rawBase64 = rawBase64.split(',')[1];
    rawBase64 = rawBase64.replace(/\s/g, '');

    var bytes = Utilities.base64Decode(rawBase64);
    var blob  = Utilities.newBlob(bytes, mimeType, filename);

    var targetFolder;
    try {
      targetFolder = DriveApp.getFolderById(FOLDER_ID);
    } catch (_) {
      targetFolder = DriveApp.getRootFolder();
    }

    var file = targetFolder.createFile(blob);
    var fileId = file.getId();

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (_) {}

    var directUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    var driveUrl  = 'https://drive.google.com/file/d/' + fileId + '/view';
    var finalTitle = title || filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    var nowStr = new Date().toISOString().split('T')[0];

    // Escribir físicamente en la pestaña Galeria_Fotos de Google Sheets
    if (ss) {
      var sheetG = ss.getSheetByName('Galeria_Fotos');
      if (!sheetG) {
        initSpreadsheetSheets(ss);
        sheetG = ss.getSheetByName('Galeria_Fotos');
      }
      if (sheetG) {
        sheetG.appendRow([
          fileId,
          finalTitle,
          (category || 'bodas').toLowerCase(),
          directUrl,
          location || 'Polanco, CDMX',
          nowStr,
          'ACTIVO'
        ]);
      }

      // Actualizar también Config_Activa con la nueva foto
      var prevCfg = {};
      try {
        var rawC = loadActiveConfig();
        if (rawC) prevCfg = JSON.parse(rawC);
      } catch (_) {}
      var currentGallery = Array.isArray(prevCfg.galleryImages) ? prevCfg.galleryImages : [];
      currentGallery.unshift({
        id: fileId,
        title: finalTitle,
        category: (category || 'bodas').toLowerCase(),
        url: directUrl,
        location: location || 'Polanco, CDMX'
      });
      prevCfg.galleryImages = currentGallery;
      saveActiveConfig(ss, JSON.stringify(prevCfg));

      logAudit(
        ss,
        'SUBIDA_FOTOGRAFIA_DRIVE',
        'Foto registrada en Galeria_Fotos: ' + finalTitle + ' | ' + directUrl,
        fileId,
        'Admin XPH'
      );
    }

    return ContentService.createTextOutput(JSON.stringify({
      status:   'success',
      fileId:   fileId,
      url:      directUrl,
      driveUrl: driveUrl,
      name:     filename,
      title:    finalTitle,
      category: category,
      spreadsheetUrl: ss ? ss.getUrl() : ''
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status:  'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * =========================================================================
 * ENDPOINT GET: Carga + Guarda configuración + Lista archivos de Drive + Migración forzada
 * =========================================================================
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter['action']) ? e.parameter['action'] : 'loadConfig';
    var apiSecret = (e && e.parameter && e.parameter['apiSecret']) ? e.parameter['apiSecret'] : '';
    if (!isAuthorizedApiSecret(apiSecret)) return unauthorizedOutput();

    // ── ACCIÓN: MIGRAR Y SINCRONIZAR TODAS LAS TABLAS FORZOSAMENTE ────────────
    if (action === 'migrateAndSyncAll') {
      var ssMigrate = getDatabaseSpreadsheet();
      if (ssMigrate) {
        initSpreadsheetSheets(ssMigrate);
        var rawCfg = loadActiveConfig();
        if (rawCfg) {
          try {
            var c = JSON.parse(rawCfg);
            if (c.packages) syncPackagesTable(ssMigrate, c.packages);
            if (c.galleryImages) syncGalleryTable(ssMigrate, c.galleryImages);
            if (c.quotes) syncQuotesTable(ssMigrate, c.quotes);
          } catch (_) {}
        }
        logAudit(ssMigrate, 'MIGRACION_COMPLETA', 'Estructura de 10 columnas aplicada y sincronizada', '-', 'Admin XPH');
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          message: 'Migración de tablas ejecutada exitosamente',
          spreadsheetUrl: ssMigrate.getUrl()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ── ACCIÓN: LISTAR FOTOS DIRECTAMENTE DESDE LA CARPETA DE GOOGLE DRIVE ────
    if (action === 'listDriveFolder') {
      var targetFolder;
      try {
        targetFolder = DriveApp.getFolderById(FOLDER_ID);
      } catch (_) {
        targetFolder = DriveApp.getRootFolder();
      }

      var files = targetFolder.getFiles();
      var images = [];
      while (files.hasNext()) {
        var file = files.next();
        var mime = file.getMimeType();
        if (mime.indexOf('image/') > -1) {
          images.push({
            id: file.getId(),
            name: file.getName(),
            url: 'https://lh3.googleusercontent.com/d/' + file.getId(),
            driveUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view',
            createdTime: file.getDateCreated().toISOString()
          });
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        images: images,
        count: images.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Las mutaciones se aceptan únicamente por POST.
    if (action === 'saveConfig') return jsonOutput({ status: 'error', message: 'Método no permitido.' });

    // ── ACCIÓN: CARGAR CONFIGURACIÓN (DEFAULT) ────────────────────────────────
    var content = loadActiveConfig();
    var parsed = {};
    
    if (content && content.length > 0) {
      try {
        parsed = JSON.parse(content);
      } catch (_) {
        parsed = {};
      }
    }

    var props = PropertiesService.getScriptProperties();
    var sheetUrl = props.getProperty('xph_spreadsheet_url') || '';

    return ContentService.createTextOutput(JSON.stringify({
      status:         'success',
      config:         parsed,
      spreadsheetUrl: sheetUrl,
      updatedAt:      props.getProperty('xph_updated_at') || new Date().toISOString(),
      service:        'XPH Google Sheets Database & Audit Engine'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status:  'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
