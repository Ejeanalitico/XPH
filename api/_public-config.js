const APPS_SCRIPT_URL = process.env.XPH_APPS_SCRIPT_URL || '';
const APPS_SCRIPT_SHARED_SECRET = process.env.XPH_APPS_SCRIPT_SHARED_SECRET || '';

function assertConfig() {
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_SHARED_SECRET) {
    throw new Error('La integración segura con Apps Script no está configurada.');
  }
}

function appsScriptUrl(action) {
  assertConfig();
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('apiSecret', APPS_SCRIPT_SHARED_SECRET);
  url.searchParams.set('_t', Date.now().toString());
  return url.toString();
}

function normalizeConfig(payload) {
  const raw = payload?.config;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }
  return raw && typeof raw === 'object' ? raw : {};
}

export async function loadPublicConfig() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(appsScriptUrl('loadConfig'), {
        headers: { Accept: 'application/json' },
        redirect: 'follow',
      });
      const payload = await response.json();
      if (!response.ok || payload?.status !== 'success') {
        throw new Error(payload?.message || `No se pudo cargar la configuración (HTTP ${response.status}).`);
      }
      return {
        config: normalizeConfig(payload),
        updatedAt: String(payload?.updatedAt || payload?.configUpdatedAt || ''),
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
  throw lastError || new Error('No se pudo cargar la configuración pública.');
}

export const slugify = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60);

export const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

