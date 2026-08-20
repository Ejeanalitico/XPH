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
    if (!SPREADSHEET_ID || !FOLDER_ID) {
      throw new Error('Faltan XPH_SPREADSHEET_ID o XPH_FOLDER_ID en las propiedades del script.');
    }
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
      'Paquetes_Precios': ['Categoria', 'ID_Paquete', 'Nombre_Paquete', 'Precio_Base_MXN', 'Precio_Final_Por_Confirmar', 'Insignia_Badge', 'Descripcion', 'Que_Incluye', 'No_Incluye', 'Ultima_Modificacion']
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
