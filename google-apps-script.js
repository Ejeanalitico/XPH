function doPost(e) {
  try {
    var rawBase64 = '';
    var mimeType = 'image/jpeg';
    var filename = 'foto_xph_' + Date.now() + '.jpg';

    // Accept BOTH JSON body AND form-encoded params (URLSearchParams)
    if (e.postData && e.postData.type === 'application/json') {
      // JSON body
      var data = JSON.parse(e.postData.contents);
      rawBase64 = data.base64 || '';
      mimeType  = data.mimeType  || mimeType;
      filename  = data.filename  || filename;
    } else if (e.postData && e.postData.contents) {
      // application/x-www-form-urlencoded  ← sent by XHR with URLSearchParams
      var params = {};
      e.postData.contents.split('&').forEach(function(part) {
        var kv = part.split('=');
        params[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
      });
      rawBase64 = params['base64']   || '';
      mimeType  = params['mimeType'] || mimeType;
      filename  = params['filename'] || filename;
    } else if (e.parameter) {
      // Query-string fallback
      rawBase64 = e.parameter['base64']   || '';
      mimeType  = e.parameter['mimeType'] || mimeType;
      filename  = e.parameter['filename'] || filename;
    }

    if (!rawBase64) {
      throw new Error('No se recibió base64. postData.type=' + (e.postData ? e.postData.type : 'null'));
    }

    // Strip data URI prefix if present
    if (rawBase64.indexOf(',') > -1) rawBase64 = rawBase64.split(',')[1];
    rawBase64 = rawBase64.replace(/\s/g, '');

    var bytes = Utilities.base64Decode(rawBase64);
    var blob  = Utilities.newBlob(bytes, mimeType, filename);

    // Try Advanced Drive API first, fall back to DriveApp
    var file;
    var fileId;
    try {
      // Drive.Files.create (v3 Advanced Service) — requires Drive API enabled in Services
      file   = Drive.Files.create({ name: filename, mimeType: mimeType }, blob);
      fileId = file.id;
    } catch (advErr) {
      // Fall back to DriveApp (v2 basic) — works on personal account scripts
      file   = DriveApp.createFile(blob);
      fileId = file.getId();
    }

    // Make file publicly readable so the web app can show it
    try {
      Drive.Permissions.insert(
        { role: 'reader', type: 'anyone' },
        fileId
      );
    } catch(_) {
      try { DriveApp.getFileById(fileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(_2) {}
    }

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
  return ContentService.createTextOutput(JSON.stringify({
    status:  'online',
    service: 'XPH Drive Upload API — JSON + form-encoded'
  })).setMimeType(ContentService.MimeType.JSON);
}
