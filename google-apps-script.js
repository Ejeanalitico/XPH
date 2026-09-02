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
        if (ssById) return ssById;
      } catch (eId) {
        Logger.log('Spreadsheet openById notice: ' + eId);
      }
    }

    var legacySpreadsheetUrl = XPH_PROPERTIES.getProperty('xph_spreadsheet_url') || '';
    var legacySpreadsheetMatch = legacySpreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (legacySpreadsheetMatch && legacySpreadsheetMatch[1]) {
      try {
        var ssByLegacyUrl = SpreadsheetApp.openById(legacySpreadsheetMatch[1]);
        if (ssByLegacyUrl) return ssByLegacyUrl;
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
    var createdSpreadsheet = false;

    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create(SPREADSHEET_NAME);
      createdSpreadsheet = true;
      var file = DriveApp.getFileById(ss.getId());
      folder.addFile(file);
      try { DriveApp.getRootFolder().removeFile(file); } catch (_) {}
      // La base de datos permanece privada. La web accede únicamente mediante el proxy autenticado.
    }

    if (ss && createdSpreadsheet) initSpreadsheetSheets(ss);
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
      'CRM_Clientes': ['id', 'recordType', 'name', 'phone', 'email', 'eventType', 'eventDate', 'eventLocation', 'packageName', 'totalAmount', 'paidAmount', 'status', 'source', 'firstContactAt', 'lastContactAt', 'nextAction', 'nextActionAt', 'notes', 'contractId', 'createdAt', 'updatedAt', 'honoreeName', 'address', 'eventTime', 'serviceHours', 'campaign', 'objection', 'followUpAttempts', 'suggestedMessage', 'lossReason', 'estimatedCost', 'allocatedAdCost', 'preSessionApplies', 'preSessionDate', 'preSessionTime', 'preSessionLocation', 'inviteClientToCalendar', 'calendarEventId', 'preSessionCalendarEventId', 'eventId', 'preSessionType', 'preSessionEndTime', 'preSessionAddress', 'preSessionStatus', 'preSessionNotes', 'calendarSyncStatus', 'calendarSyncedAt', 'calendarSyncError', 'reminder7DaysSent', 'reminder1DaySent', 'internalNotes', 'providerNotes'],
      'Seguimientos_CRM': ['id', 'prospectId', 'clientId', 'occurredAt', 'conversation', 'result', 'nextAction', 'nextActionAt', 'createdBy', 'createdAt'],
      'Gastos': ['id', 'date', 'category', 'subcategory', 'concept', 'supplier', 'paymentMethod', 'paymentStatus', 'amount', 'notes', 'createdAt', 'updatedAt', 'relatedClientId', 'receiptReference', 'account'],
      'Pagos_Clientes': ['id', 'clientId', 'contractId', 'transactionId', 'date', 'dueDate', 'concept', 'plannedAmount', 'receivedAmount', 'status', 'method', 'reference', 'notes', 'receiptFileId', 'receiptFileName', 'createdAt', 'updatedAt', 'installmentNumber', 'percentage', 'paidAt', 'recordedBy'],
      'Movimientos_Financieros': ['id', 'paymentId', 'clientId', 'type', 'amount', 'status', 'date', 'concept', 'method', 'reference', 'createdAt', 'updatedAt'],
      'Ajustes_Financieros': ['id', 'date', 'category', 'concept', 'amount', 'notes', 'status', 'createdBy', 'createdAt', 'updatedAt'],
      'Paquetes_Cliente': ['id', 'clientId', 'eventId', 'packageId', 'category', 'packageName', 'basePrice', 'discount', 'promotion', 'finalTotal', 'originalJson', 'status', 'createdAt', 'updatedAt'],
      'Servicios_Contratados': ['id', 'clientId', 'eventId', 'packageSnapshotId', 'source', 'concept', 'included', 'quantity', 'unitPrice', 'total', 'date', 'notes', 'status', 'createdAt', 'updatedAt'],
      'Adicionales_Cliente': ['id', 'clientId', 'eventId', 'concept', 'quantity', 'unitPrice', 'total', 'date', 'notes', 'status', 'createdAt', 'updatedAt'],
      'Usuarios_CRM': ['id', 'name', 'lastName', 'displayName', 'email', 'phone', 'functionId', 'functionName', 'role', 'status', 'permissionsJson', 'notes', 'googleConnected', 'googleSubject', 'googleEmail', 'calendarConnected', 'createdAt', 'updatedAt'],
      'Funciones_Equipo': ['id', 'name', 'status', 'createdAt', 'updatedAt'],
      'Invitaciones_Usuarios': ['id', 'userId', 'email', 'tokenHash', 'expiresAt', 'status', 'createdAt', 'usedAt'],
      'Asignaciones_Equipo': ['id', 'clientId', 'eventId', 'userId', 'functionName', 'activityType', 'startDate', 'startTime', 'endDate', 'endTime', 'notes', 'status', 'calendarEventId', 'syncStatus', 'createdAt', 'updatedAt', 'scheduleSource'],
      'Gmail_Config': ['id', 'enabled', 'connectedEmail', 'senderName', 'replyTo', 'signatureHtml', 'logoFileId', 'autoPaymentReceived', 'autoPaymentDue', 'autoEventReminders', 'updatedAt'],
      'Plantillas_Email': ['id', 'name', 'subject', 'htmlBody', 'status', 'updatedAt'],
      'Historial_Correos': ['id', 'clientId', 'prospectId', 'sentAt', 'recipient', 'subject', 'templateId', 'status', 'userId', 'mode', 'gmailMessageId', 'error'],
      'Notificaciones_CRM': ['id', 'type', 'title', 'message', 'relatedId', 'userId', 'status', 'dueAt', 'dedupeKey', 'createdAt', 'updatedAt'],
      'Galerias_Clientes': ['id', 'clientId', 'eventId', 'title', 'slug', 'accessToken', 'rootFolderId', 'photosFolderId', 'folderUrl', 'galleryUrl', 'status', 'createdAt', 'updatedAt'],
      'Eventos_Internos': ['id', 'title', 'activityType', 'startDate', 'startTime', 'endDate', 'endTime', 'location', 'notes', 'visibility', 'userIdsJson', 'status', 'calendarEventId', 'syncStatus', 'createdAt', 'updatedAt'],
      'Contratos': ['id', 'clientId', 'clientName', 'folio', 'eventType', 'eventDate', 'status', 'originalFileName', 'originalFileId', 'clientSignedFileId', 'finalFileId', 'signatureFileId', 'tokenHash', 'tokenExpiresAt', 'tokenStatus', 'sentAt', 'viewedAt', 'acceptedAt', 'clientSignedAt', 'ownerAuthorizedAt', 'documentHash', 'signedDocumentHash', 'finalDocumentHash', 'signerIp', 'signerUserAgent', 'consentText', 'createdAt', 'updatedAt', 'documentType', 'templateVersion', 'documentJson', 'paymentPolicy', 'adminReviewUsed', 'clientOpenCount', 'maxClientOpens', 'clientSessionIdsJson', 'identificationFileId', 'identificationFileName', 'identificationUploadedAt'],
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
      clearBusinessRecordCache('Historial_Auditoria');
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
  clients: ['id', 'recordType', 'name', 'phone', 'email', 'eventType', 'eventDate', 'eventLocation', 'packageName', 'totalAmount', 'paidAmount', 'status', 'source', 'firstContactAt', 'lastContactAt', 'nextAction', 'nextActionAt', 'notes', 'contractId', 'createdAt', 'updatedAt', 'honoreeName', 'address', 'eventTime', 'serviceHours', 'campaign', 'objection', 'followUpAttempts', 'suggestedMessage', 'lossReason', 'estimatedCost', 'allocatedAdCost', 'preSessionApplies', 'preSessionDate', 'preSessionTime', 'preSessionLocation', 'inviteClientToCalendar', 'calendarEventId', 'preSessionCalendarEventId', 'eventId', 'preSessionType', 'preSessionEndTime', 'preSessionAddress', 'preSessionStatus', 'preSessionNotes', 'calendarSyncStatus', 'calendarSyncedAt', 'calendarSyncError', 'reminder7DaysSent', 'reminder1DaySent', 'internalNotes', 'providerNotes'],
  followUps: ['id', 'prospectId', 'clientId', 'occurredAt', 'conversation', 'result', 'nextAction', 'nextActionAt', 'createdBy', 'createdAt'],
  expenses: ['id', 'date', 'category', 'subcategory', 'concept', 'supplier', 'paymentMethod', 'paymentStatus', 'amount', 'notes', 'createdAt', 'updatedAt', 'relatedClientId', 'receiptReference', 'account'],
  payments: ['id', 'clientId', 'contractId', 'transactionId', 'date', 'dueDate', 'concept', 'plannedAmount', 'receivedAmount', 'status', 'method', 'reference', 'notes', 'receiptFileId', 'receiptFileName', 'createdAt', 'updatedAt', 'installmentNumber', 'percentage', 'paidAt', 'recordedBy'],
  transactions: ['id', 'paymentId', 'clientId', 'type', 'amount', 'status', 'date', 'concept', 'method', 'reference', 'createdAt', 'updatedAt'],
  adjustments: ['id', 'date', 'category', 'concept', 'amount', 'notes', 'status', 'createdBy', 'createdAt', 'updatedAt'],
  packageSnapshots: ['id', 'clientId', 'eventId', 'packageId', 'category', 'packageName', 'basePrice', 'discount', 'promotion', 'finalTotal', 'originalJson', 'status', 'createdAt', 'updatedAt'],
  services: ['id', 'clientId', 'eventId', 'packageSnapshotId', 'source', 'concept', 'included', 'quantity', 'unitPrice', 'total', 'date', 'notes', 'status', 'createdAt', 'updatedAt'],
  addons: ['id', 'clientId', 'eventId', 'concept', 'quantity', 'unitPrice', 'total', 'date', 'notes', 'status', 'createdAt', 'updatedAt'],
  users: ['id', 'name', 'lastName', 'displayName', 'email', 'phone', 'functionId', 'functionName', 'role', 'status', 'permissionsJson', 'notes', 'googleConnected', 'googleSubject', 'googleEmail', 'calendarConnected', 'createdAt', 'updatedAt'],
  teamFunctions: ['id', 'name', 'status', 'createdAt', 'updatedAt'],
  invitations: ['id', 'userId', 'email', 'tokenHash', 'expiresAt', 'status', 'createdAt', 'usedAt'],
  assignments: ['id', 'clientId', 'eventId', 'userId', 'functionName', 'activityType', 'startDate', 'startTime', 'endDate', 'endTime', 'notes', 'status', 'calendarEventId', 'syncStatus', 'createdAt', 'updatedAt', 'scheduleSource'],
  gmailConfig: ['id', 'enabled', 'connectedEmail', 'senderName', 'replyTo', 'signatureHtml', 'logoFileId', 'autoPaymentReceived', 'autoPaymentDue', 'autoEventReminders', 'updatedAt'],
  emailTemplates: ['id', 'name', 'subject', 'htmlBody', 'status', 'updatedAt'],
  emailHistory: ['id', 'clientId', 'prospectId', 'sentAt', 'recipient', 'subject', 'templateId', 'status', 'userId', 'mode', 'gmailMessageId', 'error'],
  notifications: ['id', 'type', 'title', 'message', 'relatedId', 'userId', 'status', 'dueAt', 'dedupeKey', 'createdAt', 'updatedAt'],
  galleries: ['id', 'clientId', 'eventId', 'title', 'slug', 'accessToken', 'rootFolderId', 'photosFolderId', 'folderUrl', 'galleryUrl', 'status', 'createdAt', 'updatedAt'],
  internalEvents: ['id', 'title', 'activityType', 'startDate', 'startTime', 'endDate', 'endTime', 'location', 'notes', 'visibility', 'userIdsJson', 'status', 'calendarEventId', 'syncStatus', 'createdAt', 'updatedAt'],
  contracts: ['id', 'clientId', 'clientName', 'folio', 'eventType', 'eventDate', 'status', 'originalFileName', 'originalFileId', 'clientSignedFileId', 'finalFileId', 'signatureFileId', 'tokenHash', 'tokenExpiresAt', 'tokenStatus', 'sentAt', 'viewedAt', 'acceptedAt', 'clientSignedAt', 'ownerAuthorizedAt', 'documentHash', 'signedDocumentHash', 'finalDocumentHash', 'signerIp', 'signerUserAgent', 'consentText', 'createdAt', 'updatedAt', 'documentType', 'templateVersion', 'documentJson', 'paymentPolicy', 'adminReviewUsed', 'clientOpenCount', 'maxClientOpens', 'clientSessionIdsJson', 'identificationFileId', 'identificationFileName', 'identificationUploadedAt'],
  ownerSignature: ['id', 'fileId', 'updatedAt']
};

var BUSINESS_SCHEMA_VERSION = '2026-09-02-contract-document-v1';
var BUSINESS_RECORD_CACHE_TTL_SECONDS = 21600;

function businessSchemaPropertyKey(ss) {
  return 'xph_business_schema_' + String(ss && ss.getId ? ss.getId() : 'default');
}

function businessRecordCacheKey(sheetName) {
  return 'xph_records_v3_' + String(sheetName || '').replace(/[^A-Za-z0-9_]/g, '_');
}

function cacheBusinessRecords(sheetName, records) {
  try { CacheService.getScriptCache().put(businessRecordCacheKey(sheetName), JSON.stringify(records || []), BUSINESS_RECORD_CACHE_TTL_SECONDS); }
  catch (_) { clearBusinessRecordCache(sheetName); }
}

function updateCachedBusinessRecord(sheetName, record) {
  try {
    var cache = CacheService.getScriptCache();
    var key = businessRecordCacheKey(sheetName);
    var raw = cache.get(key);
    if (raw === null) return;
    var records = JSON.parse(raw);
    var index = records.findIndex(function(item) { return String(item.id) === String(record.id); });
    if (index >= 0) records[index] = record;
    else records.push(record);
    cacheBusinessRecords(sheetName, records);
  } catch (_) { clearBusinessRecordCache(sheetName); }
}

function clearBusinessRecordCache(sheetName) {
  try { CacheService.getScriptCache().remove(businessRecordCacheKey(sheetName)); } catch (_) {}
}

function clearBusinessSnapshotCaches() {
  ['CRM_Clientes','Seguimientos_CRM','Gastos','Pagos_Clientes','Movimientos_Financieros','Ajustes_Financieros','Paquetes_Cliente','Servicios_Contratados','Adicionales_Cliente','Usuarios_CRM','Funciones_Equipo','Invitaciones_Usuarios','Asignaciones_Equipo','Gmail_Config','Plantillas_Email','Historial_Correos','Notificaciones_CRM','Galerias_Clientes','Eventos_Internos','Contratos','Firma_Administrador','Historial_Auditoria'].forEach(clearBusinessRecordCache);
}

function ensureBusinessSchema(ss) {
  var schemaKey = businessSchemaPropertyKey(ss);
  var schemaProperties = PropertiesService.getScriptProperties();
  if (schemaProperties.getProperty(schemaKey) === BUSINESS_SCHEMA_VERSION) return;
  var businessSheets = {
    'CRM_Clientes': BUSINESS_HEADERS.clients,
    'Seguimientos_CRM': BUSINESS_HEADERS.followUps,
    'Gastos': BUSINESS_HEADERS.expenses,
    'Pagos_Clientes': BUSINESS_HEADERS.payments,
    'Movimientos_Financieros': BUSINESS_HEADERS.transactions,
    'Ajustes_Financieros': BUSINESS_HEADERS.adjustments,
    'Paquetes_Cliente': BUSINESS_HEADERS.packageSnapshots,
    'Servicios_Contratados': BUSINESS_HEADERS.services,
    'Adicionales_Cliente': BUSINESS_HEADERS.addons,
    'Usuarios_CRM': BUSINESS_HEADERS.users,
    'Funciones_Equipo': BUSINESS_HEADERS.teamFunctions,
    'Invitaciones_Usuarios': BUSINESS_HEADERS.invitations,
    'Asignaciones_Equipo': BUSINESS_HEADERS.assignments,
    'Gmail_Config': BUSINESS_HEADERS.gmailConfig,
    'Plantillas_Email': BUSINESS_HEADERS.emailTemplates,
    'Historial_Correos': BUSINESS_HEADERS.emailHistory,
    'Notificaciones_CRM': BUSINESS_HEADERS.notifications,
    'Galerias_Clientes': BUSINESS_HEADERS.galleries,
    'Eventos_Internos': BUSINESS_HEADERS.internalEvents,
    'Contratos': BUSINESS_HEADERS.contracts,
    'Firma_Administrador': BUSINESS_HEADERS.ownerSignature
  };
  Object.keys(businessSheets).forEach(function(sheetName) {
    var headers = businessSheets[sheetName];
    var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#161C28')
      .setFontColor('#D4AF37')
      .setFontWeight('bold')
      .setFontFamily('Arial');
    sheet.setFrozenRows(1);
  });
  var templateSheet = ss.getSheetByName('Plantillas_Email');
  if (templateSheet && templateSheet.getLastRow() < 2) {
    var templateNow = new Date().toISOString();
    [
      ['bienvenida', 'Bienvenida', 'Bienvenido(a) a XPH, {{cliente_nombre}}', '<p>Hola {{cliente_nombre}},</p><p>Gracias por confiar en XPH Fotografía & Video.</p>'],
      ['cotizacion', 'Cotización', 'Tu cotización XPH para {{evento_tipo}}', '<p>Hola {{cliente_nombre}},</p><p>Te compartimos la información de tu {{evento_tipo}} del {{evento_fecha}}.</p>'],
      ['seguimiento', 'Seguimiento', 'Seguimiento de tu evento con XPH', '<p>Hola {{cliente_nombre}},</p><p>Queremos dar seguimiento a tu solicitud. Estamos para ayudarte.</p>'],
      ['contrato-listo', 'Contrato listo', 'Tu contrato XPH está listo', '<p>Hola {{cliente_nombre}},</p><p>Puedes revisar tu contrato aquí: {{contrato_url}}</p>'],
      ['pago-recibido', 'Pago recibido', 'Confirmación de pago recibido', '<p>Hola {{cliente_nombre}},</p><p>Confirmamos el pago de {{monto_pago}} recibido el {{fecha_pago}}.</p><p>Saldo pendiente: {{saldo_pendiente}}</p>'],
      ['pago-proximo', 'Pago próximo', 'Recordatorio de próximo pago XPH', '<p>Hola {{cliente_nombre}},</p><p>Tu próximo pago de {{monto_pago}} está programado para {{fecha_pago}}.</p>'],
      ['pago-vencido', 'Pago vencido', 'Seguimiento de pago pendiente XPH', '<p>Hola {{cliente_nombre}},</p><p>El pago de {{monto_pago}} con fecha {{fecha_pago}} continúa pendiente.</p>'],
      ['recordatorio-evento', 'Recordatorio de evento', 'Recordatorio de tu {{evento_tipo}}', '<p>Hola {{cliente_nombre}},</p><p>Tu evento es el {{evento_fecha}} a las {{evento_hora}} en {{evento_lugar}}.</p>'],
      ['sesion-previa', 'Sesión previa', 'Información de tu sesión previa', '<p>Hola {{cliente_nombre}},</p><p>Tu sesión previa está programada para {{evento_fecha}} a las {{evento_hora}} en {{evento_lugar}}.</p>'],
      ['galeria-lista', 'Galería lista', 'Tu galería XPH está lista', '<p>Hola {{cliente_nombre}},</p><p>Ya puedes abrir tu galería: {{galeria_url}}</p>'],
      ['entrega-final', 'Entrega final', 'Entrega final de tu evento XPH', '<p>Hola {{cliente_nombre}},</p><p>La entrega final de tu evento está lista. Gracias por permitirnos acompañarte.</p>']
    ].forEach(function(template) { templateSheet.appendRow([template[0], template[1], template[2], template[3], 'ACTIVA', templateNow]); });
  }
  var gmailSheet = ss.getSheetByName('Gmail_Config');
  if (gmailSheet && gmailSheet.getLastRow() < 2) gmailSheet.appendRow(['xph-gmail', false, '', 'XPH Fotografía & Video', '', '<p>XPH Fotografía & Video</p>', '', false, false, false, new Date().toISOString()]);
  schemaProperties.setProperty(schemaKey, BUSINESS_SCHEMA_VERSION);
  clearBusinessSnapshotCaches();
}

