from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
apps_path = ROOT / "google-apps-script.js"
proxy_path = ROOT / "api" / "proxy.js"

apps = apps_path.read_text(encoding="utf-8")
start_marker = "/**\n * Guarda la última versión activa en la pestaña Config_Activa y en Properties\n */\nfunction saveActiveConfig"
end_marker = "\nvar BUSINESS_HEADERS ="
start = apps.find(start_marker)
end = apps.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate active config storage block")

replacement = r'''/**
 * Elimina únicamente los fragmentos legacy de la configuración activa.
 * No toca secretos OAuth, credenciales de integración ni otras propiedades
 * pequeñas que siguen siendo necesarias para el proyecto.
 */
function cleanupLegacyActiveConfigChunks_(props) {
  if (!props) return;
  var existing = props.getProperties();
  Object.keys(existing || {}).forEach(function(key) {
    if (key === 'xph_total_chunks' || /^chunk_\d+$/.test(key)) {
      props.deleteProperty(key);
    }
  });
}

/**
 * Guarda la última versión activa en Config_Activa.
 * La hoja es la fuente de verdad; PropertiesService conserva solo metadatos
 * pequeños para evitar volver a exceder la cuota de almacenamiento.
 */
function saveActiveConfig(ss, configJsonString) {
  if (!ss) throw new Error('No se pudo abrir la hoja de configuración activa.');

  try {
    var sheet = ss.getSheetByName('Config_Activa');
    if (!sheet) throw new Error('No existe la pestaña Config_Activa.');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    sheet.appendRow(['database_json_payload', configJsonString, new Date().toISOString()]);
  } catch (e) {
    Logger.log('Error save active config: ' + e);
    throw e;
  }

  var props = PropertiesService.getScriptProperties();

  // Primero libera los fragmentos grandes heredados. De esta forma la propia
  // operación de limpieza no intenta escribir sobre un almacén ya saturado.
  cleanupLegacyActiveConfigChunks_(props);

  var metadata = {
    'xph_updated_at': new Date().toISOString()
  };
  try {
    metadata['xph_spreadsheet_id'] = ss.getId();
    metadata['xph_spreadsheet_url'] = ss.getUrl();
  } catch (_) {}
  props.setProperties(metadata, false);
}

/**
 * Lee la última versión activa. Config_Activa es la fuente de verdad.
 * Los fragmentos en PropertiesService se conservan solo como fallback de
 * migración para instalaciones que todavía no hayan sido compactadas.
 */
function loadActiveConfig() {
  try {
    var ss = getDatabaseSpreadsheet();
    if (ss) {
      var sheet = ss.getSheetByName('Config_Activa');
      if (sheet && sheet.getLastRow() >= 2) {
        var sheetValue = sheet.getRange(2, 2).getValue() || '';
        if (sheetValue) return sheetValue;
      }
    }
  } catch (_) {}

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

  return '';
}
'''
apps = apps[:start] + replacement + apps[end:]
apps_path.write_text(apps, encoding="utf-8")

proxy = proxy_path.read_text(encoding="utf-8")
proxy_start = proxy.find("async function forwardSaveConfig(patch, auditType, auditDetails) {")
proxy_end = proxy.find("\nasync function forwardUpload", proxy_start)
if proxy_start < 0 or proxy_end < 0:
    raise SystemExit("Could not locate forwardSaveConfig block")

proxy_replacement = r'''async function forwardSaveConfig(patch, auditType, auditDetails) {
  assertIntegrationConfig();
  const body = JSON.stringify({
    action: 'saveConfig',
    apiSecret: APPS_SCRIPT_SHARED_SECRET,
    configData: JSON.stringify(patch || {}),
    auditType: auditType || 'ACTUALIZACION_ADMIN',
    auditDetails: auditDetails || 'Cambios guardados desde panel administrador',
  });
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('Apps Script no confirmó el guardado.'); }
  if (!parsed || parsed.status !== 'success') throw new Error(parsed?.message || 'No se pudo guardar en Apps Script.');
  return parsed;
}

const ACTIVE_CONFIG_DEFAULTS = Object.freeze({
  catalogVersion: 0,
  catalogCategories: [],
  packages: {},
  addons: [],
  footerContact: {},
  promotionPopup: null,
  testimonials: [],
  quotes: [],
  adminCredentials: {},
  galleryImages: [],
  seoSettings: {},
});

function isPropertyStorageQuotaError(error) {
  return /exceeded the property storage quota|property storage quota/i.test(String(error?.message || error || ''));
}

function completeActiveConfig(currentConfig, patch) {
  const merged = {
    ...(currentConfig && typeof currentConfig === 'object' ? currentConfig : {}),
    ...(patch && typeof patch === 'object' ? patch : {}),
  };
  return Object.fromEntries(
    Object.entries(ACTIVE_CONFIG_DEFAULTS).map(([key, fallback]) => [
      key,
      Object.prototype.hasOwnProperty.call(merged, key) ? merged[key] : fallback,
    ]),
  );
}

async function forwardSaveConfigWithQuotaRecovery(patch, currentConfig, auditType, auditDetails) {
  try {
    return await forwardSaveConfig(patch, auditType, auditDetails);
  } catch (error) {
    if (!isPropertyStorageQuotaError(error)) throw error;

    // Apps Script legacy guarda la configuración en fragmentos dentro de
    // PropertiesService. Una configuración mínima reemplaza chunk_0 y permite
    // que ese código elimine los fragmentos sobrantes antes de restaurar todo.
    await forwardSaveConfig(
      ACTIVE_CONFIG_DEFAULTS,
      'MANTENIMIENTO_STORAGE_CONFIG',
      'Compactación automática del almacenamiento de configuración.',
    );

    const restoredConfig = completeActiveConfig(currentConfig, patch);
    return forwardSaveConfig(restoredConfig, auditType, auditDetails);
  }
}
'''
proxy = proxy[:proxy_start] + proxy_replacement + proxy[proxy_end:]

old_call = """        await forwardSaveConfig(\n          patch,\n          submitted.auditType,\n          submitted.auditDetails,\n        );"""
if old_call not in proxy:
    old_call = """        await forwardSaveConfig(patch, submitted.auditType, submitted.auditDetails);"""
new_call = """        await forwardSaveConfigWithQuotaRecovery(\n          patch,\n          config,\n          submitted.auditType,\n          submitted.auditDetails,\n        );"""
if old_call not in proxy:
    raise SystemExit("Could not locate adminSaveConfig forward call")
proxy = proxy.replace(old_call, new_call, 1)
proxy_path.write_text(proxy, encoding="utf-8")

print("Property storage quota recovery patch applied")
