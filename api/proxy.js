/**
 * api/proxy.js — Vercel Serverless Proxy for Google Apps Script (ES Module)
 */

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzcabU0-P7RCW04G-MMFds6m4JeQKpiPl6_IaAA40KGQsp73ZsaJx6PuwbcmhBCa4Br/exec';

async function readBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function normalizeConfig(payload) {
  const raw = payload?.config;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }
  return raw && typeof raw === 'object' ? raw : {};
}

async function fetchConfigFromScript() {
  const response = await fetch(`${APPS_SCRIPT_URL}?action=loadConfig&_t=${Date.now()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('Apps Script devolvió una respuesta no válida.'); }
  if (!parsed || parsed.status !== 'success') throw new Error('Apps Script no devolvió una configuración válida.');
  return parsed;
}

function validAdmin(config, submitted) {
  const credentials = config?.adminCredentials || {};
  return (
    String(credentials.email || '').trim().toLowerCase() === String(submitted.email || '').trim().toLowerCase() &&
    String(credentials.pass || '') === String(submitted.password || '')
  );
}

function publicGalleryOnly(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => {
      if (!item || !item.url) return false;
      if (item.visibility === 'private') return false;
      if (item.galleryId || item.gallerySlug || item.galleryToken) return false;
      if (item.mediaType === 'gallery-meta') return false;
      if (String(item.category || '').toLowerCase() === 'private') return false;
      return true;
    })
    .map((item) => {
      const clean = { ...item };
      delete clean.galleryToken;
      delete clean.downloadUrl;
      delete clean.previewUrl;
      return clean;
    });
}

function sanitizePublicConfig(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const copy = JSON.parse(JSON.stringify(payload));
  if (copy.config && typeof copy.config === 'object') {
    delete copy.config.adminCredentials;
    copy.config.galleryImages = publicGalleryOnly(copy.config.galleryImages);
    delete copy.config.quotes;
  }
  return copy;
}

function sanitizeAdminConfig(config) {
  const copy = JSON.parse(JSON.stringify(config || {}));
  delete copy.adminCredentials;
  delete copy.quotes;
  return copy;
}

async function forwardSaveConfig(patch, auditType, auditDetails) {
  const body = JSON.stringify({
    action: 'saveConfig',
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = String(req.query?.action || '');

    if (req.method === 'POST' && ['adminLogin', 'adminConfig', 'adminSaveConfig'].includes(action)) {
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}

      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      const authenticated = validAdmin(config, submitted);
      if (!authenticated) {
        return res.status(401).json({ status: 'error', authenticated: false, message: 'Credenciales incorrectas.' });
      }

      if (action === 'adminLogin') {
        return res.status(200).json({ status: 'success', authenticated: true });
      }

      if (action === 'adminConfig') {
        return res.status(200).json({ status: 'success', config: sanitizeAdminConfig(config) });
      }

      const patch = submitted.patch && typeof submitted.patch === 'object' ? submitted.patch : {};
      if ('adminCredentials' in patch) delete patch.adminCredentials;
      if ('quotes' in patch) delete patch.quotes;
      const result = await forwardSaveConfig(patch, submitted.auditType, submitted.auditDetails);
      return res.status(200).json({ status: 'success', message: result.message || 'Cambios guardados.' });
    }

    if (req.method === 'GET' && action === 'clientGallery') {
      const slug = String(req.query?.slug || '').trim();
      const token = String(req.query?.token || '').trim();
      if (!slug || !token) return res.status(400).json({ status: 'error', message: 'Liga privada incompleta.' });

      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      const items = Array.isArray(config.galleryImages) ? config.galleryImages : [];
      const meta = items.find((item) =>
        item?.visibility === 'private' &&
        item?.mediaType === 'gallery-meta' &&
        String(item.gallerySlug || '') === slug &&
        String(item.galleryToken || '') === token
      );

      if (!meta) return res.status(404).json({ status: 'error', message: 'Galería privada no encontrada o liga inválida.' });

      const media = items
        .filter((item) => item?.visibility === 'private' && item?.galleryId === meta.galleryId && item?.mediaType !== 'gallery-meta')
        .map((item) => {
          const clean = { ...item };
          delete clean.galleryToken;
          return clean;
        });

      return res.status(200).json({
        status: 'success',
        title: meta.galleryTitle || meta.title || 'Galería privada',
        clientName: meta.galleryClient || 'Cliente XPH',
        media,
      });
    }

    let scriptRes;

    if (req.method === 'POST') {
      const bodyStr = await readBody(req);
      scriptRes = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr,
        redirect: 'follow',
      });
    } else {
      const params = new URLSearchParams();
      if (req.query && typeof req.query === 'object') {
        for (const [key, value] of Object.entries(req.query)) params.set(key, String(value));
      }
      if (!params.has('_t')) params.set('_t', Date.now().toString());
      scriptRes = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
      });
    }

    const text = await scriptRes.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) { throw new Error('Apps Script devolvió una respuesta no válida.'); }

    if (req.method === 'GET' && (!action || action === 'loadConfig')) {
      parsed = sanitizePublicConfig(parsed);
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[XPH Proxy] Error:', err);
    return res.status(502).json({ status: 'error', message: err.message || 'Proxy error' });
  }
}