function businessBoolean(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
}

function publicGmailConfig(record) {
  if (!record) return null;
  return {
    id: record.id || 'xph-gmail',
    enabled: businessBoolean(record.enabled),
    connectedEmail: record.connectedEmail || '',
    senderName: record.senderName || 'XPH Fotografía & Video',
    replyTo: record.replyTo || '',
    signatureHtml: record.signatureHtml || '',
    logoFileId: record.logoFileId || '',
    logoUrl: record.logoFileId ? 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(record.logoFileId) : '',
    autoPaymentReceived: businessBoolean(record.autoPaymentReceived),
    autoPaymentDue: businessBoolean(record.autoPaymentDue),
    autoEventReminders: businessBoolean(record.autoEventReminders),
    updatedAt: record.updatedAt || ''
  };
}

function getGmailConfigRecord(ss) {
  var configs = readBusinessRecords(ss, 'Gmail_Config', BUSINESS_HEADERS.gmailConfig);
  return configs.length ? configs[0] : null;
}

function escapeEmailHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function emailPlainText(html) {
  return String(html || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').trim();
}

function interpolateEmailTemplate(text, variables) {
  return String(text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function(_, key) {
    return variables && variables[key] !== undefined ? escapeEmailHtml(variables[key]) : '';
  });
}

function clientEmailVariables(client, extras) {
  var values = {
    cliente_nombre: client && client.name || '',
    evento_fecha: client && client.eventDate || '',
    evento_hora: client && client.eventTime || 'Horario pendiente',
    evento_tipo: client && client.eventType || 'evento',
    evento_lugar: client && client.eventLocation || '',
    saldo_pendiente: '$' + Math.max(0, Number(client && client.totalAmount || 0) - Number(client && client.paidAmount || 0)).toFixed(2),
    monto_pago: '', fecha_pago: '', galeria_url: '', contrato_url: ''
  };
  Object.keys(extras || {}).forEach(function(key) { values[key] = extras[key]; });
  return values;
}

function wrapXphEmail(bodyHtml, config, hasInlineLogo) {
  var closing = config.signatureHtml || '<p>Con aprecio,<br><strong>Equipo XPH Fotografía &amp; Video</strong></p>';
  var signatureImage = hasInlineLogo
    ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding-top:20px">' +
      '<img src="cid:xphLogo" alt="Firma de XPH Fotografía &amp; Video" width="420" style="display:block;width:100%;max-width:420px;height:auto;border:0;margin:0 auto">' +
      '</td></tr></table>'
    : '';

  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>@media only screen and (max-width:620px){.xph-wrap{padding:14px 8px!important}.xph-pad{padding:28px 22px!important}.xph-header{padding:26px 22px!important}.xph-title{font-size:23px!important}.xph-copy{font-size:16px!important}.xph-signature{padding:18px 0 0!important}}.xph-copy p{margin:0 0 18px!important}.xph-closing p{margin:0 0 8px!important}</style></head>' +
    '<body style="margin:0;padding:0;background:#f2efe8;font-family:Arial,Helvetica,sans-serif;color:#171717">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f2efe8"><tr><td class="xph-wrap" align="center" style="padding:30px 12px">' +
    '<table class="xph-shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #ded8ca;border-collapse:separate">' +
    '<tr><td height="6" bgcolor="#D4AF37" style="height:6px;background:#D4AF37;font-size:0;line-height:0">&nbsp;</td></tr>' +
    '<tr><td class="xph-header" bgcolor="#0B0F17" style="padding:30px 40px;background:#0B0F17">' +
    '<div style="font-size:11px;line-height:16px;font-weight:bold;letter-spacing:2.4px;color:#D4AF37;text-transform:uppercase">XPH Fotografía &amp; Video</div>' +
    '<div class="xph-title" style="margin-top:7px;font-family:Georgia,Times New Roman,serif;font-size:27px;line-height:34px;color:#ffffff">Historias que permanecen</div>' +
    '<div style="margin-top:10px;font-size:12px;line-height:18px;color:#b8bec9">Fotografía · Video · Producción audiovisual&nbsp;&nbsp;|&nbsp;&nbsp;www.xaviph.com</div>' +
    '</td></tr>' +
    '<tr><td class="xph-pad" style="padding:38px 42px 34px">' +
    '<div class="xph-copy" style="font-size:17px;line-height:1.7;color:#20242c">' + bodyHtml + '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:30px;border-top:2px solid #D4AF37"><tr><td style="padding-top:18px">' +
    '<div style="font-size:10px;line-height:15px;font-weight:bold;letter-spacing:1.8px;color:#A88416;text-transform:uppercase">Con aprecio</div>' +
    '<div class="xph-closing" style="margin-top:8px;font-size:13px;line-height:1.6;color:#666b73">' + closing + '</div>' +
    '</td></tr></table>' +
    '<div class="xph-signature" style="padding:18px 0 0">' + signatureImage + '</div>' +
    '</td></tr></table>' +
    '</td></tr></table></body></html>';
}

function findEmailTemplate(ss, templateId) {
  var templates = readBusinessRecords(ss, 'Plantillas_Email', BUSINESS_HEADERS.emailTemplates);
  for (var i = 0; i < templates.length; i++) if (String(templates[i].id) === String(templateId)) return templates[i];
  return null;
}

function sendCrmTemplateEmail(ss, input) {
  var config = getGmailConfigRecord(ss);
  if (!config || !businessBoolean(config.enabled)) throw new Error('Gmail está desconectado en la configuración del CRM.');
  var recipient = cleanBusinessText(input.recipient, 180).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(recipient)) throw new Error('El destinatario no tiene un correo válido.');
  var template = findEmailTemplate(ss, input.templateId);
  if (!template || String(template.status) !== 'ACTIVA') throw new Error('La plantilla de correo no está activa.');
  var historyId = cleanBusinessText(input.historyId || businessId('correo'), 180);
  var existingHistory = findBusinessRecord(ss, 'Historial_Correos', BUSINESS_HEADERS.emailHistory, historyId);
  if (existingHistory && String(existingHistory.status) === 'ENVIADO') return existingHistory;
  var subject = interpolateEmailTemplate(template.subject, input.variables || {});
  var body = interpolateEmailTemplate(template.htmlBody, input.variables || {});
  var inlineImages = {};
  if (config.logoFileId) {
    try { inlineImages.xphLogo = DriveApp.getFileById(config.logoFileId).getBlob(); } catch (_) {}
  }
  var history = {
    id: historyId,
    clientId: cleanBusinessText(input.clientId, 120),
    prospectId: cleanBusinessText(input.prospectId, 120),
    sentAt: businessNow(),
    recipient: recipient,
    subject: subject,
    templateId: template.id,
    status: 'ENVIADO',
    userId: cleanBusinessText(input.userId || 'xph-super-admin', 120),
    mode: input.mode === 'AUTOMATICO' ? 'AUTOMATICO' : 'MANUAL',
    gmailMessageId: '', error: ''
  };
  try {
    var options = { htmlBody: wrapXphEmail(body, config, Boolean(inlineImages.xphLogo)), name: config.senderName || 'XPH Fotografía & Video' };
    if (config.replyTo) options.replyTo = config.replyTo;
    if (inlineImages.xphLogo) options.inlineImages = inlineImages;
    GmailApp.sendEmail(recipient, subject, emailPlainText(body), options);
  } catch (error) {
    history.status = 'ERROR';
    history.error = cleanBusinessText(error && error.message || error, 1000);
    upsertBusinessRecord(ss, 'Historial_Correos', BUSINESS_HEADERS.emailHistory, history);
    throw error;
  }
  upsertBusinessRecord(ss, 'Historial_Correos', BUSINESS_HEADERS.emailHistory, history);
  logAudit(ss, 'CORREO_CRM_ENVIADO', { recipient: recipient, subject: subject, templateId: template.id, mode: history.mode }, history.id, history.userId);
  return history;
}

function upsertCrmNotification(ss, input) {
  var dedupeKey = cleanBusinessText(input.dedupeKey, 240);
  var records = readBusinessRecords(ss, 'Notificaciones_CRM', BUSINESS_HEADERS.notifications);
  var existing = null;
  for (var i = 0; i < records.length; i++) if (dedupeKey && String(records[i].dedupeKey) === dedupeKey) { existing = records[i]; break; }
  var timestamp = businessNow();
  var notification = {
    id: existing && existing.id || businessId('notificacion'),
    type: cleanBusinessText(input.type, 80), title: cleanBusinessText(input.title, 240), message: cleanBusinessText(input.message, 1000),
    relatedId: cleanBusinessText(input.relatedId, 120), userId: cleanBusinessText(input.userId || 'xph-super-admin', 120),
    status: existing && ['LEIDA', 'RESUELTA'].indexOf(String(existing.status)) >= 0 ? existing.status : cleanBusinessText(input.status || 'PENDIENTE', 30),
    dueAt: cleanBusinessText(input.dueAt, 50), dedupeKey: dedupeKey,
    createdAt: existing && existing.createdAt || timestamp, updatedAt: timestamp
  };
  upsertBusinessRecord(ss, 'Notificaciones_CRM', BUSINESS_HEADERS.notifications, notification);
  return notification;
}

function dayDifference(dateValue, todayValue) {
  if (!dateValue) return null;
  var target = calendarDateOnly(normalizeBusinessDate(dateValue));
  var base = calendarDateOnly(normalizeBusinessDate(todayValue));
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

function processCrmRemindersInternal(ss) {
  ensureBusinessSchema(ss);
  var timezone = ss.getSpreadsheetTimeZone() || businessCalendarTimeZone();
  var todayValue = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');
  var clients = readBusinessRecords(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients);
  var payments = readBusinessRecords(ss, 'Pagos_Clientes', BUSINESS_HEADERS.payments);
  var assignments = readBusinessRecords(ss, 'Asignaciones_Equipo', BUSINESS_HEADERS.assignments);
  var config = getGmailConfigRecord(ss);
  var notificationsCreated = 0;
  var emailsSent = 0;
  clients.forEach(function(client) {
    if (String(client.recordType) === 'Prospecto') {
      if (!client.nextActionAt) return;
      var followDate = normalizeBusinessDate(client.nextActionAt);
      var followDiff = dayDifference(followDate, todayValue);
      if (followDiff !== null && followDiff <= 0) {
        upsertCrmNotification(ss, { type: followDiff < 0 ? 'SEGUIMIENTO_VENCIDO' : 'SEGUIMIENTO_HOY', title: followDiff < 0 ? 'Seguimiento vencido' : 'Seguimiento de hoy', message: (client.name || 'Prospecto') + ' · ' + (client.nextAction || 'Contactar'), relatedId: client.id, dueAt: client.nextActionAt, dedupeKey: 'seguimiento-' + client.id + '-' + followDate });
        notificationsCreated++;
      }
      return;
    }
    if (businessBoolean(client.preSessionApplies) && !client.preSessionDate && String(client.preSessionStatus) !== 'Cancelada') {
      upsertCrmNotification(ss, { type: 'SESION_SIN_PROGRAMAR', title: 'Sesión pendiente por agendar', message: client.name || 'Cliente', relatedId: client.id, dedupeKey: 'sesion-sin-fecha-' + client.id });
      notificationsCreated++;
    }
    if (client.eventDate && !assignments.some(function(item) { return String(item.clientId) === String(client.id) && String(item.status) !== 'CANCELADA'; })) {
      upsertCrmNotification(ss, { type: 'PERSONAL_SIN_ASIGNAR', title: 'Personal sin asignar', message: (client.name || 'Cliente') + ' · ' + (client.eventType || 'Evento'), relatedId: client.id, dueAt: client.eventDate, dedupeKey: 'personal-sin-asignar-' + client.id + '-' + client.eventDate });
      notificationsCreated++;
    }
    if (String(client.calendarSyncStatus) === 'Error') {
      upsertCrmNotification(ss, { type: 'ERROR_CALENDAR', title: 'Error de sincronización Google', message: (client.name || 'Cliente') + ' · ' + (client.calendarSyncError || 'Reintenta la sincronización.'), relatedId: client.id, dedupeKey: 'calendar-error-' + client.id + '-' + String(client.updatedAt || '') });
      notificationsCreated++;
    }
    var eventDiff = dayDifference(client.eventDate, todayValue);
    if (eventDiff === 7 || eventDiff === 1) {
      var eventKey = eventDiff === 7 ? '7-dias' : '1-dia';
      upsertCrmNotification(ss, { type: eventDiff === 7 ? 'EVENTO_7_DIAS' : 'EVENTO_1_DIA', title: eventDiff === 7 ? 'Evento en 7 días' : 'Evento mañana', message: (client.name || 'Cliente') + ' · ' + (client.eventType || 'Evento') + ' · ' + (client.eventLocation || 'Lugar pendiente'), relatedId: client.id, dueAt: client.eventDate, dedupeKey: 'evento-' + eventKey + '-' + client.id + '-' + client.eventDate });
      notificationsCreated++;
      if (config && businessBoolean(config.autoEventReminders) && client.email) {
        try {
          sendCrmTemplateEmail(ss, { recipient: client.email, clientId: client.id, templateId: 'recordatorio-evento', variables: clientEmailVariables(client), mode: 'AUTOMATICO', historyId: 'correo-evento-' + eventKey + '-' + client.id + '-' + client.eventDate });
          emailsSent++;
          if (eventDiff === 7) client.reminder7DaysSent = true;
          else client.reminder1DaySent = true;
          client.updatedAt = businessNow();
          upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, client);
        } catch (_) {}
      }
    }
  });
  payments.forEach(function(payment) {
    if (String(payment.status) !== 'Pendiente' && String(payment.status) !== 'Parcial') return;
    var remaining = Math.max(0, Number(payment.plannedAmount || 0) - Number(payment.receivedAmount || 0));
    var paymentClient = clients.find(function(client) { return String(client.id) === String(payment.clientId); });
    if (!remaining || !payment.dueDate || !paymentClient) return;
    var dueDiff = dayDifference(payment.dueDate, todayValue);
    if (dueDiff === null || dueDiff > 3) return;
    var overdue = dueDiff < 0;
    var paymentType = overdue ? 'PAGO_VENCIDO' : 'PAGO_PROXIMO';
    var dueKey = (overdue ? 'pago-vencido-' : 'pago-proximo-') + payment.id + '-' + payment.dueDate;
    upsertCrmNotification(ss, { type: paymentType, title: overdue ? 'Pago vencido' : 'Pago próximo', message: (paymentClient.name || 'Cliente') + ' · $' + remaining.toFixed(2) + ' · ' + payment.dueDate, relatedId: payment.id, dueAt: payment.dueDate, dedupeKey: dueKey });
    notificationsCreated++;
    if (config && businessBoolean(config.autoPaymentDue) && paymentClient.email) {
      try {
        sendCrmTemplateEmail(ss, { recipient: paymentClient.email, clientId: paymentClient.id, templateId: overdue ? 'pago-vencido' : 'pago-proximo', variables: clientEmailVariables(paymentClient, { monto_pago: '$' + remaining.toFixed(2), fecha_pago: payment.dueDate }), mode: 'AUTOMATICO', historyId: 'correo-' + dueKey });
        emailsSent++;
      } catch (_) {}
    }
  });
  return { status: 'success', notificationsProcessed: notificationsCreated, emailsProcessed: emailsSent, processedAt: businessNow() };
}

function processCrmReminders() {
  var ss = getDatabaseSpreadsheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return processCrmRemindersInternal(ss); } finally { lock.releaseLock(); }
}

function installCrmReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'processCrmReminders') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('processCrmReminders').timeBased().everyHours(6).create();
  return { status: 'success' };
}

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
  try {
    var cachedRecords = CacheService.getScriptCache().get(businessRecordCacheKey(sheetName));
    if (cachedRecords !== null) return JSON.parse(cachedRecords);
  } catch (_) {}
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    cacheBusinessRecords(sheetName, []);
    return [];
  }
  var timeZone = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/Mexico_City';
  var dateHeaders = { eventDate: true, preSessionDate: true, date: true, dueDate: true };
  var timeHeaders = { eventTime: true, preSessionTime: true };
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var records = values.filter(function(row) { return cleanBusinessText(row[0], 200) !== ''; }).map(function(row) {
    var record = {};
    headers.forEach(function(header, index) {
      var value = row[index];
      if (value === undefined || value === null) value = '';
      if (value instanceof Date && !isNaN(value.getTime())) {
        if (dateHeaders[header]) value = Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
        else if (timeHeaders[header]) value = Utilities.formatDate(value, timeZone, 'HH:mm');
      }
      record[header] = value;
    });
    return record;
  });
  cacheBusinessRecords(sheetName, records);
  return records;
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
  updateCachedBusinessRecord(sheetName, record);
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

function getPaymentReceiptsFolder() {
  var parent;
  try { parent = DriveApp.getFolderById(FOLDER_ID); } catch (_) { parent = DriveApp.getRootFolder(); }
  var folders = parent.getFoldersByName('Comprobantes_Pagos_XPH');
  return folders.hasNext() ? folders.next() : parent.createFolder('Comprobantes_Pagos_XPH');
}

function getEmailAssetsFolder() {
  var parent;
  try { parent = DriveApp.getFolderById(FOLDER_ID); } catch (_) { parent = DriveApp.getRootFolder(); }
  var folders = parent.getFoldersByName('Recursos_Correo_XPH');
  return folders.hasNext() ? folders.next() : parent.createFolder('Recursos_Correo_XPH');
}

function getClientGalleriesFolder() {
  var parent;
  try { parent = DriveApp.getFolderById(FOLDER_ID); } catch (_) { parent = DriveApp.getRootFolder(); }
  var folders = parent.getFoldersByName('Galerías');
  return folders.hasNext() ? folders.next() : parent.createFolder('Galerías');
}

function safeDriveFolderName(value) {
  return cleanBusinessText(value, 180).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'Galería XPH';
}

