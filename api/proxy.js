import { createHmac, timingSafeEqual } from 'node:crypto';

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzcabU0-P7RCW04G-MMFds6m4JeQKpiPl6_IaAA40KGQsp73ZsaJx6PuwbcmhBCa4Br/exec';

const SESSION_COOKIE = 'xph_admin_session';
const SESSION_DAYS = 30;

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

async function fetchDriveListFromScript() {
  const response = await fetch(`${APPS_SCRIPT_URL}?action=listDriveFolder&_t=${Date.now()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('Apps Script no devolvió la carpeta de Drive correctamente.'); }
  if (!parsed || parsed.status !== 'success') throw new Error(parsed?.message || 'No se pudo leer Google Drive.');
  return parsed;
}

function validAdminCredentials(config, submitted) {
  const credentials = config?.adminCredentials || {};
  return (
    String(credentials.email || '').trim().toLowerCase() === String(submitted.email || '').trim().toLowerCase() &&
    String(credentials.pass || '') === String(submitted.password || '')
  );
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sessionSecret(config) {
  const credentials = config?.adminCredentials || {};
  return `${String(credentials.email || '').toLowerCase()}::${String(credentials.pass || '')}::xph-admin-session-v2`;
}

function signSession(config, email) {
  const payload = JSON.stringify({
    email: String(email || '').trim().toLowerCase(),
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
  const encoded = b64url(payload);
  const signature = createHmac('sha256', sessionSecret(config)).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readCookies(req) {
  const raw = String(req.headers?.cookie || '');
  return raw.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index < 0) return acc;
    acc[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    return acc;
  }, {});
}

function verifySession(config, req) {
  const token = readCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = createHmac('sha256', sessionSecret(config)).update(encoded).digest('base64url');
  try {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.email || Number(payload.exp) < Date.now()) return null;
    const configuredEmail = String(config?.adminCredentials?.email || '').trim().toLowerCase();
    if (String(payload.email).toLowerCase() !== configuredEmail) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
}

function heroCoverMap(items) {
  if (!Array.isArray(items)) return {};
  return items.reduce((acc, item) => {
    if (item?.mediaType === 'cover-meta' && item?.heroFor && item?.url) acc[String(item.heroFor)] = item.url;
    return acc;
  }, {});
}

function heroCoverSettingsMap(items) {
  if (!Array.isArray(items)) return {};
  return items.reduce((acc, item) => {
    if (item?.mediaType !== 'cover-meta' || !item?.heroFor || !item?.url) return acc;
    acc[String(item.heroFor)] = {
      url: item.url,
      label: item.heroLabel || item.title || '',
      description: item.heroDescription || '',
      positionX: Number.isFinite(Number(item.positionX)) ? Number(item.positionX) : 50,
      positionY: Number.isFinite(Number(item.positionY)) ? Number(item.positionY) : 50,
      zoom: Number.isFinite(Number(item.zoom)) ? Number(item.zoom) : 100,
    };
    return acc;
  }, {});
}

function publicGalleryOnly(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => {
      if (!item || !item.url) return false;
      if (item.visibility === 'private' || item.visibility === 'cover') return false;
      if (item.galleryId || item.gallerySlug || item.galleryToken) return false;
      if (item.mediaType === 'gallery-meta' || item.mediaType === 'cover-meta' || item.mediaType === 'video') return false;
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
    const allGalleryItems = Array.isArray(copy.config.galleryImages) ? copy.config.galleryImages : [];
    copy.config.heroCovers = heroCoverMap(allGalleryItems);
    copy.config.heroCoverSettings = heroCoverSettingsMap(allGalleryItems);
    copy.config.galleryImages = publicGalleryOnly(allGalleryItems);
    delete copy.config.adminCredentials;
    delete copy.config.quotes;
    delete copy.config.testimonials;
  }
  return copy;
}

function sanitizeAdminConfig(config) {
  const copy = JSON.parse(JSON.stringify(config || {}));
  const allGalleryItems = Array.isArray(copy.galleryImages) ? copy.galleryImages : [];
  copy.heroCovers = heroCoverMap(allGalleryItems);
  copy.heroCoverSettings = heroCoverSettingsMap(allGalleryItems);
  delete copy.adminCredentials;
  delete copy.quotes;
  return copy;
}

function encodeHeroSettingsIntoGallery(config, patch) {
  if (!patch?.heroCoverSettings || typeof patch.heroCoverSettings !== 'object') return patch;
  const next = { ...patch };
  const baseGallery = Array.isArray(patch.galleryImages)
    ? [...patch.galleryImages]
    : Array.isArray(config.galleryImages)
      ? [...config.galleryImages]
      : [];

  Object.entries(patch.heroCoverSettings).forEach(([route, setting]) => {
    if (!setting || !setting.url) return;
    const cover = {
      id: `cover-${route}`,
      title: setting.label || route,
      category: route === 'inicio' ? 'bodas' : route,
      url: setting.url,
      location: 'Portada XPH',
      visibility: 'cover',
      mediaType: 'cover-meta',
      heroFor: route,
      heroLabel: setting.label || '',
      heroDescription: setting.description || '',
      positionX: Number(setting.positionX) || 50,
      positionY: Number(setting.positionY) || 50,
      zoom: Number(setting.zoom) || 100,
      createdAt: new Date().toISOString(),
    };
    const index = baseGallery.findIndex((item) => item?.mediaType === 'cover-meta' && item?.heroFor === route);
    if (index >= 0) baseGallery[index] = { ...baseGallery[index], ...cover };
    else baseGallery.unshift(cover);
  });

  next.galleryImages = baseGallery;
  delete next.heroCoverSettings;
  return next;
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

async function forwardUpload(submitted) {
  const body = JSON.stringify({
    action: 'uploadPhoto',
    filename: submitted.filename,
    title: submitted.title,
    category: submitted.category,
    location: submitted.location,
    mimeType: submitted.mimeType,
    base64: submitted.base64,
  });
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('Apps Script no confirmó la carga.'); }
  if (!parsed || parsed.status !== 'success' || !parsed.fileId) throw new Error(parsed?.message || 'No se pudo subir el archivo a Drive.');
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

    if (req.method === 'GET' && action === 'adminSession') {
      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      const session = verifySession(config, req);
      return res.status(200).json({ status: 'success', authenticated: Boolean(session), email: session?.email || '' });
    }

    if (req.method === 'POST' && action === 'adminLogout') {
      clearSessionCookie(res);
      return res.status(200).json({ status: 'success' });
    }

    if (req.method === 'POST' && action === 'adminLogin') {
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}
      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      if (!validAdminCredentials(config, submitted)) {
        return res.status(401).json({ status: 'error', authenticated: false, message: 'Credenciales incorrectas.' });
      }
      const email = String(config.adminCredentials?.email || submitted.email || '').trim().toLowerCase();
      setSessionCookie(res, signSession(config, email));
      return res.status(200).json({ status: 'success', authenticated: true, email });
    }

    if (req.method === 'POST' && ['adminConfig', 'adminSaveConfig', 'adminUpload', 'adminDriveList'].includes(action)) {
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}

      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      const session = verifySession(config, req);
      const legacyValid = validAdminCredentials(config, submitted);
      if (!session && !legacyValid) {
        return res.status(401).json({ status: 'error', authenticated: false, message: 'La sesión expiró. Inicia sesión nuevamente.' });
      }

      if (action === 'adminConfig') {
        return res.status(200).json({ status: 'success', config: sanitizeAdminConfig(config) });
      }
      if (action === 'adminDriveList') {
        const drive = await fetchDriveListFromScript();
        return res.status(200).json({ status: 'success', images: Array.isArray(drive.images) ? drive.images : [] });
      }
      if (action === 'adminSaveConfig') {
        let patch = submitted.patch && typeof submitted.patch === 'object' ? { ...submitted.patch } : {};
        delete patch.adminCredentials;
        delete patch.quotes;
        patch = encodeHeroSettingsIntoGallery(config, patch);
        await forwardSaveConfig(patch, submitted.auditType, submitted.auditDetails);
        const confirmedPayload = await fetchConfigFromScript();
        const confirmedConfig = normalizeConfig(confirmedPayload);
        return res.status(200).json({
          status: 'success',
          message: 'Cambios guardados y verificados.',
          config: sanitizeAdminConfig(confirmedConfig),
        });
      }
      if (action === 'adminUpload') {
        const uploaded = await forwardUpload(submitted);
        return res.status(200).json({ status: 'success', fileId: uploaded.fileId, url: uploaded.url, driveUrl: uploaded.driveUrl });
      }
    }

    if (req.method === 'POST' && action === 'submitLead') {
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}
      const lead = submitted.lead && typeof submitted.lead === 'object' ? submitted.lead : null;
      if (!lead || !lead.clientName || !lead.clientPhone || !lead.eventDate) {
        return res.status(400).json({ status: 'error', message: 'Solicitud incompleta.' });
      }
      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      const quotes = Array.isArray(config.quotes) ? config.quotes : [];
      const safeLead = {
        ...lead,
        id: lead.id || `quote-${Date.now()}`,
        status: 'Pendiente',
        depositAmount: 0,
        createdAt: lead.createdAt || new Date().toISOString().split('T')[0],
      };
      await forwardSaveConfig(
        { quotes: [safeLead, ...quotes] },
        'NUEVA_SOLICITUD_DISPONIBILIDAD',
        `Solicitud web de ${String(safeLead.clientName).slice(0, 120)} para ${String(safeLead.eventDate).slice(0, 30)}`
      );
      return res.status(200).json({ status: 'success', message: 'Solicitud registrada.' });
    }

    if (req.method === 'GET' && action === 'clientGallery') {
      const slug = String(req.query?.slug || '').trim();
      const token = String(req.query?.token || '').trim();
      if (!slug || !token) return res.status(400).json({ status: 'error', message: 'Liga privada incompleta.' });

      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      const items = Array.isArray(config.galleryImages) ? config.galleryImages : [];
      const meta = items.find((item) =>
        item?.visibility === 'private' && item?.mediaType === 'gallery-meta' &&
        String(item.gallerySlug || '') === slug && String(item.galleryToken || '') === token
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

    if (req.method === 'GET' && (!action || action === 'loadConfig')) {
      const payload = await fetchConfigFromScript();
      return res.status(200).json(sanitizePublicConfig(payload));
    }

    return res.status(403).json({ status: 'error', message: 'Acción no permitida.' });
  } catch (err) {
    console.error('[XPH Proxy] Error:', err);
    return res.status(502).json({ status: 'error', message: err.message || 'Proxy error' });
  }
}
