/**
 * =========================================================================
 * GOOGLE APPS SCRIPT — XPH CLOUD DATABASE & DRIVE STORAGE BACKEND
 * =========================================================================
 * Carpeta Destino en Google Drive: 1UyN3m72kG4liDumQYxlO03cKtJJpYG62
 * =========================================================================
 * IMPORTANTE AL CONFIGURAR LA IMPLEMENTACIÓN:
 * 1. "Ejecutar como" (Execute as): "Yo (tu cuenta de Google)"
 * 2. "Quién tiene acceso" (Who has access): "Cualquier persona" (Anyone)
 * =========================================================================
 */

var FOLDER_ID = "1UyN3m72kG4liDumQYxlO03cKtJJpYG62";

function getDatabaseFile() {
  try {
    var folder;
    try {
      folder = DriveApp.getFolderById(FOLDER_ID);
    } catch (_) {
      folder = DriveApp.getRootFolder();
    }
    var files = folder.getFilesByName("xph_database.json");
    if (files.hasNext()) {
      return files.next();
    } else {
      var file = folder.createFile("xph_database.json", "{}", MimeType.PLAIN_TEXT);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
      return file;
    }
  } catch (e) {
    return null;
  }
}

function doPost(e) {
  try {
    var rawBase64 = '';
    var mimeType = 'image/jpeg';
    var filename = 'foto_xph_' + Date.now() + '.jpg';
    var action = '';
    var configData = '';

    // 1. Parsear datos entrantes
    if (e.postData && e.postData.type === 'application/json') {
      var data = JSON.parse(e.postData.contents);
      action     = data.action || '';
      configData = data.configData || '';
      rawBase64  = data.base64 || '';
      mimeType   = data.mimeType || mimeType;
      filename   = data.filename || filename;
    } else if (e.postData && e.postData.contents) {
      var params = {};
      e.postData.contents.split('&').forEach(function(part) {
        var kv = part.split('=');
        params[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
      });
      action     = params['action'] || '';
      configData = params['configData'] || '';
      rawBase64  = params['base64'] || '';
      mimeType   = params['mimeType'] || mimeType;
      filename   = params['filename'] || filename;
    } else if (e.parameter) {
      action     = e.parameter['action'] || '';
      configData = e.parameter['configData'] || '';
      rawBase64  = e.parameter['base64'] || '';
      mimeType   = e.parameter['mimeType'] || mimeType;
      filename   = e.parameter['filename'] || filename;
    }

    // ACCIÓN A: GUARDAR CONFIGURACIÓN / PRECIOS / PAQUETES / GALERÍA
    if (action === 'saveConfig' || (configData && configData.length > 0)) {
      var savedInDrive = false;
      try {
        var dbFile = getDatabaseFile();
        if (dbFile) {
          dbFile.setContent(configData);
          try { dbFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
          savedInDrive = true;
        }
      } catch (_) {}

      try {
        PropertiesService.getScriptProperties().setProperty('xph_site_data', configData);
      } catch (_) {}

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        savedInDrive: savedInDrive,
        message: 'Base de datos sincronizada con éxito'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACCIÓN B: SUBIR FOTOGRAFÍA A GOOGLE DRIVE
    if (!rawBase64) throw new Error('No se recibieron datos.');

    if (rawBase64.indexOf(',') > -1) rawBase64 = rawBase64.split(',')[1];
    rawBase64 = rawBase64.replace(/\s/g, '');

    var bytes = Utilities.base64Decode(rawBase64);
    var blob  = Utilities.newBlob(bytes, mimeType, filename);

    var file;
    try {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      file = folder.createFile(blob);
    } catch (_) {
      file = DriveApp.createFile(blob);
    }

    var fileId = file.getId();
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}

    var directUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    var driveUrl  = 'https://drive.google.com/file/d/' + fileId + '/view';

    return ContentService.createTextOutput(JSON.stringify({
      status:   'success',
      fileId:   fileId,
      url:      directUrl,
      driveUrl: driveUrl,
      name:     filename
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status:  'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var content = '';
    try {
      var dbFile = getDatabaseFile();
      if (dbFile) {
        content = dbFile.getBlob().getDataAsString();
      }
    } catch (_) {}

    if (!content || content === '{}') {
      try {
        var prop = PropertiesService.getScriptProperties().getProperty('xph_site_data');
        if (prop) content = prop;
      } catch (_) {}
    }

    var parsed = {};
    try { parsed = JSON.parse(content || '{}'); } catch (_) { parsed = {}; }

    return ContentService.createTextOutput(JSON.stringify({
      status:  'success',
      config:  parsed,
      service: 'XPH Cloud Sync & Google Drive Database API'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status:  'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