function createClientGalleryRecord(ss, payload) {
  var client = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, payload.clientId);
  if (!client || String(client.recordType) !== 'Cliente') throw new Error('Selecciona un cliente válido para crear la galería.');
  client.eventId = client.eventId || businessId('evento');
  var records = readBusinessRecords(ss, 'Galerias_Clientes', BUSINESS_HEADERS.galleries);
  var existing = records.find(function(item) { return String(item.clientId) === String(client.id) && String(item.eventId || '') === String(client.eventId || '') && String(item.status) !== 'ARCHIVADA'; });
  if (existing) return { status: 'success', gallery: existing, created: false };
  var timestamp = businessNow();
  var title = cleanBusinessText(payload.title || ((client.name || 'Cliente') + ' - ' + (client.eventType || 'Evento') + (client.eventDate ? ' ' + client.eventDate : '')), 240);
  var rootFolder = getClientGalleriesFolder().createFolder(safeDriveFolderName(title));
  var photosFolder = rootFolder.createFolder('Fotografías');
  var gallery = {
    id: cleanBusinessText(payload.galleryId || businessId('galeria'), 120), clientId: client.id, eventId: client.eventId,
    title: title, slug: cleanBusinessText(payload.slug, 180), accessToken: cleanBusinessText(payload.accessToken, 240),
    rootFolderId: rootFolder.getId(), photosFolderId: photosFolder.getId(), folderUrl: rootFolder.getUrl(),
    galleryUrl: cleanBusinessText(payload.galleryUrl, 1000), status: 'ACTIVA', createdAt: timestamp, updatedAt: timestamp
  };
  if (!gallery.slug || !gallery.accessToken || !gallery.galleryUrl) throw new Error('La liga segura de la galería está incompleta.');
  upsertBusinessRecord(ss, 'Galerias_Clientes', BUSINESS_HEADERS.galleries, gallery);
  upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, client);
  var config = {};
  try { var raw = loadActiveConfig(); if (raw) config = JSON.parse(raw); } catch (_) {}
  var items = Array.isArray(config.galleryImages) ? config.galleryImages : [];
  var metaId = 'meta-' + gallery.id;
  if (!items.some(function(item) { return String(item.galleryId) === String(gallery.id) && String(item.mediaType) === 'gallery-meta'; })) {
    items.unshift({ id: metaId, title: gallery.title, category: 'private', url: 'xph://gallery-meta', location: '', visibility: 'private', mediaType: 'gallery-meta', galleryId: gallery.id, gallerySlug: gallery.slug, galleryTitle: gallery.title, galleryClient: client.name || 'Cliente XPH', galleryToken: gallery.accessToken, galleryAllowDownloads: true, clientId: client.id, eventId: client.eventId, driveFolderId: gallery.rootFolderId, createdAt: timestamp });
    config.galleryImages = items;
    saveActiveConfig(ss, JSON.stringify(config));
    syncGalleryTable(ss, items);
  }
  logAudit(ss, 'GALERIA_CLIENTE_CREADA', { clientId: client.id, eventId: client.eventId, folderId: gallery.rootFolderId }, gallery.id, 'Admin XPH');
  return { status: 'success', gallery: gallery, created: true };
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
  var documentSnapshot = null;
  try { documentSnapshot = record.documentJson ? JSON.parse(String(record.documentJson)) : null; } catch (_) {}
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
    documentType: record.documentType || (documentSnapshot && documentSnapshot.documentType) || 'CONTRATO',
    templateVersion: record.templateVersion || '',
    documentSnapshot: documentSnapshot,
    paymentPolicy: record.paymentPolicy || '40-30-30',
    adminReviewUsed: businessBoolean(record.adminReviewUsed),
    clientOpenCount: Number(record.clientOpenCount || 0),
    maxClientOpens: Number(record.maxClientOpens || 2),
    identificationFileName: record.identificationFileName || '',
    identificationUploadedAt: record.identificationUploadedAt || '',
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || ''
  };
}

function resolveSigningContract(ss, token, sessionId, countOpen) {
  var hash = tokenHashFromRaw(token);
  var contracts = readBusinessRecords(ss, 'Contratos', BUSINESS_HEADERS.contracts);
  for (var i = 0; i < contracts.length; i++) {
    var contract = contracts[i];
    if (String(contract.tokenHash || '') !== hash) continue;
    if (String(contract.tokenStatus || '') !== 'ACTIVO') throw new Error('La liga ya no está activa.');
    if (!contract.tokenExpiresAt || new Date(contract.tokenExpiresAt).getTime() <= Date.now()) throw new Error('La liga de firma ha caducado.');
    if (['Firmado por cliente', 'Finalizado', 'Cancelado'].indexOf(String(contract.status || '')) >= 0) throw new Error('El contrato ya no admite esta firma.');
    if (countOpen && contract.documentJson) {
      var safeSessionId = cleanBusinessText(sessionId, 120);
      if (!safeSessionId) throw new Error('No se pudo validar esta sesión. Vuelve a abrir la liga.');
      var sessionIds = [];
      try { sessionIds = JSON.parse(String(contract.clientSessionIdsJson || '[]')); } catch (_) {}
      if (sessionIds.indexOf(safeSessionId) < 0) {
        var maxOpens = Math.max(1, Number(contract.maxClientOpens || 2));
        if (sessionIds.length >= maxOpens) throw new Error('Esta liga ya no está disponible. Solicita una nueva a Javier.');
        sessionIds.push(safeSessionId);
        contract.clientSessionIdsJson = JSON.stringify(sessionIds);
        contract.clientOpenCount = sessionIds.length;
        contract.updatedAt = businessNow();
        upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, contract);
        logAudit(ss, 'CONTRATO_ABIERTO_CLIENTE', contract.folio + ' | acceso ' + sessionIds.length, contract.id, contract.clientName);
      }
    }
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
    eventDate: normalizeBusinessDate(input.eventDate !== undefined ? input.eventDate : current.eventDate),
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
    internalNotes: cleanBusinessText(input.internalNotes !== undefined ? input.internalNotes : current.internalNotes, 6000),
    providerNotes: cleanBusinessText(input.providerNotes !== undefined ? input.providerNotes : current.providerNotes, 6000),
    contractId: cleanBusinessText(input.contractId !== undefined ? input.contractId : current.contractId, 120),
    createdAt: cleanBusinessText(current.createdAt || input.createdAt || timestamp, 40),
    updatedAt: timestamp,
    honoreeName: cleanBusinessText(input.honoreeName !== undefined ? input.honoreeName : current.honoreeName, 240),
    address: cleanBusinessText(input.address !== undefined ? input.address : current.address, 600),
    eventTime: normalizeBusinessTime(input.eventTime !== undefined ? input.eventTime : current.eventTime),
    serviceHours: Math.max(0, Math.min(48, Number(input.serviceHours !== undefined ? input.serviceHours : current.serviceHours) || 0)),
    campaign: cleanBusinessText(input.campaign !== undefined ? input.campaign : current.campaign, 200),
    objection: cleanBusinessText(input.objection !== undefined ? input.objection : current.objection, 1000),
    followUpAttempts: Math.max(0, Math.min(100, Math.floor(Number(input.followUpAttempts !== undefined ? input.followUpAttempts : current.followUpAttempts) || 0))),
    suggestedMessage: cleanBusinessText(input.suggestedMessage !== undefined ? input.suggestedMessage : current.suggestedMessage, 4000),
    lossReason: cleanBusinessText(input.lossReason !== undefined ? input.lossReason : current.lossReason, 1000),
    estimatedCost: Math.max(0, Number(input.estimatedCost !== undefined ? input.estimatedCost : current.estimatedCost) || 0),
    allocatedAdCost: Math.max(0, Number(input.allocatedAdCost !== undefined ? input.allocatedAdCost : current.allocatedAdCost) || 0),
    preSessionApplies: input.preSessionApplies !== undefined ? Boolean(input.preSessionApplies) : String(current.preSessionApplies) === 'true',
    preSessionDate: normalizeBusinessDate(input.preSessionDate !== undefined ? input.preSessionDate : current.preSessionDate),
    preSessionTime: normalizeBusinessTime(input.preSessionTime !== undefined ? input.preSessionTime : current.preSessionTime),
    preSessionLocation: cleanBusinessText(input.preSessionLocation !== undefined ? input.preSessionLocation : current.preSessionLocation, 500),
    inviteClientToCalendar: input.inviteClientToCalendar !== undefined ? Boolean(input.inviteClientToCalendar) : String(current.inviteClientToCalendar) === 'true',
    calendarEventId: cleanBusinessText(current.calendarEventId || input.calendarEventId, 240),
    preSessionCalendarEventId: cleanBusinessText(current.preSessionCalendarEventId || input.preSessionCalendarEventId, 240),
    eventId: cleanBusinessText(input.eventId || current.eventId || ((input.recordType || current.recordType) === 'Cliente' ? businessId('evento') : ''), 120),
    preSessionType: cleanBusinessText(input.preSessionType !== undefined ? input.preSessionType : current.preSessionType, 120),
    preSessionEndTime: normalizeBusinessTime(input.preSessionEndTime !== undefined ? input.preSessionEndTime : current.preSessionEndTime),
    preSessionAddress: cleanBusinessText(input.preSessionAddress !== undefined ? input.preSessionAddress : current.preSessionAddress, 600),
    preSessionStatus: cleanBusinessText(input.preSessionStatus || current.preSessionStatus || ((input.preSessionApplies !== undefined ? Boolean(input.preSessionApplies) : String(current.preSessionApplies) === 'true') ? 'Pendiente por agendar' : ''), 80),
    preSessionNotes: cleanBusinessText(input.preSessionNotes !== undefined ? input.preSessionNotes : current.preSessionNotes, 3000),
    calendarSyncStatus: cleanBusinessText(input.calendarSyncStatus || current.calendarSyncStatus || 'Pendiente', 40),
    calendarSyncedAt: cleanBusinessText(current.calendarSyncedAt || input.calendarSyncedAt, 50),
    calendarSyncError: cleanBusinessText(input.calendarSyncError !== undefined ? input.calendarSyncError : current.calendarSyncError, 1000),
    reminder7DaysSent: input.reminder7DaysSent !== undefined ? Boolean(input.reminder7DaysSent) : String(current.reminder7DaysSent) === 'true',
    reminder1DaySent: input.reminder1DaySent !== undefined ? Boolean(input.reminder1DaySent) : String(current.reminder1DaySent) === 'true'
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

function normalizedPayment(input, existing) {
  var current = existing || {};
  var timestamp = businessNow();
  var plannedAmount = Math.max(0, Number(input.plannedAmount !== undefined ? input.plannedAmount : current.plannedAmount) || 0);
  var receivedAmount = Math.max(0, Number(input.receivedAmount !== undefined ? input.receivedAmount : current.receivedAmount) || 0);
  var requestedStatus = cleanBusinessText(input.status || current.status || 'Pendiente', 40);
  var status = requestedStatus;
  if (requestedStatus !== 'Anulado') {
    if (receivedAmount <= 0 || requestedStatus === 'Pendiente') {
      receivedAmount = 0;
      status = 'Pendiente';
    } else if (receivedAmount + 0.005 < plannedAmount) status = 'Parcial';
    else status = 'Liquidado';
  }
  return {
    id: cleanBusinessText(input.id || current.id || businessId('pago'), 120),
    clientId: cleanBusinessText(input.clientId || current.clientId, 120),
    contractId: cleanBusinessText(input.contractId !== undefined ? input.contractId : current.contractId, 120),
    transactionId: cleanBusinessText(current.transactionId || input.transactionId || businessId('ingreso'), 120),
    date: cleanBusinessText(input.date || current.date || timestamp.substring(0, 10), 40),
    dueDate: cleanBusinessText(input.dueDate !== undefined ? input.dueDate : current.dueDate, 40),
    installmentNumber: Math.max(0, Math.min(99, Math.floor(Number(input.installmentNumber !== undefined ? input.installmentNumber : current.installmentNumber) || 0))),
    percentage: Math.max(0, Math.min(100, Number(input.percentage !== undefined ? input.percentage : current.percentage) || 0)),
    concept: cleanBusinessText(input.concept !== undefined ? input.concept : current.concept, 300),
    plannedAmount: plannedAmount,
    receivedAmount: receivedAmount,
    status: status,
    method: cleanBusinessText(input.method !== undefined ? input.method : current.method, 100),
    reference: cleanBusinessText(input.reference !== undefined ? input.reference : current.reference, 200),
    notes: cleanBusinessText(input.notes !== undefined ? input.notes : current.notes, 3000),
    receiptFileId: cleanBusinessText(current.receiptFileId || input.receiptFileId, 200),
    receiptFileName: cleanBusinessText(current.receiptFileName || input.receiptFileName, 240),
    paidAt: status === 'Liquidado' || status === 'Parcial' ? cleanBusinessText(input.paidAt || current.paidAt || input.date || timestamp, 50) : '',
    recordedBy: cleanBusinessText(input.recordedBy || current.recordedBy || 'Admin XPH', 180),
    createdAt: cleanBusinessText(current.createdAt || input.createdAt || timestamp, 40),
    updatedAt: timestamp
  };
}

function normalizedFollowUp(input, client) {
  var timestamp = businessNow();
  return {
    id: cleanBusinessText(input.id || businessId('seguimiento'), 120),
    prospectId: client.recordType === 'Prospecto' ? cleanBusinessText(client.id, 120) : cleanBusinessText(input.prospectId, 120),
    clientId: client.recordType === 'Cliente' ? cleanBusinessText(client.id, 120) : cleanBusinessText(input.clientId, 120),
    occurredAt: cleanBusinessText(input.occurredAt || timestamp, 50),
    conversation: cleanBusinessText(input.conversation, 6000),
    result: cleanBusinessText(input.result, 1000),
    nextAction: cleanBusinessText(input.nextAction, 1000),
    nextActionAt: cleanBusinessText(input.nextActionAt, 50),
    createdBy: cleanBusinessText(input.createdBy || 'Admin XPH', 180),
    createdAt: timestamp
  };
}

function publicPaymentRecord(record) {
  var output = {};
  BUSINESS_HEADERS.payments.forEach(function(header) { output[header] = record[header] === undefined ? '' : record[header]; });
  output.receiptUrl = record.receiptFileId ? 'https://drive.google.com/file/d/' + encodeURIComponent(record.receiptFileId) + '/view' : '';
  return output;
}

function syncClientPaidAmount(ss, clientId) {
  var client = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, clientId);
  if (!client) return;
  var payments = readBusinessRecords(ss, 'Pagos_Clientes', BUSINESS_HEADERS.payments);
  var total = payments.filter(function(item) { return String(item.clientId) === String(clientId) && ['Parcial', 'Liquidado'].indexOf(String(item.status)) >= 0; })
    .reduce(function(sum, item) { return sum + (Number(item.receivedAmount) || 0); }, 0);
  client.paidAmount = Math.max(0, Math.min(Number(client.totalAmount) || total, total));
  client.updatedAt = businessNow();
  upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, client);
  return client;
}

function syncPaymentTransaction(ss, payment, existingPayment) {
  var transactionId = cleanBusinessText(payment.transactionId || (existingPayment && existingPayment.transactionId) || businessId('ingreso'), 120);
  payment.transactionId = transactionId;
  var existingTransaction = findBusinessRecord(ss, 'Movimientos_Financieros', BUSINESS_HEADERS.transactions, transactionId);
  var timestamp = businessNow();
  var active = ['Parcial', 'Liquidado'].indexOf(String(payment.status)) >= 0 && Number(payment.receivedAmount) > 0;
  var transaction = {
    id: transactionId,
    paymentId: payment.id,
    clientId: payment.clientId,
    type: 'Ingreso de cliente',
    amount: Math.max(0, Number(payment.receivedAmount) || 0),
    status: active ? 'ACTIVO' : 'ANULADO',
    date: payment.date || timestamp.substring(0, 10),
    concept: payment.concept,
    method: payment.method,
    reference: payment.reference,
    createdAt: existingTransaction && existingTransaction.createdAt ? existingTransaction.createdAt : timestamp,
    updatedAt: timestamp
  };
  upsertBusinessRecord(ss, 'Movimientos_Financieros', BUSINESS_HEADERS.transactions, transaction);
  return transaction;
}

function syncClientContractTotal(ss, clientId) {
  var client = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, clientId);
  if (!client) throw new Error('Cliente no localizado.');
  var snapshots = readBusinessRecords(ss, 'Paquetes_Cliente', BUSINESS_HEADERS.packageSnapshots)
    .filter(function(item) { return String(item.clientId) === String(clientId) && String(item.status) === 'ACTIVO'; })
    .sort(function(a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
  if (!snapshots.length) return { client: client, packageSnapshot: null };
  var packageSnapshot = snapshots[0];
  var addonsTotal = readBusinessRecords(ss, 'Adicionales_Cliente', BUSINESS_HEADERS.addons)
    .filter(function(item) { return String(item.clientId) === String(clientId) && String(item.status) !== 'Anulado'; })
    .reduce(function(sum, item) { return sum + (Number(item.total) || 0); }, 0);
  packageSnapshot.finalTotal = Math.max(0, Number(packageSnapshot.basePrice || 0) + addonsTotal - Number(packageSnapshot.discount || 0));
  packageSnapshot.updatedAt = businessNow();
  upsertBusinessRecord(ss, 'Paquetes_Cliente', BUSINESS_HEADERS.packageSnapshots, packageSnapshot);
  client.packageName = packageSnapshot.packageName;
  client.totalAmount = packageSnapshot.finalTotal;
  client.eventId = client.eventId || packageSnapshot.eventId || businessId('evento');
  client.updatedAt = businessNow();
  upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, client);
  return { client: client, packageSnapshot: packageSnapshot };
}

function normalizedContractedService(input, existing, client) {
  var current = existing || {};
  var timestamp = businessNow();
  var quantity = Math.max(0, Number(input.quantity !== undefined ? input.quantity : current.quantity) || 0);
  var unitPrice = Math.max(0, Number(input.unitPrice !== undefined ? input.unitPrice : current.unitPrice) || 0);
  return {
    id: cleanBusinessText(input.id || current.id || businessId('servicio'), 120),
    clientId: cleanBusinessText(client.id, 120),
    eventId: cleanBusinessText(input.eventId || current.eventId || client.eventId, 120),
    packageSnapshotId: cleanBusinessText(input.packageSnapshotId !== undefined ? input.packageSnapshotId : current.packageSnapshotId, 120),
    source: cleanBusinessText(input.source || current.source || 'MANUAL', 20),
    concept: cleanBusinessText(input.concept !== undefined ? input.concept : current.concept, 300),
    included: input.included !== undefined ? Boolean(input.included) : String(current.included) !== 'false',
    quantity: quantity,
    unitPrice: unitPrice,
    total: Math.max(0, Number(input.total !== undefined ? input.total : quantity * unitPrice) || 0),
    date: cleanBusinessText(input.date !== undefined ? input.date : current.date, 40),
    notes: cleanBusinessText(input.notes !== undefined ? input.notes : current.notes, 3000),
    status: cleanBusinessText(input.status || current.status || 'Pendiente', 60),
    createdAt: cleanBusinessText(current.createdAt || input.createdAt || timestamp, 40),
    updatedAt: timestamp
  };
}

function normalizedClientAddon(input, existing, client) {
  var current = existing || {};
  var timestamp = businessNow();
  var quantity = Math.max(0, Number(input.quantity !== undefined ? input.quantity : current.quantity) || 0);
  var unitPrice = Math.max(0, Number(input.unitPrice !== undefined ? input.unitPrice : current.unitPrice) || 0);
  return {
    id: cleanBusinessText(input.id || current.id || businessId('adicional'), 120),
    clientId: cleanBusinessText(client.id, 120),
    eventId: cleanBusinessText(input.eventId || current.eventId || client.eventId, 120),
    concept: cleanBusinessText(input.concept !== undefined ? input.concept : current.concept, 300),
    quantity: quantity,
    unitPrice: unitPrice,
    total: Math.max(0, Number(input.total !== undefined ? input.total : quantity * unitPrice) || 0),
    date: cleanBusinessText(input.date !== undefined ? input.date : current.date, 40),
    notes: cleanBusinessText(input.notes !== undefined ? input.notes : current.notes, 3000),
    status: cleanBusinessText(input.status || current.status || 'Confirmado', 60),
    createdAt: cleanBusinessText(current.createdAt || input.createdAt || timestamp, 40),
    updatedAt: timestamp
  };
}

