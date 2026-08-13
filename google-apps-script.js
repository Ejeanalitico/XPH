/**
 * =========================================================================
 * GOOGLE APPS SCRIPT — XPH CLOUD DATABASE & DRIVE STORAGE BACKEND
 * =========================================================================
 * Carpeta Destino en Google Drive: 1UyN3m72kG4liDumQYxlO03cKtJJpYG62
 * =========================================================================
 */

var FOLDER_ID = "1UyN3m72kG4liDumQYxlO03cKtJJpYG62";

/**
 * Obtiene o crea el archivo de base de datos JSON en la carpeta de Google Drive
 */
function getDatabaseFile() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFilesByName("xph_database.json");
  if (files.hasNext()) {
    return files.next();
  } else {
    var file = folder.createFile("xph_database.json", "{}", MimeType.PLAIN_TEXT);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file;
  }
}

/**
 * Endpoint POST: Subida de fotografías a Drive Y guardado de configuración del sitio
 */
function doPost(e) {
  try {
    var rawBase64 = '';
    var mimeType = 'image/jpeg';
    var filename = 'foto_xph_' + Date.now() + '.jpg';
    var action = '';
    var configData = '';

    // 1. Parsear datos entrantes (JSON o URLSearchParams)
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

    // ACCIÓN A: GUARDAR CONFIGURACIÓN / PAQUETES / PRECIOS / GALERÍA EN DRIVE
    if (action === 'saveConfig' || (configData && configData.length > 0)) {
      var dbFile = getDatabaseFile();
      dbFile.setContent(configData);
      dbFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Base de datos sincronizada en Google Drive con éxito'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACCIÓN B: SUBIR FOTOGRAFÍA A GOOGLE DRIVE
    if (!rawBase64) {
      throw new Error('No se recibieron datos de imagen ni configuración.');
    }

    if (rawBase64.indexOf(',') > -1) rawBase64 = rawBase64.split(',')[1];
    rawBase64 = rawBase64.replace(/\s/g, '');

    var bytes = Utilities.base64Decode(rawBase64);
    var blob  = Utilities.newBlob(bytes, mimeType, filename);

    var targetFolder = DriveApp.getFolderById(FOLDER_ID);
    var file = targetFolder.createFile(blob);
    var fileId = file.getId();

    // Hacer archivo público para visualización web
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (_) {}

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

/**
 * Endpoint GET: Lectura en tiempo real de la base de datos (para cel, tablet, PC de clientes)
 */
function doGet(e) {
  try {
    var dbFile = getDatabaseFile();
    var content = dbFile.getBlob().getDataAsString();
    var parsed = {};
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      parsed = {};
    }

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
