/**
 * =========================================================================
 * GOOGLE APPS SCRIPT — XPH GOOGLE SHEETS DATABASE & AUDIT LOG ENGINE
 * =========================================================================
 * Carpeta Destino en Google Drive: 1UyN3m72kG4liDumQYxlO03cKtJJpYG62
 * Nombre de la Hoja de Cálculo: XPH_DATABASE_PRODUCCION
 * =========================================================================
 */

var FOLDER_ID = "1UyN3m72kG4liDumQYxlO03cKtJJpYG62";
var SPREADSHEET_NAME = "XPH_DATABASE_PRODUCCION";

/**
 * Obtiene o crea la hoja de cálculo de base de datos con las 5 tablas estructuradas
 */
function getDatabaseSpreadsheet() {
  var folder;
  try {
    folder = DriveApp.getFolderById(FOLDER_ID);
  } catch (_) {
    folder = DriveApp.getRootFolder();
  }

  var files = folder.getFilesByName(SPREADSHEET_NAME);
  var ss;

  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    var file = DriveApp.getFileById(ss.getId());
    folder.addFile(file);
    try { DriveApp.getRootFolder().removeFile(file); } catch (_) {}
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  }

  initSpreadsheetSheets(ss);
  return ss;
}

/**
 * Inicializa y da formato a las 5 tablas/pestañas de la base de datos
 */
function initSpreadsheetSheets(ss) {
  var sheetsMap = {
    'Config_Activa': ['Clave', 'Valor_JSON', 'Ultima_Actualizacion'],
    'Historial_Auditoria': ['Fecha_Hora', 'Accion', 'Detalles_Cambio', 'ID_Elemento', 'Usuario', 'Estado'],
    'Galeria_Fotos': ['ID_Foto', 'Titulo', 'Categoria', 'URL_Google_Drive', 'Ubicacion', 'Fecha_Carga', 'Estado'],
    'Cotizaciones_Citas': ['ID_Cotizacion', 'Fecha_Registro', 'Cliente', 'Email', 'WhatsApp', 'Evento', 'Paquete', 'Total_MXN', 'Anticipo_40_MXN', 'Saldo_60_MXN', 'Fecha_Evento', 'Ciudad', 'Estado_Cotizacion', 'Notas'],
    'Paquetes_Precios': ['Categoria', 'ID_Paquete', 'Nombre', 'Precio_MXN', 'Anticipo_40_MXN', 'Horas_Cobertura', 'Fotos_Entregables', 'Incluye', 'Ultima_Modificacion']
  };

  for (var sheetName in sheetsMap) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = sheetsMap[sheetName];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#161C28')
        .setFontColor('#D4AF37')
        .setFontWeight('bold')
        .setFontFamily('Arial');
      sheet.setFrozenRows(1);
    }
  }

  // Eliminar la hoja por defecto 'Hoja 1' si existen otras
  var defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (_) {}
  }
}

/**
 * Registra una acción en la tabla Historial_Auditoria
 */
function logAudit(ss, action, details, elementId, user) {
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
 * Sincroniza la tabla Galeria_Fotos en Google Sheets
 */
function syncGalleryTable(ss, galleryImages) {
  try {
    var sheet = ss.getSheetByName('Galeria_Fotos');
    if (!sheet) return;

    // Limpiar filas anteriores manteniendo encabezados
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }

    if (Array.isArray(galleryImages)) {
      var rows = [];
      galleryImages.forEach(function(img) {
        rows.push([
          img.id || '',
          img.title || '',
          img.category || '',
          img.url || '',
          img.location || 'CDMX',
          new Date().toISOString().split('T')[0],
          'ACTIVO'
        ]);
      });
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 7).setValues(rows);
      }
    }
  } catch (e) {
    Logger.log('Error sync gallery: ' + e);
  }
}

/**
 * Sincroniza la tabla Paquetes_Precios en Google Sheets
 */