function parseBusinessJsonArray(value) {
  if (Array.isArray(value)) return value.map(String);
  try {
    var parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (_) { return []; }
}

function publicInternalEventRecord(record) {
  var output = {};
  BUSINESS_HEADERS.internalEvents.forEach(function(header) { if (header !== 'userIdsJson') output[header] = record[header] === undefined ? '' : record[header]; });
  output.userIds = parseBusinessJsonArray(record.userIdsJson);
  return output;
}

function publicTeamUserRecord(record) {
  return {
    id: record.id || '', name: record.name || '', lastName: record.lastName || '', displayName: record.displayName || '',
    email: record.email || '', phone: record.phone || '', functionId: record.functionId || '', functionName: record.functionName || '',
    role: 'COLLABORATOR', status: record.status || 'INVITADO', permissions: parseBusinessJsonArray(record.permissionsJson), notes: record.notes || '',
    googleConnected: String(record.googleConnected) === 'true', googleEmail: record.googleEmail || '', calendarConnected: String(record.calendarConnected) === 'true',
    createdAt: record.createdAt || '', updatedAt: record.updatedAt || ''
  };
}

function normalizedTeamUser(input, existing) {
  var current = existing || {};
  var timestamp = businessNow();
  var permissions = parseBusinessJsonArray(input.permissions !== undefined ? input.permissions : current.permissionsJson)
    .filter(function(item, index, list) { return item && item !== '*' && list.indexOf(item) === index; });
  return {
    id: cleanBusinessText(input.id || current.id || businessId('usuario'), 120),
    name: cleanBusinessText(input.name !== undefined ? input.name : current.name, 120),
    lastName: cleanBusinessText(input.lastName !== undefined ? input.lastName : current.lastName, 160),
    displayName: cleanBusinessText(input.displayName !== undefined ? input.displayName : current.displayName, 160),
    email: cleanBusinessText(input.email !== undefined ? input.email : current.email, 180).toLowerCase(),
    phone: cleanBusinessText(input.phone !== undefined ? input.phone : current.phone, 40),
    functionId: cleanBusinessText(input.functionId !== undefined ? input.functionId : current.functionId, 120),
    functionName: cleanBusinessText(input.functionName !== undefined ? input.functionName : current.functionName, 120),
    role: 'COLLABORATOR',
    status: cleanBusinessText(input.status || current.status || 'INVITADO', 30),
    permissionsJson: JSON.stringify(permissions),
    notes: cleanBusinessText(input.notes !== undefined ? input.notes : current.notes, 2000),
    googleConnected: String(current.googleConnected) === 'true',
    googleSubject: cleanBusinessText(current.googleSubject, 240),
    googleEmail: cleanBusinessText(current.googleEmail, 180),
    calendarConnected: String(current.calendarConnected) === 'true',
    createdAt: cleanBusinessText(current.createdAt || input.createdAt || timestamp, 40),
    updatedAt: timestamp
  };
}

function assignmentDateTime(dateValue, timeValue, fallbackHours) {
  var date = normalizeBusinessDate(dateValue);
  var time = normalizeBusinessTime(timeValue || '00:00');
  var result = calendarDateTime(date, time);
  if (fallbackHours) result = new Date(result.getTime() + Number(fallbackHours) * 60 * 60 * 1000);
  return result;
}

function collaboratorCalendarRequest(url, options) {
  var response = UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true }, options || {}));
  var parsed = {};
  try { parsed = JSON.parse(response.getContentText() || '{}'); } catch (_) {}
  return { code: response.getResponseCode(), data: parsed };
}

function collaboratorLegacyMatch(item, expectedSummary, start, reconcileKey) {
  if (!item || item.status === 'cancelled') return false;
  var actualSummary = normalizeCalendarMatchText(item.summary || '');
  if (actualSummary.indexOf('xph ') !== 0) return false;
  var itemStart = item.start && (item.start.dateTime || item.start.date) || '';
  if (String(itemStart).slice(0, 10) !== Utilities.formatDate(start, businessCalendarTimeZone(), 'yyyy-MM-dd')) return false;
  if (actualSummary === normalizeCalendarMatchText(expectedSummary)) return true;
  if (calendarEventClientToken(item.summary) !== calendarEventClientToken(expectedSummary)) return false;
  var expectedKind = String(reconcileKey).indexOf(':session') >= 0 ? 'session' : 'event';
  return calendarEventKind(item.summary) === expectedKind && calendarEventKind(expectedSummary) === expectedKind;
}

function syncAssignmentToCollaboratorCalendar(user, assignment, client) {
  if (!user || String(user.calendarConnected) !== 'true') return { eventId: assignment.calendarEventId || '', status: 'Desconectado' };
  var tokenRecordRaw = PropertiesService.getScriptProperties().getProperty('xph_user_oauth_' + user.id);
  if (!tokenRecordRaw) return { eventId: assignment.calendarEventId || '', status: 'Desconectado' };
  var tokenRecord;
  try { tokenRecord = JSON.parse(tokenRecordRaw); } catch (_) { return { eventId: assignment.calendarEventId || '', status: 'Error' }; }
  var accessToken = tokenRecord.accessToken || '';
  if (Number(tokenRecord.expiresAt || 0) < Date.now() + 60000 && tokenRecord.refreshToken) {
    var props = PropertiesService.getScriptProperties();
    var clientId = props.getProperty('XPH_GOOGLE_CLIENT_ID');
    var clientSecret = props.getProperty('XPH_GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) return { eventId: assignment.calendarEventId || '', status: 'Error' };
    var refreshResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', payload: { client_id: clientId, client_secret: clientSecret, refresh_token: tokenRecord.refreshToken, grant_type: 'refresh_token' }, muteHttpExceptions: true });
    var refreshed = JSON.parse(refreshResponse.getContentText() || '{}');
    if (!refreshed.access_token) return { eventId: assignment.calendarEventId || '', status: 'Error' };
    accessToken = refreshed.access_token;
    tokenRecord.accessToken = accessToken;
    tokenRecord.expiresAt = Date.now() + Number(refreshed.expires_in || 3600) * 1000;
    props.setProperty('xph_user_oauth_' + user.id, JSON.stringify(tokenRecord));
  }
  if (!accessToken) return { eventId: assignment.calendarEventId || '', status: 'Error' };
  var headers = { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' };
  var baseUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  var start = assignmentDateTime(assignment.startDate, assignment.startTime);
  var end = assignment.endDate ? assignmentDateTime(assignment.endDate, assignment.endTime || assignment.startTime) : assignmentDateTime(assignment.startDate, assignment.endTime || assignment.startTime, assignment.endTime ? 0 : 1);
  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 60 * 60 * 1000);
  var reconcileKey = 'assignment:' + assignment.id + ':' + inferredAssignmentScheduleSource(assignment).toLowerCase();
  var summary = 'XPH · ' + (assignment.activityType || client.eventType || 'Evento') + ' · ' + (client.name || 'Cliente');
  var listUrl = baseUrl + '?singleEvents=true&showDeleted=false&maxResults=100&timeMin=' + encodeURIComponent(new Date(start.getTime() - 36 * 60 * 60 * 1000).toISOString()) + '&timeMax=' + encodeURIComponent(new Date(start.getTime() + 60 * 60 * 60 * 1000).toISOString());
  var listed = collaboratorCalendarRequest(listUrl, { method: 'get', headers: headers });
  var items = listed.code >= 200 && listed.code < 300 && Array.isArray(listed.data.items) ? listed.data.items : [];
  var matches = items.filter(function(item) {
    var tag = item.extendedProperties && item.extendedProperties.private && item.extendedProperties.private.xphCrmKey || '';
    return tag === reconcileKey || collaboratorLegacyMatch(item, summary, start, reconcileKey);
  });
  if (assignment.calendarEventId && !matches.some(function(item) { return String(item.id) === String(assignment.calendarEventId); })) {
    var stored = collaboratorCalendarRequest(baseUrl + '/' + encodeURIComponent(assignment.calendarEventId), { method: 'get', headers: headers });
    if (stored.code >= 200 && stored.code < 300 && stored.data.id) matches.unshift(stored.data);
  }
  var canonical = assignment.calendarEventId ? matches.find(function(item) { return String(item.id) === String(assignment.calendarEventId); }) : null;
  if (!canonical) canonical = matches.find(function(item) { return item.extendedProperties && item.extendedProperties.private && item.extendedProperties.private.xphCrmKey === reconcileKey; }) || matches[0] || null;
  var duplicatesDeleted = 0;
  matches.forEach(function(item) {
    if (canonical && String(item.id) === String(canonical.id)) return;
    var removed = collaboratorCalendarRequest(baseUrl + '/' + encodeURIComponent(item.id), { method: 'delete', headers: headers });
    if ([200, 204, 410].indexOf(removed.code) >= 0) duplicatesDeleted++;
  });
  if (String(assignment.status) === 'CANCELADA') {
    if (canonical && canonical.id) {
      var cancelled = collaboratorCalendarRequest(baseUrl + '/' + encodeURIComponent(canonical.id), { method: 'delete', headers: headers });
      if ([200, 204, 410].indexOf(cancelled.code) >= 0) duplicatesDeleted++;
    }
    return { eventId: '', status: 'Sincronizado', created: 0, updated: 0, duplicatesDeleted: duplicatesDeleted };
  }
  var body = {
    summary: summary,
    location: client.eventLocation || client.preSessionLocation || '',
    description: 'Función: ' + (assignment.functionName || user.functionName || '') + '\nInformación operativa: ' + (assignment.notes || 'Sin notas') + '\nCliente: ' + (client.name || ''),
    start: { dateTime: start.toISOString(), timeZone: businessCalendarTimeZone() },
    end: { dateTime: end.toISOString(), timeZone: businessCalendarTimeZone() },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10080 }, { method: 'popup', minutes: 1440 }] },
    extendedProperties: { private: { xphCrmKey: reconcileKey, xphAssignmentId: String(assignment.id), xphClientId: String(client.id || '') } }
  };
  var saved = collaboratorCalendarRequest(canonical && canonical.id ? baseUrl + '/' + encodeURIComponent(canonical.id) : baseUrl, { method: canonical && canonical.id ? 'patch' : 'post', headers: headers, payload: JSON.stringify(body) });
  var result = saved.data || {};
  return result.id ? { eventId: result.id, status: 'Sincronizado', created: canonical ? 0 : 1, updated: canonical ? 1 : 0, duplicatesDeleted: duplicatesDeleted } : { eventId: canonical && canonical.id || assignment.calendarEventId || '', status: 'Error', created: 0, updated: 0, duplicatesDeleted: duplicatesDeleted };
}

function businessTimeAfter(timeValue, hoursToAdd) {
  var normalized = normalizeBusinessTime(timeValue);
  if (!normalized) return '';
  var parts = normalized.split(':');
  var minutes = Number(parts[0]) * 60 + Number(parts[1]) + Math.round(Math.max(0.5, Number(hoursToAdd) || 1) * 60);
  minutes = Math.min(23 * 60 + 59, minutes);
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

function inferredAssignmentScheduleSource(assignment) {
  var explicit = String(assignment.scheduleSource || '').toUpperCase();
  if (['EVENT', 'SESSION', 'MANUAL'].indexOf(explicit) >= 0) return explicit;
  var activity = String(assignment.activityType || '').toLowerCase();
  return /(sesión|sesion|save the date|preboda)/.test(activity) ? 'SESSION' : 'EVENT';
}

function syncClientAssignments(ss, client, eventReady, sessionReady) {
  var assignments = readBusinessRecords(ss, 'Asignaciones_Equipo', BUSINESS_HEADERS.assignments)
    .filter(function(item) { return String(item.clientId) === String(client.id); });
  var users = readBusinessRecords(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users);
  var summary = { created: 0, updated: 0, duplicatesDeleted: 0, failed: 0 };
  assignments.forEach(function(assignment) {
    var user = users.find(function(item) { return String(item.id) === String(assignment.userId); });
    if (!user) return;
    var source = inferredAssignmentScheduleSource(assignment);
    assignment.scheduleSource = source;
    var sourceReady = String(client.status) === 'Archivado' ? false : source === 'SESSION' ? sessionReady : source === 'EVENT' ? eventReady : true;
    var syncRecord = assignment;
    if (source === 'EVENT' && eventReady) {
      assignment.startDate = client.eventDate;
      assignment.startTime = client.eventTime || '';
      assignment.endDate = client.eventDate;
      assignment.endTime = client.eventTime ? businessTimeAfter(client.eventTime, client.serviceHours || 1) : '';
      assignment.eventId = client.eventId || assignment.eventId;
    } else if (source === 'SESSION' && sessionReady) {
      assignment.startDate = client.preSessionDate;
      assignment.startTime = client.preSessionTime || '';
      assignment.endDate = client.preSessionDate;
      assignment.endTime = client.preSessionEndTime || (client.preSessionTime ? businessTimeAfter(client.preSessionTime, 2) : '');
      assignment.eventId = client.eventId || assignment.eventId;
    }
    if (String(assignment.status) === 'CANCELADA' || !sourceReady) syncRecord = Object.assign({}, assignment, { status: 'CANCELADA' });
    try {
      var result = syncAssignmentToCollaboratorCalendar(user, syncRecord, client);
      assignment.calendarEventId = sourceReady && String(assignment.status) !== 'CANCELADA' ? result.eventId : '';
      assignment.syncStatus = result.status;
      summary.created += Number(result.created || 0);
      summary.updated += Number(result.updated || 0);
      summary.duplicatesDeleted += Number(result.duplicatesDeleted || 0);
      if (result.status === 'Error') summary.failed++;
    } catch (error) {
      assignment.syncStatus = 'Error';
      summary.failed++;
    }
    assignment.updatedAt = businessNow();
    upsertBusinessRecord(ss, 'Asignaciones_Equipo', BUSINESS_HEADERS.assignments, assignment);
  });
  return summary;
}

var BUSINESS_CALENDAR_TIME_ZONE_CACHE = '';

function businessCalendarTimeZone() {
  if (BUSINESS_CALENDAR_TIME_ZONE_CACHE) return BUSINESS_CALENDAR_TIME_ZONE_CACHE;
  try {
    var spreadsheet = getDatabaseSpreadsheet();
    if (spreadsheet && spreadsheet.getSpreadsheetTimeZone()) {
      BUSINESS_CALENDAR_TIME_ZONE_CACHE = spreadsheet.getSpreadsheetTimeZone();
      return BUSINESS_CALENDAR_TIME_ZONE_CACHE;
    }
  } catch (_) {}
  BUSINESS_CALENDAR_TIME_ZONE_CACHE = Session.getScriptTimeZone() || 'America/Mexico_City';
  return BUSINESS_CALENDAR_TIME_ZONE_CACHE;
}

function normalizeBusinessDate(value) {
  if (value === undefined || value === null || value === '') return '';
  var timeZone = businessCalendarTimeZone();
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
  var text = String(value).trim();
  var isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    var year = Number(isoDate[1]);
    var month = Number(isoDate[2]);
    var day = Number(isoDate[3]);
    var checked = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (checked.getFullYear() !== year || checked.getMonth() !== month - 1 || checked.getDate() !== day) {
      throw new Error('La fecha no tiene un formato válido para Calendar.');
    }
    return isoDate[1] + '-' + isoDate[2] + '-' + isoDate[3];
  }
  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, timeZone, 'yyyy-MM-dd');
  throw new Error('La fecha no tiene un formato válido para Calendar.');
}

function normalizeBusinessTime(value) {
  if (value === undefined || value === null || value === '') return '';
  var timeZone = businessCalendarTimeZone();
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, timeZone, 'HH:mm');
  if (typeof value === 'number' && isFinite(value)) {
    var minutes = Math.round((((value % 1) + 1) % 1) * 24 * 60) % (24 * 60);
    return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  }
  var text = String(value).trim();
  var directTime = text.match(/^(\d{1,2}):(\d{2})/);
  if (directTime) {
    var hours = Number(directTime[1]);
    var minutesValue = Number(directTime[2]);
    if (hours > 23 || minutesValue > 59) throw new Error('El horario no tiene un formato válido para Calendar.');
    return String(hours).padStart(2, '0') + ':' + String(minutesValue).padStart(2, '0');
  }
  var isoCandidate = text.replace(/\.$/, 'Z');
  var parsed = new Date(isoCandidate);
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, timeZone, 'HH:mm');
  throw new Error('El horario no tiene un formato válido para Calendar.');
}

function calendarDateTime(dateValue, timeValue) {
  var parts = normalizeBusinessDate(dateValue).split('-');
  var time = normalizeBusinessTime(timeValue).split(':');
  var result = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(time[0]), Number(time[1]), 0, 0);
  if (isNaN(result.getTime())) throw new Error('La fecha y el horario no son válidos para Calendar.');
  return result;
}

function calendarDateOnly(dateValue) {
  var parts = normalizeBusinessDate(dateValue).split('-');
  var result = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
  if (isNaN(result.getTime())) throw new Error('La fecha no es válida para Calendar.');
  return result;
}

function authorizeCalendarIntegration() {
  return CalendarApp.getDefaultCalendar().getName();
}

function normalizeCalendarMatchText(value) {
  var text = String(value || '').toLowerCase().trim();
  try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
  return text.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function calendarEventDayKey(event) {
  try { return Utilities.formatDate(event.getStartTime(), businessCalendarTimeZone(), 'yyyy-MM-dd'); } catch (_) { return ''; }
}

function calendarEventClientToken(title) {
  var pieces = String(title || '').split('·');
  return normalizeCalendarMatchText(pieces.length ? pieces[pieces.length - 1] : title);
}

function calendarEventKind(title) {
  return /(sesion|preboda|save the date)/.test(normalizeCalendarMatchText(title)) ? 'session' : 'event';
}

function isStrictLegacyCalendarMatch(event, title, start, reconcileKey) {
  var existingTitle = '';
  try { existingTitle = event.getTitle(); } catch (_) { return false; }
  if (normalizeCalendarMatchText(existingTitle).indexOf('xph ') !== 0) return false;
  if (calendarEventDayKey(event) !== Utilities.formatDate(start, businessCalendarTimeZone(), 'yyyy-MM-dd')) return false;
  var expectedTitle = normalizeCalendarMatchText(title);
  var actualTitle = normalizeCalendarMatchText(existingTitle);
  if (actualTitle === expectedTitle) return true;
  var expectedClient = calendarEventClientToken(title);
  if (!expectedClient || calendarEventClientToken(existingTitle) !== expectedClient) return false;
  var expectedKind = String(reconcileKey || '').indexOf(':session') >= 0 ? 'session' : 'event';
  return calendarEventKind(existingTitle) === expectedKind && calendarEventKind(title) === expectedKind;
}

function getCalendarEventByIdSafe(calendar, eventId) {
  if (!eventId) return null;
  try { return calendar.getEventById(eventId); } catch (_) { return null; }
}

function calendarEventsForReconciliation(calendar, eventId, reconcileKey, title, start) {
  var matches = [];
  var seen = {};
  var stored = getCalendarEventByIdSafe(calendar, eventId);
  if (stored) { matches.push(stored); seen[String(stored.getId())] = true; }
  var candidates = [];
  try { candidates = calendar.getEvents(new Date(start.getTime() - 36 * 60 * 60 * 1000), new Date(start.getTime() + 60 * 60 * 60 * 1000)); } catch (_) {}
  candidates.forEach(function(candidate) {
    var candidateId = String(candidate.getId());
    if (seen[candidateId]) return;
    var tagged = '';
    try { tagged = candidate.getTag('xphCrmKey') || ''; } catch (_) {}
    if (tagged === reconcileKey || isStrictLegacyCalendarMatch(candidate, title, start, reconcileKey)) {
      matches.push(candidate);
      seen[candidateId] = true;
    }
  });
  return matches;
}

function upsertClientCalendarEvent(calendar, eventId, title, start, durationHours, location, description, guestEmail, allDay, reconcileKey) {
  var matches = calendarEventsForReconciliation(calendar, eventId, reconcileKey, title, start);
  var event = null;
  if (eventId) event = matches.find(function(item) { return String(item.getId()) === String(eventId); }) || null;
  if (!event) event = matches.find(function(item) { try { return item.getTag('xphCrmKey') === reconcileKey; } catch (_) { return false; } }) || null;
  if (!event && matches.length) event = matches[0];
  var created = !event;
  var end = new Date(start.getTime() + Math.max(0.5, Number(durationHours) || 1) * 60 * 60 * 1000);
  if (event) {
    event.setTitle(title).setLocation(location || '').setDescription(description || '');
    if (allDay) event.setAllDayDate(start);
    else event.setTime(start, end);
  } else {
    event = allDay
      ? calendar.createAllDayEvent(title, start, { location: location || '', description: description || '' })
      : calendar.createEvent(title, start, end, { location: location || '', description: description || '' });
  }
  try { event.setTag('xphCrmKey', reconcileKey); } catch (_) {}
  event.removeAllReminders();
  event.addPopupReminder(10080);
  event.addPopupReminder(1440);
  try {
    event.getGuestList().forEach(function(guest) {
      if (!guestEmail || String(guest.getEmail()).toLowerCase() !== String(guestEmail).toLowerCase()) event.removeGuest(guest.getEmail());
    });
  } catch (_) {}
  if (guestEmail) { try { event.addGuest(guestEmail); } catch (_) {} }
  var canonicalId = String(event.getId());
  var duplicatesDeleted = 0;
  matches.forEach(function(candidate) {
    if (String(candidate.getId()) === canonicalId) return;
    try { candidate.deleteEvent(); duplicatesDeleted++; } catch (_) {}
  });
  return { eventId: canonicalId, created: created ? 1 : 0, updated: created ? 0 : 1, duplicatesDeleted: duplicatesDeleted };
}

function removeClientCalendarEvent(calendar, eventId, reconcileKey, title, start) {
  var matches = start && reconcileKey && title ? calendarEventsForReconciliation(calendar, eventId, reconcileKey, title, start) : [];
  if (!matches.length) {
    var stored = getCalendarEventByIdSafe(calendar, eventId);
    if (stored) matches = [stored];
  }
  var deleted = 0;
  matches.forEach(function(event) { try { event.deleteEvent(); deleted++; } catch (_) {} });
  return { eventId: '', duplicatesDeleted: deleted };
}

function driveUploadFolder() {
  try {
    return DriveApp.getFolderById(FOLDER_ID);
  } catch (_) {
    return DriveApp.getRootFolder();
  }
}

function createDriveResumableSession(payload) {
  payload = payload || {};
  var filename = cleanBusinessText(payload.filename || ('foto-xph-' + Date.now()), 180).replace(/[\\/]/g, '-');
  var mimeType = cleanBusinessText(payload.mimeType || '', 120).toLowerCase();
  var size = Number(payload.size || 0);
  if (mimeType.indexOf('image/') !== 0 || size <= 0 || size > 100000000) {
    throw new Error('La fotografía debe ser una imagen válida y pesar máximo 100 MB.');
  }
  var folder = driveUploadFolder();
  var response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(size)
    },
    payload: JSON.stringify({ name: filename, parents: [folder.getId()] }),
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var headers = response.getAllHeaders();
  var uploadUrl = headers.Location || headers.location || '';
  if (status < 200 || status >= 300 || !uploadUrl) {
    throw new Error('Google Drive no pudo iniciar la carga original (HTTP ' + status + ').');
  }
  return { status: 'success', uploadUrl: String(uploadUrl) };
}

