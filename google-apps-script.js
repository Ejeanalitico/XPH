function doPost(e) {
  try {
    var rawBase64 = '';
    var mimeType = 'image/jpeg';
    var filename = 'foto_xph_' + Date.now() + '.jpg';
    var action = '';
    var configData = '';

    // Accept BOTH JSON body AND form-encoded params (URLSearchParams)
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

    // ACTION: SAVE SITE CONFIGURATION (Prices, Packages, Footer, Gallery, Quotes)
    if (action === 'saveConfig' || configData) {
      PropertiesService.getScriptProperties().setProperty('xph_site_data', configData);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Configuración guardada en la nube con éxito'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION: PHOTO UPLOAD TO DRIVE
    if (!rawBase64) {
      throw new Error('No se recibieron datos de imagen ni configuración.');
    }

    if (rawBase64.indexOf(',') > -1) rawBase64 = rawBase64.split(',')[1];
    rawBase64 = rawBase64.replace(/\s/g, '');

    var bytes = Utilities.base64Decode(rawBase64);
    var blob  = Utilities.newBlob(bytes, mimeType, filename);

    var file, fileId;
    try {
      file   = Drive.Files.create({ name: filename, mimeType: mimeType }, blob);
      fileId = file.id;
    } catch (advErr) {
      file   = DriveApp.createFile(blob);
      fileId = file.getId();
    }

    // Make file publicly readable
    try {
      DriveApp.getFileById(fileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(_) {}

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
    var action = (e && e.parameter) ? e.parameter.action : '';
    if (action === 'loadConfig' || action === 'getConfig') {
      var savedConfig = PropertiesService.getScriptProperties().getProperty('xph_site_data');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        config: savedConfig ? JSON.parse(savedConfig) : null
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status:  'online',
      service: 'XPH Cloud Sync & Google Drive Direct Storage API'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
