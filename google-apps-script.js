/**
 * =========================================================================
 * GOOGLE APPS SCRIPT — XPH CLOUD DATABASE & DRIVE STORAGE BACKEND
 * =========================================================================
 * Carpeta Destino en Google Drive: 1UyN3m72kG4liDumQYxlO03cKtJJpYG62
 * =========================================================================
 */

var FOLDER_ID = "1UyN3m72kG4liDumQYxlO03cKtJJpYG62";

/**
 * Guarda JSON en Script Properties usando Chunks de 8KB (Capacidad hasta 500KB)
 * No requiere permisos especiales de DriveApp y funciona 100% para cualquier usuario.
 */
function saveToProperties(jsonString) {
  var props = PropertiesService.getScriptProperties();
  var CHUNK_SIZE = 8000;
  var totalChunks = Math.ceil(jsonString.length / CHUNK_SIZE);
  
  var newProps = {
    'xph_total_chunks': totalChunks.toString(),
    'xph_updated_at': new Date().toISOString()
  };
  
  for (var i = 0; i < totalChunks; i++) {
    newProps['chunk_' + i] = jsonString.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  }
  
  props.setProperties(newProps, true); // true = deleteAllOthers
}

/**
 * Recupera el JSON completo reconstruyendo los chunks
 */
function loadFromProperties() {
  var props = PropertiesService.getScriptProperties();
  var totalChunksStr = props.getProperty('xph_total_chunks');
  
  if (!totalChunksStr) {
    return props.getProperty('xph_site_data') || '';
  }
  
  var totalChunks = parseInt(totalChunksStr, 10);
  var fullString = '';
  for (var i = 0; i < totalChunks; i++) {
    fullString += (props.getProperty('chunk_' + i) || '');
  }
  return fullString;
}

/**
 * Endpoint POST: Subida de imágenes a Drive Y Guardado de Base de Datos
 */
function doPost(e) {
  try {
    var rawBase64 = '';
    var mimeType = 'image/jpeg';
    var filename = 'foto_xph_' + Date.now() + '.jpg';
    var action = '';
    var configData = '';

    // Parsear payload (JSON body o Form-encoded)
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

    // ACCIÓN 1: GUARDAR CONFIGURACIÓN DEL SITIO (Paquetes, Precios, Fotos, Testimonios)
    if (action === 'saveConfig' || (configData && configData.length > 0)) {
      saveToProperties(configData);
      
      // Intentar guardar copia en archivo de Drive si DriveApp está disponible
      try {
        var folder = DriveApp.getFolderById(FOLDER_ID);
        var files = folder.getFilesByName("xph_database.json");
        var dbFile = files.hasNext() ? files.next() : folder.createFile("xph_database.json", configData, MimeType.PLAIN_TEXT);
        dbFile.setContent(configData);
        dbFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (_) {}

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Base de datos sincronizada en la nube con éxito'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACCIÓN 2: SUBIR FOTOGRAFÍA A GOOGLE DRIVE
    if (!rawBase64) {
      throw new Error('No se recibieron datos de imagen.');
    }

    if (rawBase64.indexOf(',') > -1) rawBase64 = rawBase64.split(',')[1];
    rawBase64 = rawBase64.replace(/\s/g, '');

    var bytes = Utilities.base64Decode(rawBase64);
    var blob  = Utilities.newBlob(bytes, mimeType, filename);

    var file;
    try {
      var targetFolder = DriveApp.getFolderById(FOLDER_ID);
      file = targetFolder.createFile(blob);
    } catch (_) {
      file = DriveApp.createFile(blob);
    }

    var fileId = file.getId();
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
 * Endpoint GET: Consulta en tiempo real de la base de datos para cualquier dispositivo
 */
function doGet(e) {
  try {
    var content = loadFromProperties();
    var parsed = {};
    
    if (content && content.length > 0) {
      try {
        parsed = JSON.parse(content);
      } catch (_) {
        parsed = {};
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status:  'success',
      config:  parsed,
      service: 'XPH Cloud Sync & Google Drive API'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status:  'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