function createContractResumableSession(payload) {
  payload = payload || {};
  var filename = cleanBusinessText(payload.filename || ('Contrato-XPH-' + Date.now() + '.pdf'), 180).replace(/[\\/]/g, '-');
  var mimeType = cleanBusinessText(payload.mimeType || '', 120).toLowerCase();
  var size = Number(payload.size || 0);
  if (mimeType !== 'application/pdf' || size <= 0 || size > 5000000) throw new Error('El contrato debe ser PDF y pesar máximo 5 MB.');
  var folder = getContractsFolder();
  var response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(size) },
    payload: JSON.stringify({ name: filename, parents: [folder.getId()] }), muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var headers = response.getAllHeaders();
  var uploadUrl = headers.Location || headers.location || '';
  if (status < 200 || status >= 300 || !uploadUrl) throw new Error('Google Drive no pudo iniciar la carga del contrato (HTTP ' + status + ').');
  return { status: 'success', uploadUrl: String(uploadUrl) };
}

function createEmailLogoResumableSession(payload) {
  payload = payload || {};
  var filename = cleanBusinessText(payload.filename || ('Logo-XPH-' + Date.now()), 180).replace(/[\\/]/g, '-');
  var mimeType = cleanBusinessText(payload.mimeType || '', 120).toLowerCase();
  var size = Number(payload.size || 0);
  if (['image/png', 'image/jpeg', 'image/webp'].indexOf(mimeType) < 0 || size <= 0 || size > 5000000) throw new Error('El logo debe ser PNG, JPG o WebP y pesar máximo 5 MB.');
  var folder = getEmailAssetsFolder();
  var response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(size) },
    payload: JSON.stringify({ name: filename, parents: [folder.getId()] }), muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var headers = response.getAllHeaders();
  var uploadUrl = headers.Location || headers.location || '';
  if (status < 200 || status >= 300 || !uploadUrl) throw new Error('Google Drive no pudo iniciar la carga del logo (HTTP ' + status + ').');
  return { status: 'success', uploadUrl: String(uploadUrl) };
}

function createClientGalleryUploadSession(ss, payload) {
  var gallery = findBusinessRecord(ss, 'Galerias_Clientes', BUSINESS_HEADERS.galleries, payload.galleryId);
  if (!gallery || String(gallery.status) === 'ARCHIVADA') throw new Error('Galería no localizada o archivada.');
  var filename = cleanBusinessText(payload.filename || ('foto-xph-' + Date.now()), 180).replace(/[\\/]/g, '-');
  var mimeType = cleanBusinessText(payload.mimeType || '', 120).toLowerCase();
  var size = Number(payload.size || 0);
  if (mimeType.indexOf('image/') !== 0 || size <= 0 || size > 100000000) throw new Error('La fotografía debe ser una imagen válida y pesar máximo 100 MB.');
  var folder = DriveApp.getFolderById(gallery.photosFolderId);
  var response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(size) },
    payload: JSON.stringify({ name: filename, parents: [folder.getId()] }), muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var headers = response.getAllHeaders();
  var uploadUrl = headers.Location || headers.location || '';
  if (status < 200 || status >= 300 || !uploadUrl) throw new Error('Google Drive no pudo iniciar la carga de la fotografía (HTTP ' + status + ').');
  return { status: 'success', uploadUrl: String(uploadUrl) };
}

function finalizeClientGalleryUpload(ss, payload) {
  var gallery = findBusinessRecord(ss, 'Galerias_Clientes', BUSINESS_HEADERS.galleries, payload.galleryId);
  if (!gallery || String(gallery.status) === 'ARCHIVADA') throw new Error('Galería no localizada o archivada.');
  var fileId = cleanBusinessText(payload.fileId, 200);
  var file = DriveApp.getFileById(fileId);
  var mimeType = String(file.getMimeType() || '').toLowerCase();
  if (mimeType.indexOf('image/') !== 0 || Number(file.getSize() || 0) > 100000000) throw new Error('El archivo cargado no es una fotografía válida.');
  var parents = file.getParents();
  var belongsToFolder = false;
  while (parents.hasNext()) if (parents.next().getId() === String(gallery.photosFolderId)) { belongsToFolder = true; break; }
  if (!belongsToFolder) throw new Error('La fotografía no pertenece a la carpeta de esta galería.');
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  var config = {};
  try { var raw = loadActiveConfig(); if (raw) config = JSON.parse(raw); } catch (_) {}
  var items = Array.isArray(config.galleryImages) ? config.galleryImages : [];
  var client = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, gallery.clientId) || {};
  var record = {
    id: fileId, title: cleanBusinessText(payload.title || file.getName().replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '), 180), category: 'private',
    url: 'https://lh3.googleusercontent.com/d/' + fileId, location: client.name || '', visibility: 'private', mediaType: 'image', galleryId: gallery.id,
    gallerySlug: gallery.slug, galleryTitle: gallery.title, galleryClient: client.name || 'Cliente XPH', downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId,
    previewUrl: 'https://lh3.googleusercontent.com/d/' + fileId, clientId: gallery.clientId, eventId: gallery.eventId, driveFolderId: gallery.photosFolderId, createdAt: businessNow()
  };
  items = [record].concat(items.filter(function(item) { return String(item.id) !== fileId; }));
  config.galleryImages = items;
  saveActiveConfig(ss, JSON.stringify(config));
  syncGalleryTable(ss, items);
  gallery.updatedAt = businessNow();
  upsertBusinessRecord(ss, 'Galerias_Clientes', BUSINESS_HEADERS.galleries, gallery);
  logAudit(ss, 'FOTO_GALERIA_CLIENTE_AGREGADA', { galleryId: gallery.id, clientId: gallery.clientId, fileId: fileId }, fileId, 'Admin XPH');
  return { status: 'success', gallery: gallery, media: record };
}

function finalizeEmailLogoUpload(ss, payload) {
  var fileId = cleanBusinessText(payload && payload.fileId, 200);
  if (!fileId) throw new Error('No se recibió el logo cargado.');
  var file = DriveApp.getFileById(fileId);
  var mimeType = String(file.getMimeType() || '').toLowerCase();
  var size = Number(file.getSize() || 0);
  if (['image/png', 'image/jpeg', 'image/webp'].indexOf(mimeType) < 0 || size <= 0 || size > 5000000) throw new Error('El logo debe ser PNG, JPG o WebP y pesar máximo 5 MB.');
  var folderId = getEmailAssetsFolder().getId();
  var parents = file.getParents();
  var belongsToFolder = false;
  while (parents.hasNext()) if (parents.next().getId() === folderId) { belongsToFolder = true; break; }
  if (!belongsToFolder) throw new Error('El logo no pertenece a la carpeta autorizada.');
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  var existing = getGmailConfigRecord(ss) || {};
  var config = {
    id: existing.id || 'xph-gmail', enabled: businessBoolean(existing.enabled), connectedEmail: existing.connectedEmail || '',
    senderName: existing.senderName || 'XPH Fotografía & Video', replyTo: existing.replyTo || '', signatureHtml: existing.signatureHtml || '',
    logoFileId: fileId, autoPaymentReceived: businessBoolean(existing.autoPaymentReceived), autoPaymentDue: businessBoolean(existing.autoPaymentDue),
    autoEventReminders: businessBoolean(existing.autoEventReminders), updatedAt: businessNow()
  };
  upsertBusinessRecord(ss, 'Gmail_Config', BUSINESS_HEADERS.gmailConfig, config);
  logAudit(ss, 'LOGO_CORREO_ACTUALIZADO', { fileId: fileId, mimeType: mimeType, size: size }, fileId, 'Admin XPH');
  return { status: 'success', gmailConfig: publicGmailConfig(config) };
}

function finalizeDrivePhotoUpload(ss, payload) {
  payload = payload || {};
  var fileId = cleanBusinessText(payload.fileId || '', 100);
  if (!fileId) throw new Error('Google Drive no devolvió el archivo cargado.');
  var file = DriveApp.getFileById(fileId);
  var mimeType = String(file.getMimeType() || '').toLowerCase();
  if (mimeType.indexOf('image/') !== 0) throw new Error('El archivo recibido no es una fotografía válida.');
  var folderId = driveUploadFolder().getId();
  var parents = file.getParents();
  var belongsToFolder = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) { belongsToFolder = true; break; }
  }
  if (!belongsToFolder) throw new Error('La fotografía no pertenece a la carpeta autorizada.');
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  var title = cleanBusinessText(payload.title || file.getName().replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '), 180);
  var category = cleanBusinessText(payload.category || 'bodas', 80).toLowerCase();
  var location = cleanBusinessText(payload.location || 'CDMX', 180);
  var directUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
  var sheet = ss.getSheetByName('Galeria_Fotos');
  if (!sheet) { initSpreadsheetSheets(ss); sheet = ss.getSheetByName('Galeria_Fotos'); }
  sheet.appendRow([fileId, title, category, directUrl, location, new Date().toISOString().split('T')[0], 'ACTIVO']);
  var config = {};
  try { var raw = loadActiveConfig(); if (raw) config = JSON.parse(raw); } catch (_) {}
  var gallery = Array.isArray(config.galleryImages) ? config.galleryImages : [];
  gallery.unshift({ id: fileId, title: title, category: category, url: directUrl, location: location });
  config.galleryImages = gallery;
  saveActiveConfig(ss, JSON.stringify(config));
  logAudit(ss, 'SUBIDA_FOTOGRAFIA_DRIVE', 'Fotografía original registrada: ' + title, fileId, 'Admin XPH');
  return { status: 'success', fileId: fileId, url: directUrl, driveUrl: 'https://drive.google.com/file/d/' + fileId + '/view' };
}

function emptyCalendarSyncSummary() {
  return { processed: 0, synchronized: 0, failed: 0, created: 0, updated: 0, duplicatesDeleted: 0 };
}

function addCalendarSyncResult(summary, result) {
  summary.created += Number(result && result.created || 0);
  summary.updated += Number(result && result.updated || 0);
  summary.duplicatesDeleted += Number(result && result.duplicatesDeleted || 0);
  summary.failed += Number(result && result.failed || 0);
}

function syncCalendarClientRecord(ss, calendarClient) {
  if (!calendarClient) throw new Error('Cliente no localizado.');
  var syncSummary = emptyCalendarSyncSummary();
  syncSummary.processed = 1;
  var eventReady = Boolean(calendarClient.recordType === 'Cliente' && calendarClient.eventDate && String(calendarClient.status) !== 'Archivado');
  var sessionReady = Boolean(calendarClient.recordType === 'Cliente' && calendarClient.preSessionApplies && calendarClient.preSessionDate && String(calendarClient.preSessionStatus) !== 'Cancelada');
  var hasLinkedAssignment = readBusinessRecords(ss, 'Asignaciones_Equipo', BUSINESS_HEADERS.assignments).some(function(item) { return String(item.clientId) === String(calendarClient.id) && Boolean(item.calendarEventId); });
  if (!eventReady && !sessionReady && !calendarClient.calendarEventId && !calendarClient.preSessionCalendarEventId && !hasLinkedAssignment) throw new Error('Registra al menos la fecha del evento o de la sesión antes de sincronizar.');
  var calendar = CalendarApp.getDefaultCalendar();
  var guest = calendarClient.inviteClientToCalendar && calendarClient.email ? calendarClient.email : '';
  var eventTitle = 'XPH · ' + (calendarClient.eventType || 'Evento') + ' · ' + (calendarClient.name || calendarClient.honoreeName || 'Cliente');
  var eventDescription = 'Cliente: ' + (calendarClient.name || '') + '\nTeléfono: ' + (calendarClient.phone || '') + '\nPaquete: ' + (calendarClient.packageName || 'Por confirmar') + '\nContrato: ' + (calendarClient.contractId || 'Pendiente');
  var eventKey = 'client:' + calendarClient.id + ':event';
  var normalizedEventStart = null;
  if (calendarClient.eventDate) {
    calendarClient.eventDate = normalizeBusinessDate(calendarClient.eventDate);
    calendarClient.eventTime = normalizeBusinessTime(calendarClient.eventTime);
    normalizedEventStart = calendarClient.eventTime ? calendarDateTime(calendarClient.eventDate, calendarClient.eventTime) : calendarDateOnly(calendarClient.eventDate);
  }
  if (eventReady) {
    var mainEvent = upsertClientCalendarEvent(calendar, calendarClient.calendarEventId, eventTitle, normalizedEventStart, calendarClient.serviceHours || 1, calendarClient.eventLocation, eventDescription, guest, !calendarClient.eventTime, eventKey);
    calendarClient.calendarEventId = mainEvent.eventId;
    addCalendarSyncResult(syncSummary, mainEvent);
  } else {
    var removedMain = removeClientCalendarEvent(calendar, calendarClient.calendarEventId, normalizedEventStart ? eventKey : '', eventTitle, normalizedEventStart);
    calendarClient.calendarEventId = removedMain.eventId;
    syncSummary.duplicatesDeleted += Number(removedMain.duplicatesDeleted || 0);
  }
  var sessionTitle = 'XPH · ' + (calendarClient.preSessionType || 'Sesión previa') + ' · ' + (calendarClient.name || 'Cliente');
  var sessionKey = 'client:' + calendarClient.id + ':session';
  var normalizedSessionStart = null;
  if (calendarClient.preSessionDate) {
    calendarClient.preSessionDate = normalizeBusinessDate(calendarClient.preSessionDate);
    calendarClient.preSessionTime = normalizeBusinessTime(calendarClient.preSessionTime);
    normalizedSessionStart = calendarClient.preSessionTime ? calendarDateTime(calendarClient.preSessionDate, calendarClient.preSessionTime) : calendarDateOnly(calendarClient.preSessionDate);
  }
  if (sessionReady) {
    var sessionDuration = 2;
    if (calendarClient.preSessionTime && calendarClient.preSessionEndTime) {
      var sessionEnd = calendarDateTime(calendarClient.preSessionDate, calendarClient.preSessionEndTime);
      sessionDuration = Math.max(0.5, (sessionEnd.getTime() - normalizedSessionStart.getTime()) / 3600000);
    }
    var sessionEvent = upsertClientCalendarEvent(calendar, calendarClient.preSessionCalendarEventId, sessionTitle, normalizedSessionStart, sessionDuration, calendarClient.preSessionAddress || calendarClient.preSessionLocation, eventDescription + '\nNotas de sesión: ' + (calendarClient.preSessionNotes || 'Sin notas'), guest, !calendarClient.preSessionTime, sessionKey);
    calendarClient.preSessionCalendarEventId = sessionEvent.eventId;
    addCalendarSyncResult(syncSummary, sessionEvent);
  } else {
    var removedSession = removeClientCalendarEvent(calendar, calendarClient.preSessionCalendarEventId, normalizedSessionStart ? sessionKey : '', sessionTitle, normalizedSessionStart);
    calendarClient.preSessionCalendarEventId = removedSession.eventId;
    syncSummary.duplicatesDeleted += Number(removedSession.duplicatesDeleted || 0);
  }
  addCalendarSyncResult(syncSummary, syncClientAssignments(ss, calendarClient, eventReady, sessionReady));
  calendarClient.calendarSyncStatus = syncSummary.failed ? 'Error' : 'Sincronizado';
  calendarClient.calendarSyncedAt = businessNow();
  calendarClient.calendarSyncError = syncSummary.failed ? 'Una o más asignaciones de colaboradores no pudieron sincronizarse.' : '';
  calendarClient.updatedAt = businessNow();
  upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, calendarClient);
  syncSummary.synchronized = syncSummary.failed ? 0 : 1;
  logAudit(ss, 'CALENDARIO_RECONCILIADO', { title: eventTitle, session: sessionReady, created: syncSummary.created, updated: syncSummary.updated, duplicatesDeleted: syncSummary.duplicatesDeleted, failed: syncSummary.failed }, calendarClient.id, 'Admin XPH');
  return { client: calendarClient, summary: syncSummary };
}