function syncPackagesTable(ss, packages) {
  try {
    var sheet = ss.getSheetByName('Paquetes_Precios');
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }

    if (packages && typeof packages === 'object') {
      var rows = [];
      var now = new Date().toISOString().split('T')[0];

      for (var cat in packages) {
        var list = packages[cat];
        if (Array.isArray(list)) {
          list.forEach(function(pkg) {
            rows.push([
              cat.toUpperCase(),
              pkg.id || '',
              pkg.name || '',
              pkg.price || 0,
              Math.round((pkg.price || 0) * 0.4),
              pkg.hours || '',
              pkg.photosCount || '',
              Array.isArray(pkg.features) ? pkg.features.join(' | ') : '',
              now
            ]);
          });
        }
      }
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 9).setValues(rows);
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
  try {
    var sheet = ss.getSheetByName('Cotizaciones_Citas');
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }

    if (Array.isArray(quotes)) {
      var rows = [];
      quotes.forEach(function(q) {
        rows.push([
          q.id || '',
          q.createdAt || new Date().toISOString().split('T')[0],
          q.clientName || '',
          q.clientEmail || '',
          q.clientPhone || '',
          q.eventType || '',
          q.packageName || '',
          q.total || 0,
          q.depositAmount || Math.round((q.total || 0) * 0.4),
          (q.total || 0) - (q.depositAmount || Math.round((q.total || 0) * 0.4)),
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
  // 1. Guardar en Google Sheets (Config_Activa)
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

  // 2. Guardar en PropertiesService Chunks para respuesta ultrarrápida a la web
  var props = PropertiesService.getScriptProperties();
  var CHUNK_SIZE = 8000;
  var totalChunks = Math.ceil(configJsonString.length / CHUNK_SIZE);
  
  var newProps = {
    'xph_total_chunks': totalChunks.toString(),
    'xph_updated_at': new Date().toISOString(),
    'xph_spreadsheet_id': ss.getId(),
    'xph_spreadsheet_url': ss.getUrl()
  };
  
  for (var i = 0; i < totalChunks; i++) {
    newProps['chunk_' + i] = configJsonString.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  }
  
  props.setProperties(newProps, true);
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

  // Si no está en Properties, leer de Google Sheets
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName('Config_Activa');
    if (sheet && sheet.getLastRow() >= 2) {
      return sheet.getRange(2, 2).getValue() || '';
    }
  } catch (_) {}

  return '';
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
    var action = '';
    var configData = '';
    var auditType = '';
    var auditDetails = '';

    // 1. Parsear datos entrantes (JSON o Form-encoded)
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
          auditType    = j.auditType || '';
          auditDetails = j.auditDetails || '';
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
        auditType    = params['auditType'] || auditType;
        auditDetails = params['auditDetails'] || auditDetails;
      }
    }

    if (e && e.parameter) {
      action       = e.parameter['action'] || action;
      configData   = e.parameter['configData'] || configData;
      rawBase64    = e.parameter['base64'] || rawBase64;
      mimeType     = e.parameter['mimeType'] || mimeType;
      filename     = e.parameter['filename'] || filename;
      auditType    = e.parameter['auditType'] || auditType;
      auditDetails = e.parameter['auditDetails'] || auditDetails;
    }

    var ss = getDatabaseSpreadsheet();

    // ACCIÓN 1: GUARDAR Y SINCRONIZAR EN GOOGLE SHEETS
    if (action === 'saveConfig' || (configData && configData.length > 0)) {
      var configObj = {};
      try {
        configObj = typeof configData === 'string' ? JSON.parse(configData) : configData;
      } catch (_) {
        configObj = {};
      }

      var jsonStr = JSON.stringify(configObj);
      saveActiveConfig(ss, jsonStr);

      // Sincronizar tablas individuales
      if (configObj.galleryImages) syncGalleryTable(ss, configObj.galleryImages);
      if (configObj.packages) syncPackagesTable(ss, configObj.packages);
      if (configObj.quotes) syncQuotesTable(ss, configObj.quotes);

      // Registrar auditoría
      logAudit(
        ss,
        auditType || 'ACTUALIZACION_CONFIGURACION',
        auditDetails || 'Cambios guardados en base de datos',
        '-',
        'Admin XPH'
      );

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        spreadsheetUrl: ss.getUrl(),
        message: 'Base de datos sincronizada en Google Sheets con éxito'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACCIÓN 2: SUBIR FOTOGRAFÍA A GOOGLE DRIVE Y REGISTRAR EN TABLA
    if (!rawBase64) {
      throw new Error('No se recibieron datos de imagen ni configuración.');
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

    // Registrar subida en Auditoría
    logAudit(
      ss,
      'SUBIDA_FOTOGRAFIA_DRIVE',
      'Archivo: ' + filename + ' | DirectUrl: ' + directUrl,
      fileId,
      'Admin XPH'
    );

    return ContentService.createTextOutput(JSON.stringify({
      status:   'success',
      fileId:   fileId,
      url:      directUrl,
      driveUrl: driveUrl,
      name:     filename,
      spreadsheetUrl: ss.getUrl()
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
 * ENDPOINT GET: Consulta en Tiempo Real de la Última Versión de Sheets
 * =========================================================================
 */
function doGet(e) {
  try {
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