function handleBusinessAction(ss, action, payload) {
  payload = payload || {};
  ensureBusinessSchema(ss);
  if (action === 'uploadInit') return createDriveResumableSession(payload);
  if (action === 'contractUploadInit') return createContractResumableSession(payload);
  if (action === 'gmailLogoUploadInit') return createEmailLogoResumableSession(payload);
  if (action === 'galleryUploadInit') return createClientGalleryUploadSession(ss, payload);
  if (action === 'uploadFinalize') return finalizeDrivePhotoUpload(ss, payload);
  if (action === 'gmailLogoUploadFinalize') return finalizeEmailLogoUpload(ss, payload);
  if (action === 'galleryUploadFinalize') return finalizeClientGalleryUpload(ss, payload);
  if (action === 'driveFolderImport') {
    var importedFolder;
    try { importedFolder = DriveApp.getFolderById(cleanBusinessText(payload.folderId, 200)); }
    catch (_) { throw new Error('No se pudo abrir la carpeta. Compártela con la cuenta propietaria del CRM o verifica la liga.'); }
    var importedFiles = [];
    var folderFiles = importedFolder.getFiles();
    while (folderFiles.hasNext() && importedFiles.length < 1000) {
      var importedFile = folderFiles.next();
      var importedMime = String(importedFile.getMimeType() || '').toLowerCase();
      if (importedMime.indexOf('image/') !== 0 && importedMime.indexOf('video/') !== 0) continue;
      try { importedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
      importedFiles.push({ id: importedFile.getId(), name: importedFile.getName(), mimeType: importedMime });
    }
    if (!importedFiles.length) throw new Error('La carpeta no contiene fotografías o videos compatibles en su nivel principal.');
    return { status: 'success', files: importedFiles };
  }
  if (action === 'driveManagedMediaDelete') {
    var managedFolderId = driveUploadFolder().getId();
    var requestedFileIds = Array.isArray(payload.fileIds) ? payload.fileIds.slice(0, 500) : [];
    var deletedFileIds = [];
    var retainedFileIds = [];
    requestedFileIds.forEach(function(rawFileId) {
      var managedFileId = cleanBusinessText(rawFileId, 200);
      if (!managedFileId) return;
      try {
        var managedFile = DriveApp.getFileById(managedFileId);
        var managedParents = managedFile.getParents();
        var belongsToManagedFolder = false;
        while (managedParents.hasNext()) {
          if (managedParents.next().getId() === managedFolderId) { belongsToManagedFolder = true; break; }
        }
        if (!belongsToManagedFolder) { retainedFileIds.push(managedFileId); return; }
        managedFile.setTrashed(true);
        deletedFileIds.push(managedFileId);
      } catch (_) { retainedFileIds.push(managedFileId); }
    });
    logAudit(ss, 'GALERIA_ARCHIVOS_ALMACENADOS_ELIMINADOS', { deleted: deletedFileIds, retained: retainedFileIds }, deletedFileIds.join(','), 'Admin XPH');
    return { status: 'success', deleted: deletedFileIds, retained: retainedFileIds };
  }
  if (action === 'businessClients') {
    return {
      status: 'success',
      clients: readBusinessRecords(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients)
    };
  }
  if (action === 'businessSnapshot') {
    if (businessBoolean(payload.force)) clearBusinessSnapshotCaches();
    var signatureRows = readBusinessRecords(ss, 'Firma_Administrador', BUSINESS_HEADERS.ownerSignature);
    var gmailConfigRows = readBusinessRecords(ss, 'Gmail_Config', BUSINESS_HEADERS.gmailConfig);
    return {
      status: 'success',
      snapshot: {
        clients: readBusinessRecords(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients),
        followUps: readBusinessRecords(ss, 'Seguimientos_CRM', BUSINESS_HEADERS.followUps),
        expenses: readBusinessRecords(ss, 'Gastos', BUSINESS_HEADERS.expenses),
        payments: readBusinessRecords(ss, 'Pagos_Clientes', BUSINESS_HEADERS.payments).map(publicPaymentRecord),
        transactions: readBusinessRecords(ss, 'Movimientos_Financieros', BUSINESS_HEADERS.transactions),
        adjustments: readBusinessRecords(ss, 'Ajustes_Financieros', BUSINESS_HEADERS.adjustments),
        packageSnapshots: readBusinessRecords(ss, 'Paquetes_Cliente', BUSINESS_HEADERS.packageSnapshots),
        services: readBusinessRecords(ss, 'Servicios_Contratados', BUSINESS_HEADERS.services),
        addons: readBusinessRecords(ss, 'Adicionales_Cliente', BUSINESS_HEADERS.addons),
        users: readBusinessRecords(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users).map(publicTeamUserRecord),
        teamFunctions: readBusinessRecords(ss, 'Funciones_Equipo', BUSINESS_HEADERS.teamFunctions),
        assignments: readBusinessRecords(ss, 'Asignaciones_Equipo', BUSINESS_HEADERS.assignments),
        gmailConfig: publicGmailConfig(gmailConfigRows.length ? gmailConfigRows[0] : null),
        emailTemplates: readBusinessRecords(ss, 'Plantillas_Email', BUSINESS_HEADERS.emailTemplates),
        emailHistory: readBusinessRecords(ss, 'Historial_Correos', BUSINESS_HEADERS.emailHistory).sort(function(a, b) { return String(b.sentAt || '').localeCompare(String(a.sentAt || '')); }).slice(0, 300),
        notifications: readBusinessRecords(ss, 'Notificaciones_CRM', BUSINESS_HEADERS.notifications).sort(function(a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); }).slice(0, 300),
        auditLog: readBusinessRecords(ss, 'Historial_Auditoria', ['Fecha_Hora', 'Accion', 'Detalles_Cambio', 'ID_Elemento', 'Usuario', 'Estado']).sort(function(a, b) { return String(b.Fecha_Hora || '').localeCompare(String(a.Fecha_Hora || '')); }).slice(0, 300),
        galleries: readBusinessRecords(ss, 'Galerias_Clientes', BUSINESS_HEADERS.galleries),
        internalEvents: readBusinessRecords(ss, 'Eventos_Internos', BUSINESS_HEADERS.internalEvents).map(publicInternalEventRecord),
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
    var clientStatuses = ['Nuevo', 'Contactado', 'Cotización enviada', 'Esperando respuesta', 'Seguimiento pendiente', 'Interesado', 'Negociación', 'Por cerrar', 'Seguimiento', 'Cierre prioritario', 'Contratado', 'No interesado', 'Sin interés', 'No responde', 'Archivado'];
    if (clientStatuses.indexOf(client.status) < 0) throw new Error('Estado de cliente no válido.');
    if (client.totalAmount > 0 && client.paidAmount > client.totalAmount) throw new Error('Lo pagado no puede ser mayor al total contratado.');
    upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, client);
    logAudit(ss, 'CRM_CLIENTE_GUARDADO', client.name || client.phone || client.id, client.id, 'Admin XPH');
    return { status: 'success', client: client };
  }

  if (action === 'followUpCreate') {
    var followInput = payload.followUp || {};
    var related = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, followInput.recordId);
    if (!related) throw new Error('Prospecto o cliente no localizado.');
    var followUp = normalizedFollowUp(followInput, related);
    if (!followUp.conversation && !followUp.result) throw new Error('Registra la conversación o el resultado del seguimiento.');
    upsertBusinessRecord(ss, 'Seguimientos_CRM', BUSINESS_HEADERS.followUps, followUp);
    related.lastContactAt = followUp.occurredAt;
    related.nextAction = followUp.nextAction;
    related.nextActionAt = followUp.nextActionAt;
    related.followUpAttempts = Number(related.followUpAttempts || 0) + 1;
    related.updatedAt = businessNow();
    upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, related);
    logAudit(ss, 'SEGUIMIENTO_CRM_CREADO', followUp.result || followUp.conversation, followUp.id, followUp.createdBy);
    return { status: 'success', followUp: followUp, client: related };
  }

  if (action === 'prospectConvert') {
    var prospect = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, payload.prospectId);
    if (!prospect) throw new Error('Prospecto no localizado.');
    if (String(prospect.recordType) === 'Cliente') return { status: 'success', client: prospect };
    prospect.recordType = 'Cliente';
    prospect.status = 'Contratado';
    prospect.eventId = prospect.eventId || businessId('evento');
    prospect.updatedAt = businessNow();
    upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, prospect);
    var followRows = readBusinessRecords(ss, 'Seguimientos_CRM', BUSINESS_HEADERS.followUps);
    followRows.forEach(function(item) {
      if (String(item.prospectId) === String(prospect.id)) {
        item.clientId = prospect.id;
        upsertBusinessRecord(ss, 'Seguimientos_CRM', BUSINESS_HEADERS.followUps, item);
      }
    });
    logAudit(ss, 'PROSPECTO_CONVERTIDO', prospect.name || prospect.phone, prospect.id, 'Admin XPH');
    return { status: 'success', client: prospect };
  }

  if (action === 'calendarSync') {
    var calendarClient = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, payload.clientId);
    var calendarResult = syncCalendarClientRecord(ss, calendarClient);
    return { status: 'success', client: calendarResult.client, summary: calendarResult.summary };
  }

  if (action === 'calendarSyncAll') {
    var allSummary = emptyCalendarSyncSummary();
    var eligibleClients = readBusinessRecords(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients).filter(function(item) {
      return String(item.recordType) === 'Cliente' && (item.eventDate || item.preSessionDate || item.calendarEventId || item.preSessionCalendarEventId);
    });
    var synchronizedClients = [];
    eligibleClients.forEach(function(item) {
      try {
        var result = syncCalendarClientRecord(ss, item);
        synchronizedClients.push(result.client);
        allSummary.processed++;
        allSummary.synchronized += Number(result.summary.synchronized || 0);
        allSummary.created += Number(result.summary.created || 0);
        allSummary.updated += Number(result.summary.updated || 0);
        allSummary.duplicatesDeleted += Number(result.summary.duplicatesDeleted || 0);
        allSummary.failed += Number(result.summary.failed || 0);
      } catch (error) {
        item.calendarSyncStatus = 'Error';
        item.calendarSyncError = cleanBusinessText(error && error.message || error, 1000);
        item.updatedAt = businessNow();
        upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, item);
        synchronizedClients.push(item);
        allSummary.processed++;
        allSummary.failed++;
      }
    });
    logAudit(ss, 'CALENDARIO_RECONCILIACION_MASIVA', allSummary, 'calendar-sync-all-' + Date.now(), 'Admin XPH');
    return { status: 'success', clients: synchronizedClients, summary: allSummary };
  }

  if (action === 'gmailConfigUpsert') {
    var gmailInput = payload.gmailConfig || {};
    var currentGmail = getGmailConfigRecord(ss) || {};
    var gmailEnabled = gmailInput.enabled !== undefined ? Boolean(gmailInput.enabled) : businessBoolean(currentGmail.enabled);
    var effectiveEmail = '';
    try { effectiveEmail = Session.getEffectiveUser().getEmail() || ''; } catch (_) {}
    var gmailConfig = {
      id: currentGmail.id || 'xph-gmail', enabled: gmailEnabled,
      connectedEmail: gmailEnabled ? (effectiveEmail || currentGmail.connectedEmail || '') : '',
      senderName: cleanBusinessText(gmailInput.senderName !== undefined ? gmailInput.senderName : currentGmail.senderName, 160) || 'XPH Fotografía & Video',
      replyTo: cleanBusinessText(gmailInput.replyTo !== undefined ? gmailInput.replyTo : currentGmail.replyTo, 180).toLowerCase(),
      signatureHtml: cleanBusinessText(gmailInput.signatureHtml !== undefined ? gmailInput.signatureHtml : currentGmail.signatureHtml, 12000),
      logoFileId: cleanBusinessText(currentGmail.logoFileId, 200),
      autoPaymentReceived: gmailInput.autoPaymentReceived !== undefined ? Boolean(gmailInput.autoPaymentReceived) : businessBoolean(currentGmail.autoPaymentReceived),
      autoPaymentDue: gmailInput.autoPaymentDue !== undefined ? Boolean(gmailInput.autoPaymentDue) : businessBoolean(currentGmail.autoPaymentDue),
      autoEventReminders: gmailInput.autoEventReminders !== undefined ? Boolean(gmailInput.autoEventReminders) : businessBoolean(currentGmail.autoEventReminders),
      updatedAt: businessNow()
    };
    if (gmailConfig.replyTo && !/^\S+@\S+\.\S+$/.test(gmailConfig.replyTo)) throw new Error('El correo de respuesta no es válido.');
    upsertBusinessRecord(ss, 'Gmail_Config', BUSINESS_HEADERS.gmailConfig, gmailConfig);
    logAudit(ss, gmailEnabled ? 'GMAIL_CRM_CONECTADO' : 'GMAIL_CRM_DESCONECTADO', { connectedEmail: gmailConfig.connectedEmail, automations: { paymentReceived: gmailConfig.autoPaymentReceived, paymentDue: gmailConfig.autoPaymentDue, eventReminders: gmailConfig.autoEventReminders } }, gmailConfig.id, 'Admin XPH');
    return { status: 'success', gmailConfig: publicGmailConfig(gmailConfig) };
  }

  if (action === 'gmailTest') {
    var testRecipient = cleanBusinessText(payload.recipient, 180).toLowerCase();
    var testHistory = sendCrmTemplateEmail(ss, { recipient: testRecipient, templateId: 'bienvenida', variables: clientEmailVariables({ name: 'Prueba XPH' }), mode: 'MANUAL', userId: payload.userId || 'xph-super-admin' });
    return { status: 'success', emailHistory: testHistory };
  }

  if (action === 'emailTemplateUpsert') {
    var templateInput = payload.emailTemplate || {};
    var existingTemplate = templateInput.id ? findBusinessRecord(ss, 'Plantillas_Email', BUSINESS_HEADERS.emailTemplates, templateInput.id) : null;
    var emailTemplate = {
      id: cleanBusinessText(templateInput.id || existingTemplate && existingTemplate.id || businessId('plantilla'), 120),
      name: cleanBusinessText(templateInput.name !== undefined ? templateInput.name : existingTemplate && existingTemplate.name, 160),
      subject: cleanBusinessText(templateInput.subject !== undefined ? templateInput.subject : existingTemplate && existingTemplate.subject, 300),
      htmlBody: cleanBusinessText(templateInput.htmlBody !== undefined ? templateInput.htmlBody : existingTemplate && existingTemplate.htmlBody, 30000),
      status: cleanBusinessText(templateInput.status || existingTemplate && existingTemplate.status || 'ACTIVA', 20),
      updatedAt: businessNow()
    };
    if (!emailTemplate.name || !emailTemplate.subject || !emailTemplate.htmlBody || ['ACTIVA', 'INACTIVA'].indexOf(emailTemplate.status) < 0) throw new Error('La plantilla requiere nombre, asunto, contenido y estado válido.');
    upsertBusinessRecord(ss, 'Plantillas_Email', BUSINESS_HEADERS.emailTemplates, emailTemplate);
    logAudit(ss, 'PLANTILLA_CORREO_GUARDADA', { before: existingTemplate || null, after: emailTemplate }, emailTemplate.id, 'Admin XPH');
    return { status: 'success', emailTemplate: emailTemplate };
  }

  if (action === 'emailSend') {
    var emailClient = payload.clientId ? findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, payload.clientId) : null;
    var recipient = cleanBusinessText(payload.recipient || emailClient && emailClient.email, 180);
    var manualVariables = clientEmailVariables(emailClient || {}, payload.variables || {});
    var sentEmail = sendCrmTemplateEmail(ss, { recipient: recipient, clientId: emailClient && emailClient.recordType === 'Cliente' ? emailClient.id : '', prospectId: emailClient && emailClient.recordType === 'Prospecto' ? emailClient.id : '', templateId: payload.templateId, variables: manualVariables, mode: 'MANUAL', userId: payload.userId || 'xph-super-admin' });
    return { status: 'success', emailHistory: sentEmail };
  }

  if (action === 'notificationRead') {
    var notification = findBusinessRecord(ss, 'Notificaciones_CRM', BUSINESS_HEADERS.notifications, payload.notificationId);
    if (!notification) throw new Error('Notificación no localizada.');
    notification.status = ['PENDIENTE', 'LEIDA', 'RESUELTA'].indexOf(String(payload.status)) >= 0 ? String(payload.status) : 'LEIDA';
    notification.updatedAt = businessNow();
    upsertBusinessRecord(ss, 'Notificaciones_CRM', BUSINESS_HEADERS.notifications, notification);
    return { status: 'success', notification: notification };
  }

  if (action === 'remindersRun') return processCrmRemindersInternal(ss);
  if (action === 'remindersInstall') return installCrmReminderTrigger();

  if (action === 'galleryCreate') return createClientGalleryRecord(ss, payload);

  if (action === 'galleryStatusUpdate') {
    var gallery = findBusinessRecord(ss, 'Galerias_Clientes', BUSINESS_HEADERS.galleries, payload.galleryId);
    if (!gallery) throw new Error('Galería no localizada.');
    var galleryStatus = cleanBusinessText(payload.status, 20);
    if (['BORRADOR', 'ACTIVA', 'LISTA', 'ARCHIVADA'].indexOf(galleryStatus) < 0) throw new Error('Estado de galería no válido.');
    var previousGalleryStatus = gallery.status;
    gallery.status = galleryStatus;
    gallery.updatedAt = businessNow();
    upsertBusinessRecord(ss, 'Galerias_Clientes', BUSINESS_HEADERS.galleries, gallery);
    logAudit(ss, 'ESTADO_GALERIA_ACTUALIZADO', { before: previousGalleryStatus, after: galleryStatus }, gallery.id, 'Admin XPH');
    return { status: 'success', gallery: gallery };
  }

  if (action === 'internalEventUpsert') {
    var internalInput = payload.internalEvent || {};
    var existingInternal = internalInput.id ? findBusinessRecord(ss, 'Eventos_Internos', BUSINESS_HEADERS.internalEvents, internalInput.id) : null;
    var internalTimestamp = businessNow();
    var internalEvent = {
      id: cleanBusinessText(internalInput.id || existingInternal && existingInternal.id || businessId('interno'), 120),
      title: cleanBusinessText(internalInput.title !== undefined ? internalInput.title : existingInternal && existingInternal.title, 240),
      activityType: cleanBusinessText(internalInput.activityType || existingInternal && existingInternal.activityType || 'Junta', 100),
      startDate: normalizeBusinessDate(internalInput.startDate !== undefined ? internalInput.startDate : existingInternal && existingInternal.startDate),
      startTime: normalizeBusinessTime(internalInput.startTime !== undefined ? internalInput.startTime : existingInternal && existingInternal.startTime),
      endDate: normalizeBusinessDate(internalInput.endDate !== undefined ? internalInput.endDate : existingInternal && existingInternal.endDate),
      endTime: normalizeBusinessTime(internalInput.endTime !== undefined ? internalInput.endTime : existingInternal && existingInternal.endTime),
      location: cleanBusinessText(internalInput.location !== undefined ? internalInput.location : existingInternal && existingInternal.location, 600),
      notes: cleanBusinessText(internalInput.notes !== undefined ? internalInput.notes : existingInternal && existingInternal.notes, 4000),
      visibility: cleanBusinessText(internalInput.visibility || existingInternal && existingInternal.visibility || 'SUPER_ADMIN', 30),
      userIdsJson: JSON.stringify(parseBusinessJsonArray(internalInput.userIds !== undefined ? internalInput.userIds : existingInternal && existingInternal.userIdsJson)),
      status: cleanBusinessText(internalInput.status || existingInternal && existingInternal.status || 'ACTIVO', 20),
      calendarEventId: cleanBusinessText(existingInternal && existingInternal.calendarEventId || internalInput.calendarEventId, 240),
      syncStatus: 'Pendiente', createdAt: cleanBusinessText(existingInternal && existingInternal.createdAt || internalTimestamp, 40), updatedAt: internalTimestamp
    };
    if (!internalEvent.title || !internalEvent.startDate || ['SUPER_ADMIN', 'SELECTED'].indexOf(internalEvent.visibility) < 0 || ['ACTIVO', 'CANCELADO'].indexOf(internalEvent.status) < 0) throw new Error('El evento interno requiere título, fecha, visibilidad y estado válidos.');
    var internalCalendar = CalendarApp.getDefaultCalendar();
    var internalAllDay = !internalEvent.startTime;
    var internalStart = internalAllDay ? calendarDateOnly(internalEvent.startDate) : calendarDateTime(internalEvent.startDate, internalEvent.startTime);
    var internalTitle = 'XPH · ' + internalEvent.activityType + ' · ' + internalEvent.title;
    var internalKey = 'internal:' + internalEvent.id;
    if (internalEvent.status === 'CANCELADO') internalEvent.calendarEventId = removeClientCalendarEvent(internalCalendar, internalEvent.calendarEventId, internalKey, internalTitle, internalStart).eventId;
    else {
      var duration = 1;
      if (!internalAllDay && internalEvent.endTime) {
        var internalEnd = calendarDateTime(internalEvent.endDate || internalEvent.startDate, internalEvent.endTime);
        duration = Math.max(0.5, (internalEnd.getTime() - internalStart.getTime()) / 3600000);
      }
      var syncedInternal = upsertClientCalendarEvent(internalCalendar, internalEvent.calendarEventId, internalTitle, internalStart, duration, internalEvent.location, internalEvent.notes, '', internalAllDay, internalKey);
      internalEvent.calendarEventId = syncedInternal.eventId;
    }
    internalEvent.syncStatus = 'Sincronizado';
    upsertBusinessRecord(ss, 'Eventos_Internos', BUSINESS_HEADERS.internalEvents, internalEvent);
    logAudit(ss, 'EVENTO_INTERNO_GUARDADO', { before: existingInternal || null, after: publicInternalEventRecord(internalEvent) }, internalEvent.id, 'Admin XPH');
    return { status: 'success', internalEvent: publicInternalEventRecord(internalEvent) };
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

  if (action === 'paymentUpsert') {
    var paymentInput = payload.payment || {};
    var existingPayment = paymentInput.id ? findBusinessRecord(ss, 'Pagos_Clientes', BUSINESS_HEADERS.payments, paymentInput.id) : null;
    var clientForPayment = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, paymentInput.clientId || (existingPayment && existingPayment.clientId));
    if (!clientForPayment) throw new Error('El pago requiere un cliente válido.');

    var existingClientPayments = readBusinessRecords(ss, 'Pagos_Clientes', BUSINESS_HEADERS.payments).filter(function(item) { return String(item.clientId) === String(clientForPayment.id); });
    if (!existingPayment && !existingClientPayments.length && Number(clientForPayment.paidAmount) > 0) {
      var legacyPayment = normalizedPayment({ clientId: clientForPayment.id, contractId: clientForPayment.contractId || '', date: businessNow().substring(0, 10), concept: 'Saldo cobrado anterior al historial', plannedAmount: Number(clientForPayment.paidAmount), receivedAmount: Number(clientForPayment.paidAmount), status: 'Liquidado', notes: 'Migración automática del acumulado existente.' }, null);
      upsertBusinessRecord(ss, 'Pagos_Clientes', BUSINESS_HEADERS.payments, legacyPayment);
    }

    var payment = normalizedPayment(paymentInput, existingPayment);
    if (['Pendiente', 'Parcial', 'Liquidado', 'Anulado'].indexOf(payment.status) < 0) throw new Error('Estado de pago no válido.');
    if (!payment.concept || payment.plannedAmount <= 0) throw new Error('El pago requiere concepto y monto programado.');
    if (payment.installmentNumber < 0 || payment.installmentNumber > 99 || payment.percentage < 0 || payment.percentage > 100) throw new Error('Número de pago o porcentaje no válido.');
    var planPayments = existingClientPayments.filter(function(item) {
      return payment.contractId ? String(item.contractId) === String(payment.contractId) : !item.contractId;
    });
    var duplicateInstallment = payment.installmentNumber > 0 && planPayments.some(function(item) {
      return String(item.id) !== String(payment.id) && Number(item.installmentNumber) === Number(payment.installmentNumber) && String(item.status) !== 'Anulado';
    });
    if (duplicateInstallment) throw new Error('Ese número de pago ya está registrado para el cliente. Edita el movimiento existente.');
    var otherActivePlanPayments = planPayments.filter(function(item) {
      return String(item.id) !== String(payment.id) && String(item.status) !== 'Anulado' && Number(item.installmentNumber) > 0;
    });
    var plannedTotal = otherActivePlanPayments.reduce(function(sum, item) { return sum + Number(item.plannedAmount || 0); }, 0) + payment.plannedAmount;
    if (Number(clientForPayment.totalAmount) > 0 && plannedTotal > Number(clientForPayment.totalAmount) + 0.011) throw new Error('El plan de pagos no puede superar el total contratado. Ajusta el contrato o los pagos programados.');
    if ((payment.status === 'Liquidado' || payment.status === 'Parcial') && payment.receivedAmount <= 0) throw new Error('Un pago cobrado requiere monto recibido.');
    if (payment.receivedAmount > payment.plannedAmount) throw new Error('Lo recibido no puede superar el monto programado. Registra otro abono parcial.');
    if (paymentInput.receiptBase64) {
      var mime = cleanBusinessText(paymentInput.receiptMimeType, 100);
      if (['image/jpeg', 'image/png', 'application/pdf'].indexOf(mime) < 0) throw new Error('Formato de comprobante no válido.');
      var filename = cleanBusinessText(paymentInput.receiptFileName || ('Comprobante-' + payment.id), 220);
      var receipt = getPaymentReceiptsFolder().createFile(base64Blob(paymentInput.receiptBase64, mime, filename));
      payment.receiptFileId = receipt.getId();
      payment.receiptFileName = filename;
    }
    var previousState = existingPayment ? { status: existingPayment.status, plannedAmount: existingPayment.plannedAmount, receivedAmount: existingPayment.receivedAmount, date: existingPayment.date } : null;
    var transaction = syncPaymentTransaction(ss, payment, existingPayment);
    upsertBusinessRecord(ss, 'Pagos_Clientes', BUSINESS_HEADERS.payments, payment);
    var updatedPaymentClient = syncClientPaidAmount(ss, payment.clientId);
    logAudit(ss, 'PAGO_CLIENTE_GUARDADO', { before: previousState, after: { status: payment.status, plannedAmount: payment.plannedAmount, receivedAmount: payment.receivedAmount, date: payment.date, paidAt: payment.paidAt }, transactionId: transaction.id, transactionStatus: transaction.status }, payment.id, payment.recordedBy);
    var previousReceived = Number(existingPayment && existingPayment.receivedAmount || 0);
    var newReceived = Number(payment.receivedAmount || 0);
    var paymentGmailConfig = getGmailConfigRecord(ss);
    if (newReceived > previousReceived && ['Parcial', 'Liquidado'].indexOf(String(payment.status)) >= 0 && paymentGmailConfig && businessBoolean(paymentGmailConfig.autoPaymentReceived) && updatedPaymentClient && updatedPaymentClient.email) {
      try {
        sendCrmTemplateEmail(ss, { recipient: updatedPaymentClient.email, clientId: updatedPaymentClient.id, templateId: 'pago-recibido', variables: clientEmailVariables(updatedPaymentClient, { monto_pago: '$' + (newReceived - previousReceived).toFixed(2), fecha_pago: payment.paidAt || payment.date }), mode: 'AUTOMATICO', historyId: 'correo-pago-recibido-' + payment.id + '-' + Math.round(newReceived * 100) });
      } catch (emailError) {
        upsertCrmNotification(ss, { type: 'ERROR_GMAIL', title: 'No se envió la confirmación de pago', message: (updatedPaymentClient.name || 'Cliente') + ' · ' + cleanBusinessText(emailError && emailError.message || emailError, 500), relatedId: payment.id, dedupeKey: 'error-gmail-pago-' + payment.id + '-' + Math.round(newReceived * 100) });
      }
    }
    return { status: 'success', payment: publicPaymentRecord(payment), transaction: transaction, client: updatedPaymentClient };
  }

  if (action === 'adjustmentUpsert') {
    var adjustmentInput = payload.adjustment || {};
    var existingAdjustment = adjustmentInput.id ? findBusinessRecord(ss, 'Ajustes_Financieros', BUSINESS_HEADERS.adjustments, adjustmentInput.id) : null;
    var adjustmentTimestamp = businessNow();
    var adjustment = {
      id: cleanBusinessText(adjustmentInput.id || (existingAdjustment && existingAdjustment.id) || businessId('ajuste'), 120),
      date: cleanBusinessText(adjustmentInput.date || (existingAdjustment && existingAdjustment.date) || adjustmentTimestamp.substring(0, 10), 40),
      category: cleanBusinessText(adjustmentInput.category || (existingAdjustment && existingAdjustment.category) || 'Ajuste financiero', 100),
      concept: cleanBusinessText(adjustmentInput.concept !== undefined ? adjustmentInput.concept : (existingAdjustment && existingAdjustment.concept), 300),
      amount: Number(adjustmentInput.amount !== undefined ? adjustmentInput.amount : (existingAdjustment && existingAdjustment.amount)) || 0,
      notes: cleanBusinessText(adjustmentInput.notes !== undefined ? adjustmentInput.notes : (existingAdjustment && existingAdjustment.notes), 3000),
      status: cleanBusinessText(adjustmentInput.status || (existingAdjustment && existingAdjustment.status) || 'ACTIVO', 20),
      createdBy: cleanBusinessText(adjustmentInput.createdBy || (existingAdjustment && existingAdjustment.createdBy) || 'Admin XPH', 180),
      createdAt: cleanBusinessText((existingAdjustment && existingAdjustment.createdAt) || adjustmentInput.createdAt || adjustmentTimestamp, 40),
      updatedAt: adjustmentTimestamp
    };
    if (['Gasto no registrado', 'Pendiente por identificar', 'Ajuste financiero', 'Otro'].indexOf(adjustment.category) < 0) throw new Error('Categoría de ajuste no válida.');
    if (['ACTIVO', 'ANULADO'].indexOf(adjustment.status) < 0) throw new Error('Estado de ajuste no válido.');
    if (!adjustment.concept || Math.abs(adjustment.amount) < 0.005) throw new Error('El ajuste requiere concepto e importe diferente de cero.');
    upsertBusinessRecord(ss, 'Ajustes_Financieros', BUSINESS_HEADERS.adjustments, adjustment);
    logAudit(ss, 'AJUSTE_FINANCIERO_GUARDADO', { before: existingAdjustment || null, after: adjustment }, adjustment.id, adjustment.createdBy);
    return { status: 'success', adjustment: adjustment };
  }

  if (action === 'clientPackageAssign') {
    var packageInput = payload.package || {};
    var packageClient = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, payload.clientId);
    if (!packageClient || String(packageClient.recordType) !== 'Cliente') throw new Error('Selecciona un cliente válido para asignar el paquete.');
    packageClient.eventId = packageClient.eventId || businessId('evento');
    var packageTimestamp = businessNow();
    var currentSnapshots = readBusinessRecords(ss, 'Paquetes_Cliente', BUSINESS_HEADERS.packageSnapshots)
      .filter(function(item) { return String(item.clientId) === String(packageClient.id) && String(item.status) === 'ACTIVO'; });
    var currentSnapshot = currentSnapshots.length ? currentSnapshots[0] : null;
    if (currentSnapshot && String(currentSnapshot.packageId) !== String(packageInput.id || '')) {
      currentSnapshot.status = 'REEMPLAZADO';
      currentSnapshot.updatedAt = packageTimestamp;
      upsertBusinessRecord(ss, 'Paquetes_Cliente', BUSINESS_HEADERS.packageSnapshots, currentSnapshot);
      currentSnapshot = null;
    }
    var packageSnapshot = {
      id: cleanBusinessText((currentSnapshot && currentSnapshot.id) || businessId('paquete-cliente'), 120),
      clientId: packageClient.id,
      eventId: packageClient.eventId,
      packageId: cleanBusinessText(packageInput.id, 120),
      category: cleanBusinessText(payload.category, 100),
      packageName: cleanBusinessText(packageInput.name, 200),
      basePrice: Math.max(0, Number(packageInput.price) || 0),
      discount: Math.max(0, Number(payload.discount) || 0),
      promotion: cleanBusinessText(payload.promotion, 500),
      finalTotal: 0,
      originalJson: (currentSnapshot && currentSnapshot.originalJson) || JSON.stringify(packageInput),
      status: 'ACTIVO',
      createdAt: (currentSnapshot && currentSnapshot.createdAt) || packageTimestamp,
      updatedAt: packageTimestamp
    };
    if (!packageSnapshot.packageId || !packageSnapshot.packageName) throw new Error('El paquete seleccionado no es válido.');
    upsertBusinessRecord(ss, 'Paquetes_Cliente', BUSINESS_HEADERS.packageSnapshots, packageSnapshot);
    var packageServices = Array.isArray(packageInput.features) ? packageInput.features : [];
    var existingServices = readBusinessRecords(ss, 'Servicios_Contratados', BUSINESS_HEADERS.services)
      .filter(function(item) { return String(item.packageSnapshotId) === String(packageSnapshot.id); });
    packageServices.forEach(function(feature) {
      var concept = cleanBusinessText(feature, 300);
      if (!concept) return;
      var existingService = existingServices.find(function(item) { return String(item.concept).toLowerCase() === concept.toLowerCase(); });
      if (!existingService) {
        var service = normalizedContractedService({ packageSnapshotId: packageSnapshot.id, source: 'PAQUETE', concept: concept, included: true, quantity: 1, unitPrice: 0, total: 0, status: 'Pendiente' }, null, packageClient);
        upsertBusinessRecord(ss, 'Servicios_Contratados', BUSINESS_HEADERS.services, service);
        existingServices.push(service);
      }
      if (/sesión.*previa|sesion.*previa|preboda/i.test(concept)) {
        packageClient.preSessionApplies = true;
        packageClient.preSessionStatus = packageClient.preSessionDate ? 'Agendada' : 'Pendiente por agendar';
      }
    });
    upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, packageClient);
    var packageTotals = syncClientContractTotal(ss, packageClient.id);
    logAudit(ss, 'PAQUETE_CLIENTE_ASIGNADO', { packageOriginal: packageSnapshot.originalJson, packageSnapshotId: packageSnapshot.id, clientId: packageClient.id }, packageSnapshot.id, 'Admin XPH');
    return { status: 'success', packageSnapshot: packageTotals.packageSnapshot, services: existingServices, client: packageTotals.client };
  }

  if (action === 'serviceUpsert') {
    var serviceInput = payload.service || {};
    var serviceClient = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, serviceInput.clientId);
    if (!serviceClient) throw new Error('El servicio requiere un cliente válido.');
    var existingServiceRecord = serviceInput.id ? findBusinessRecord(ss, 'Servicios_Contratados', BUSINESS_HEADERS.services, serviceInput.id) : null;
    var contractedService = normalizedContractedService(serviceInput, existingServiceRecord, serviceClient);
    if (!contractedService.concept || contractedService.quantity <= 0) throw new Error('El servicio requiere concepto y cantidad válida.');
    if (['PAQUETE', 'MANUAL'].indexOf(contractedService.source) < 0) throw new Error('Origen de servicio no válido.');
    upsertBusinessRecord(ss, 'Servicios_Contratados', BUSINESS_HEADERS.services, contractedService);
    logAudit(ss, 'SERVICIO_CONTRATADO_GUARDADO', { before: existingServiceRecord || null, after: contractedService }, contractedService.id, 'Admin XPH');
    return { status: 'success', service: contractedService };
  }

  if (action === 'addonUpsert') {
    var addonInput = payload.addon || {};
    var addonClient = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, addonInput.clientId);
    if (!addonClient) throw new Error('El adicional requiere un cliente válido.');
    var existingAddon = addonInput.id ? findBusinessRecord(ss, 'Adicionales_Cliente', BUSINESS_HEADERS.addons, addonInput.id) : null;
    var addon = normalizedClientAddon(addonInput, existingAddon, addonClient);
    if (!addon.concept || addon.quantity <= 0) throw new Error('El adicional requiere concepto y cantidad válida.');
    if (['Pendiente', 'Confirmado', 'Entregado', 'Anulado'].indexOf(addon.status) < 0) throw new Error('Estado de adicional no válido.');
    upsertBusinessRecord(ss, 'Adicionales_Cliente', BUSINESS_HEADERS.addons, addon);
    var addonTotals = syncClientContractTotal(ss, addon.clientId);
    logAudit(ss, 'ADICIONAL_CLIENTE_GUARDADO', { before: existingAddon || null, after: addon, totalContratado: addonTotals.client.totalAmount }, addon.id, 'Admin XPH');
    return { status: 'success', addon: addon, client: addonTotals.client, packageSnapshot: addonTotals.packageSnapshot };
  }

  if (action === 'teamFunctionUpsert') {
    var functionInput = payload.teamFunction || {};
    var existingFunction = functionInput.id ? findBusinessRecord(ss, 'Funciones_Equipo', BUSINESS_HEADERS.teamFunctions, functionInput.id) : null;
    var functionTimestamp = businessNow();
    var teamFunction = {
      id: cleanBusinessText(functionInput.id || (existingFunction && existingFunction.id) || businessId('funcion'), 120),
      name: cleanBusinessText(functionInput.name !== undefined ? functionInput.name : (existingFunction && existingFunction.name), 120),
      status: cleanBusinessText(functionInput.status || (existingFunction && existingFunction.status) || 'ACTIVA', 20),
      createdAt: cleanBusinessText((existingFunction && existingFunction.createdAt) || functionTimestamp, 40),
      updatedAt: functionTimestamp
    };
    if (!teamFunction.name || ['ACTIVA', 'INACTIVA'].indexOf(teamFunction.status) < 0) throw new Error('La función requiere nombre y estado válido.');
    upsertBusinessRecord(ss, 'Funciones_Equipo', BUSINESS_HEADERS.teamFunctions, teamFunction);
    logAudit(ss, 'FUNCION_EQUIPO_GUARDADA', { before: existingFunction || null, after: teamFunction }, teamFunction.id, 'Admin XPH');
    return { status: 'success', teamFunction: teamFunction };
  }

  if (action === 'teamUserUpsert') {
    var userInput = payload.user || {};
    var existingUser = userInput.id ? findBusinessRecord(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users, userInput.id) : null;
    var teamUser = normalizedTeamUser(userInput, existingUser);
    if (!teamUser.name || !teamUser.email || teamUser.email.indexOf('@') < 1) throw new Error('El usuario requiere nombre y correo válido.');
    if (['INVITADO', 'ACTIVO', 'INACTIVO'].indexOf(teamUser.status) < 0) throw new Error('Estado de usuario no válido.');
    var duplicateUser = readBusinessRecords(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users).some(function(item) { return String(item.id) !== String(teamUser.id) && String(item.email).toLowerCase() === teamUser.email; });
    if (duplicateUser) throw new Error('Ya existe un usuario con ese correo.');
    upsertBusinessRecord(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users, teamUser);
    logAudit(ss, 'USUARIO_EQUIPO_GUARDADO', { before: existingUser ? publicTeamUserRecord(existingUser) : null, after: publicTeamUserRecord(teamUser) }, teamUser.id, 'Admin XPH');
    return { status: 'success', user: publicTeamUserRecord(teamUser) };
  }

  if (action === 'teamInviteCreate') {
    var invitedUser = findBusinessRecord(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users, payload.userId);
    if (!invitedUser || !invitedUser.email) throw new Error('Usuario no localizado para invitación.');
    var inviteTimestamp = businessNow();
    var invitation = {
      id: businessId('invitacion'), userId: invitedUser.id, email: invitedUser.email,
      tokenHash: cleanBusinessText(payload.tokenHash, 240), expiresAt: cleanBusinessText(payload.expiresAt, 50),
      status: 'ACTIVA', createdAt: inviteTimestamp, usedAt: ''
    };
    if (!invitation.tokenHash || !payload.inviteUrl) throw new Error('La invitación segura está incompleta.');
    var previousInvites = readBusinessRecords(ss, 'Invitaciones_Usuarios', BUSINESS_HEADERS.invitations);
    previousInvites.forEach(function(item) {
      if (String(item.userId) === String(invitedUser.id) && String(item.status) === 'ACTIVA') {
        item.status = 'REEMPLAZADA';
        upsertBusinessRecord(ss, 'Invitaciones_Usuarios', BUSINESS_HEADERS.invitations, item);
      }
    });
    upsertBusinessRecord(ss, 'Invitaciones_Usuarios', BUSINESS_HEADERS.invitations, invitation);
    invitedUser.status = 'INVITADO';
    invitedUser.updatedAt = inviteTimestamp;
    upsertBusinessRecord(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users, invitedUser);
    var inviteHtml = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827"><h2>Invitación al equipo XPH</h2><p>Hola ' + (invitedUser.displayName || invitedUser.name) + ',</p><p>Javier te invitó al CRM de XPH Fotografía & Video como <strong>' + (invitedUser.functionName || 'colaborador') + '</strong>.</p><p><a href="' + payload.inviteUrl + '" style="display:inline-block;background:#D4AF37;color:#111;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Continuar con Google</a></p><p style="font-size:12px;color:#6b7280">La invitación caduca el ' + invitation.expiresAt + ' y solo funciona con ' + invitedUser.email + '.</p></div>';
    GmailApp.sendEmail(invitedUser.email, 'Invitación al CRM de XPH Fotografía & Video', 'Abre esta invitación para continuar con Google: ' + payload.inviteUrl, { htmlBody: inviteHtml, name: 'XPH Fotografía & Video' });
    logAudit(ss, 'INVITACION_USUARIO_ENVIADA', { userId: invitedUser.id, email: invitedUser.email, expiresAt: invitation.expiresAt }, invitation.id, 'Admin XPH');
    return { status: 'success', invitationId: invitation.id, expiresAt: invitation.expiresAt, user: publicTeamUserRecord(invitedUser) };
  }

  if (action === 'teamInviteResolve') {
    var inviteRows = readBusinessRecords(ss, 'Invitaciones_Usuarios', BUSINESS_HEADERS.invitations);
    var resolvedInvite = inviteRows.find(function(item) { return String(item.tokenHash) === String(payload.tokenHash); });
    if (!resolvedInvite || String(resolvedInvite.status) !== 'ACTIVA' || new Date(resolvedInvite.expiresAt).getTime() <= Date.now()) throw new Error('La invitación no es válida o ya caducó.');
    var resolvedUser = findBusinessRecord(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users, resolvedInvite.userId);
    if (!resolvedUser || String(resolvedUser.status) === 'INACTIVO') throw new Error('El usuario invitado ya no está activo.');
    return { status: 'success', invitationId: resolvedInvite.id, user: publicTeamUserRecord(resolvedUser) };
  }

  if (action === 'teamGoogleConnect') {
    var connectInvites = readBusinessRecords(ss, 'Invitaciones_Usuarios', BUSINESS_HEADERS.invitations);
    var connectInvite = connectInvites.find(function(item) { return String(item.tokenHash) === String(payload.tokenHash); });
    if (!connectInvite || String(connectInvite.status) !== 'ACTIVA' || new Date(connectInvite.expiresAt).getTime() <= Date.now()) throw new Error('La invitación ya no está activa.');
    var connectedUser = findBusinessRecord(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users, connectInvite.userId);
    if (!connectedUser || String(connectedUser.email).toLowerCase() !== String(payload.googleEmail || '').toLowerCase()) throw new Error('La cuenta de Google no coincide con el correo invitado.');
    connectedUser.googleConnected = true;
    connectedUser.googleSubject = cleanBusinessText(payload.googleSubject, 240);
    connectedUser.googleEmail = cleanBusinessText(payload.googleEmail, 180).toLowerCase();
    connectedUser.calendarConnected = Boolean(payload.refreshToken || payload.accessToken);
    connectedUser.status = 'ACTIVO';
    connectedUser.updatedAt = businessNow();
    upsertBusinessRecord(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users, connectedUser);
    PropertiesService.getScriptProperties().setProperty('xph_user_oauth_' + connectedUser.id, JSON.stringify({ accessToken: cleanBusinessText(payload.accessToken, 5000), refreshToken: cleanBusinessText(payload.refreshToken, 5000), expiresAt: Date.now() + Number(payload.expiresIn || 3600) * 1000 }));
    connectInvite.status = 'USADA';
    connectInvite.usedAt = businessNow();
    upsertBusinessRecord(ss, 'Invitaciones_Usuarios', BUSINESS_HEADERS.invitations, connectInvite);
    logAudit(ss, 'USUARIO_GOOGLE_CONECTADO', { userId: connectedUser.id, googleEmail: connectedUser.googleEmail, calendarConnected: connectedUser.calendarConnected }, connectedUser.id, connectedUser.email);
    return { status: 'success', user: publicTeamUserRecord(connectedUser) };
  }

  if (action === 'teamAssignmentUpsert') {
    var assignmentInput = payload.assignment || {};
    var assignmentClient = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, assignmentInput.clientId);
    var assignmentUser = findBusinessRecord(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users, assignmentInput.userId);
    if (!assignmentClient || !assignmentUser) throw new Error('La asignación requiere cliente y colaborador válidos.');
    var existingAssignment = assignmentInput.id ? findBusinessRecord(ss, 'Asignaciones_Equipo', BUSINESS_HEADERS.assignments, assignmentInput.id) : null;
    var assignmentTimestamp = businessNow();
    var assignment = {
      id: cleanBusinessText(assignmentInput.id || (existingAssignment && existingAssignment.id) || businessId('asignacion'), 120),
      clientId: assignmentClient.id, eventId: cleanBusinessText(assignmentInput.eventId || assignmentClient.eventId, 120), userId: assignmentUser.id,
      functionName: cleanBusinessText(assignmentInput.functionName || assignmentUser.functionName, 120), activityType: cleanBusinessText(assignmentInput.activityType || assignmentClient.eventType || 'Evento', 120),
      scheduleSource: cleanBusinessText(assignmentInput.scheduleSource || existingAssignment && existingAssignment.scheduleSource || 'EVENT', 20).toUpperCase(),
      startDate: normalizeBusinessDate(assignmentInput.startDate || assignmentClient.eventDate), startTime: normalizeBusinessTime(assignmentInput.startTime || assignmentClient.eventTime),
      endDate: normalizeBusinessDate(assignmentInput.endDate || assignmentInput.startDate || assignmentClient.eventDate), endTime: normalizeBusinessTime(assignmentInput.endTime),
      notes: cleanBusinessText(assignmentInput.notes, 3000), status: cleanBusinessText(assignmentInput.status || 'ACTIVA', 20),
      calendarEventId: cleanBusinessText((existingAssignment && existingAssignment.calendarEventId) || assignmentInput.calendarEventId, 240), syncStatus: 'Pendiente',
      createdAt: cleanBusinessText((existingAssignment && existingAssignment.createdAt) || assignmentTimestamp, 40), updatedAt: assignmentTimestamp
    };
    if (!assignment.startDate || ['ACTIVA', 'CANCELADA'].indexOf(assignment.status) < 0 || ['EVENT', 'SESSION', 'MANUAL'].indexOf(assignment.scheduleSource) < 0) throw new Error('Fecha, origen o estado de asignación no válido.');
    var newStart = assignmentDateTime(assignment.startDate, assignment.startTime || '00:00');
    var newEnd = assignmentDateTime(assignment.endDate || assignment.startDate, assignment.endTime || assignment.startTime || '23:59');
    var conflicts = readBusinessRecords(ss, 'Asignaciones_Equipo', BUSINESS_HEADERS.assignments).filter(function(item) {
      if (String(item.id) === String(assignment.id) || String(item.userId) !== String(assignment.userId) || String(item.status) !== 'ACTIVA') return false;
      var itemStart = assignmentDateTime(item.startDate, item.startTime || '00:00');
      var itemEnd = assignmentDateTime(item.endDate || item.startDate, item.endTime || item.startTime || '23:59');
      return newStart.getTime() < itemEnd.getTime() && newEnd.getTime() > itemStart.getTime();
    });
    if (conflicts.length && !payload.allowOverride) return { status: 'success', conflict: conflicts[0] };
    if (existingAssignment && String(existingAssignment.userId) !== String(assignment.userId) && existingAssignment.calendarEventId) {
      var previousAssignmentUser = findBusinessRecord(ss, 'Usuarios_CRM', BUSINESS_HEADERS.users, existingAssignment.userId);
      if (previousAssignmentUser) {
        try { syncAssignmentToCollaboratorCalendar(previousAssignmentUser, Object.assign({}, existingAssignment, { status: 'CANCELADA' }), assignmentClient); } catch (_) {}
      }
      assignment.calendarEventId = '';
    }
    var calendarSync = syncAssignmentToCollaboratorCalendar(assignmentUser, assignment, assignmentClient);
    assignment.calendarEventId = calendarSync.eventId;
    assignment.syncStatus = calendarSync.status;
    upsertBusinessRecord(ss, 'Asignaciones_Equipo', BUSINESS_HEADERS.assignments, assignment);
    logAudit(ss, 'ASIGNACION_EQUIPO_GUARDADA', { before: existingAssignment || null, after: assignment, overrideConflict: Boolean(conflicts.length && payload.allowOverride) }, assignment.id, 'Admin XPH');
    return { status: 'success', assignment: assignment, conflict: conflicts.length ? conflicts[0] : null };
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

  if (action === 'contractGenerate') {
    var generatedInput = payload.contract || {};
    var generatedClient = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, generatedInput.clientId);
    if (!generatedClient) throw new Error('Prospecto o cliente no encontrado.');
    var generatedJson = cleanBusinessText(generatedInput.documentJson, 100000);
    var generatedSnapshot = null;
    try { generatedSnapshot = JSON.parse(generatedJson); } catch (_) { throw new Error('Los datos del documento no son válidos.'); }
    if (!generatedSnapshot || !generatedSnapshot.client || !generatedSnapshot.event || !generatedSnapshot.commercial) throw new Error('El documento está incompleto.');
    var generatedType = String(generatedInput.documentType || 'CONTRATO') === 'COTIZACION' ? 'COTIZACION' : 'CONTRATO';
    var generatedAt = businessNow();
    var generatedContract = {
      id: businessId(generatedType === 'COTIZACION' ? 'cotizacion' : 'contrato'),
      clientId: generatedClient.id,
      clientName: cleanBusinessText(generatedClient.name, 180),
      folio: cleanBusinessText(generatedInput.folio, 100),
      eventType: cleanBusinessText(generatedClient.eventType, 120),
      eventDate: cleanBusinessText(generatedClient.eventDate, 40),
      status: 'Preparado', originalFileName: '', originalFileId: '', clientSignedFileId: '', finalFileId: '', signatureFileId: '',
      tokenHash: '', tokenExpiresAt: '', tokenStatus: '', sentAt: '', viewedAt: '', acceptedAt: '', clientSignedAt: '', ownerAuthorizedAt: '',
      documentHash: '', signedDocumentHash: '', finalDocumentHash: '', signerIp: '', signerUserAgent: '', consentText: '',
      createdAt: generatedAt, updatedAt: generatedAt,
      documentType: generatedType,
      templateVersion: cleanBusinessText(generatedInput.templateVersion || 'canva-xph-v1', 80),
      documentJson: generatedJson,
      paymentPolicy: String(generatedInput.paymentPolicy || '40-30-30') === 'PERSONALIZADA' ? 'PERSONALIZADA' : '40-30-30',
      adminReviewUsed: false, clientOpenCount: 0, maxClientOpens: 2, clientSessionIdsJson: '[]',
      identificationFileId: '', identificationFileName: '', identificationUploadedAt: ''
    };
    upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, generatedContract);
    generatedClient.contractId = generatedType === 'CONTRATO' ? generatedContract.id : generatedClient.contractId;
    generatedClient.updatedAt = generatedAt;
    upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, generatedClient);
    logAudit(ss, generatedType + '_HTML_GENERADO', generatedContract.folio + ' | versión congelada ' + generatedContract.templateVersion, generatedContract.id, 'Admin XPH');
    return { status: 'success', contract: publicContractRecord(generatedContract) };
  }

  if (action === 'contractDocument') {
    var documentContract = findBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, payload.contractId);
    if (!documentContract) throw new Error('Documento no encontrado.');
    if (!documentContract.documentJson) throw new Error('Este contrato histórico utiliza PDF. Ábrelo con el visor anterior.');
    if (!businessBoolean(documentContract.adminReviewUsed)) {
      documentContract.adminReviewUsed = true;
      documentContract.updatedAt = businessNow();
      upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, documentContract);
      logAudit(ss, 'CONTRATO_REVISADO_ADMIN', documentContract.folio, documentContract.id, 'Admin XPH');
    }
    return { status: 'success', contract: publicContractRecord(documentContract) };
  }

  if (action === 'contractUploadFinalize') {
    var finalUpload = payload.contract || {};
    var uploadedFileId = cleanBusinessText(finalUpload.fileId, 200);
    if (!uploadedFileId || !finalUpload.clientId || !finalUpload.clientName || !finalUpload.folio) throw new Error('Faltan datos del contrato cargado.');
    var uploadedContractFile = DriveApp.getFileById(uploadedFileId);
    if (String(uploadedContractFile.getMimeType()).toLowerCase() !== 'application/pdf' || Number(uploadedContractFile.getSize()) > 5000000) throw new Error('El contrato debe ser PDF y pesar máximo 5 MB.');
    var contractsFolderId = getContractsFolder().getId();
    var uploadedParents = uploadedContractFile.getParents();
    var validContractParent = false;
    while (uploadedParents.hasNext()) if (uploadedParents.next().getId() === contractsFolderId) { validContractParent = true; break; }
    if (!validContractParent) throw new Error('El contrato no pertenece a la carpeta privada autorizada.');
    var finalizedContractId = businessId('contrato');
    var finalizedCreated = businessNow();
    var finalizedContract = {
      id: finalizedContractId, clientId: cleanBusinessText(finalUpload.clientId, 120), clientName: cleanBusinessText(finalUpload.clientName, 180),
      folio: cleanBusinessText(finalUpload.folio, 100), eventType: cleanBusinessText(finalUpload.eventType, 120), eventDate: cleanBusinessText(finalUpload.eventDate, 40),
      status: 'Preparado', originalFileName: cleanBusinessText(uploadedContractFile.getName(), 220), originalFileId: uploadedFileId,
      clientSignedFileId: '', finalFileId: '', signatureFileId: '', tokenHash: '', tokenExpiresAt: '', tokenStatus: '', sentAt: '', viewedAt: '', acceptedAt: '', clientSignedAt: '', ownerAuthorizedAt: '', documentHash: '', signedDocumentHash: '', finalDocumentHash: '', signerIp: '', signerUserAgent: '', consentText: '',
      createdAt: finalizedCreated, updatedAt: finalizedCreated
    };
    upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, finalizedContract);
    var finalizedLinkedClient = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, finalizedContract.clientId);
    if (finalizedLinkedClient) {
      finalizedLinkedClient.contractId = finalizedContract.id;
      finalizedLinkedClient.updatedAt = finalizedCreated;
      upsertBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, finalizedLinkedClient);
    }
    logAudit(ss, 'CONTRATO_PRIVADO_CARGADO', finalizedContract.folio + ' | ' + finalizedContract.clientName, finalizedContract.id, 'Admin XPH');
    return { status: 'success', contract: publicContractRecord(finalizedContract) };
  }

  if (action === 'contractCreateLink') {
    var linkContract = findBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, payload.contractId);
    if (!linkContract) throw new Error('Contrato no encontrado.');
    if (['Firmado por cliente', 'Finalizado', 'Cancelado'].indexOf(String(linkContract.status || '')) >= 0) throw new Error('El contrato ya no admite una liga nueva.');
    linkContract.tokenHash = cleanBusinessText(payload.tokenHash, 180);
    linkContract.tokenExpiresAt = cleanBusinessText(payload.expiresAt, 50);
    linkContract.tokenStatus = 'ACTIVO';
    linkContract.clientOpenCount = 0;
    linkContract.clientSessionIdsJson = '[]';
    linkContract.maxClientOpens = Number(linkContract.maxClientOpens || 2);
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
    var resolved = resolveSigningContract(ss, payload.token, payload.sessionId, Boolean(payload.markViewed));
    if (payload.markViewed) {
      resolved.viewedAt = resolved.viewedAt || businessNow();
      resolved.status = 'Visto';
      resolved.updatedAt = businessNow();
      upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, resolved);
    }
    var resolvedOutput = { status: 'success', contract: publicContractRecord(resolved) };
    if (payload.includePdf && resolved.originalFileId) resolvedOutput.pdfBase64 = fileBase64(resolved.originalFileId);
    return resolvedOutput;
  }

  if (action === 'contractCompleteSignature') {
    var signedContract = resolveSigningContract(ss, payload.token, '', false);
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
      'businessClients', 'businessSnapshot', 'uploadInit', 'uploadFinalize', 'driveFolderImport', 'driveManagedMediaDelete', 'contractUploadInit', 'contractUploadFinalize', 'gmailLogoUploadInit', 'gmailLogoUploadFinalize', 'galleryUploadInit', 'galleryUploadFinalize', 'galleryCreate', 'galleryStatusUpdate', 'internalEventUpsert', 'crmUpsert', 'followUpCreate', 'prospectConvert', 'calendarSync', 'calendarSyncAll', 'expenseUpsert', 'paymentUpsert', 'adjustmentUpsert', 'clientPackageAssign', 'serviceUpsert', 'addonUpsert', 'teamFunctionUpsert', 'teamUserUpsert', 'teamInviteCreate', 'teamInviteResolve', 'teamGoogleConnect', 'teamAssignmentUpsert', 'gmailConfigUpsert', 'gmailTest', 'emailTemplateUpsert', 'emailSend', 'notificationRead', 'remindersRun', 'remindersInstall', 'contractUpload', 'contractCreateLink',
      'contractInvalidate', 'contractResolve', 'contractCompleteSignature', 'ownerSignatureSave',
      'contractAdminPdfData', 'contractFinalizeData', 'contractFinalize'
    ];
    if (businessActions.indexOf(action) >= 0) {
      if (action === 'businessClients' || action === 'businessSnapshot' || action === 'uploadInit' || action === 'contractUploadInit' || action === 'gmailLogoUploadInit' || action === 'galleryUploadInit' || action === 'contractAdminPdfData' || action === 'teamInviteResolve') {
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
        catalogVersion:   configObj.catalogVersion !== undefined ? configObj.catalogVersion : (prevConfig.catalogVersion || 0),
        catalogCategories: configObj.catalogCategories !== undefined ? configObj.catalogCategories : (prevConfig.catalogCategories || []),
        packages:         configObj.packages !== undefined ? configObj.packages : (prevConfig.packages || {}),
        addons:           configObj.addons !== undefined ? configObj.addons : (prevConfig.addons || []),
        footerContact:    configObj.footerContact !== undefined ? configObj.footerContact : (prevConfig.footerContact || {}),
        promotionPopup:   configObj.promotionPopup !== undefined ? configObj.promotionPopup : (prevConfig.promotionPopup || null),
        testimonials:     configObj.testimonials !== undefined ? configObj.testimonials : (prevConfig.testimonials || []),
        quotes:           configObj.quotes !== undefined ? configObj.quotes : (prevConfig.quotes || []),
        adminCredentials: configObj.adminCredentials !== undefined ? configObj.adminCredentials : (prevConfig.adminCredentials || {}),
        galleryImages:    configObj.galleryImages !== undefined ? configObj.galleryImages : (prevConfig.galleryImages || []),
        seoSettings:      configObj.seoSettings !== undefined ? configObj.seoSettings : (prevConfig.seoSettings || {})
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
