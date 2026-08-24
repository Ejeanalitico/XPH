import { createHmac, timingSafeEqual } from 'node:crypto';

const APPS_SCRIPT_URL = process.env.XPH_APPS_SCRIPT_URL || '';
const APPS_SCRIPT_SHARED_SECRET = process.env.XPH_APPS_SCRIPT_SHARED_SECRET || '';
const SESSION_SECRET = process.env.XPH_SESSION_SECRET || '';
const ADMIN_EMAIL = process.env.XPH_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.XPH_ADMIN_PASSWORD || '';
const VERCEL_ANALYTICS_TOKEN = process.env.XPH_VERCEL_ANALYTICS_TOKEN || '';
const VERCEL_PROJECT_ID = process.env.XPH_VERCEL_PROJECT_ID || 'prj_cg2Vva1lVKN4kPoxncRiPK6lX6a7';
const VERCEL_TEAM_ID = process.env.XPH_VERCEL_TEAM_ID || 'team_dj8zggd573kLjdTDYe1CEta5';

const SESSION_COOKIE = 'xph_admin_session';
const SESSION_DAYS = 30;
const MAX_BODY_BYTES = 4_000_000;
const rateLimitBuckets = globalThis.__xphRateLimitBuckets || new Map();
globalThis.__xphRateLimitBuckets = rateLimitBuckets;

function assertIntegrationConfig() {
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_SHARED_SECRET) {
    throw new Error('La integración segura con Apps Script no está configurada.');
  }
}

function appsScriptUrl(action) {
  assertIntegrationConfig();
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('apiSecret', APPS_SCRIPT_SHARED_SECRET);
  url.searchParams.set('_t', Date.now().toString());
  return url.toString();
}

function isSameOrigin(req) {
  const origin = String(req.headers?.origin || '');
  if (!origin) return true;
  try {
    return new URL(origin).host === String(req.headers?.host || '');
  } catch (_) {
    return false;
  }
}

function rateLimit(req, scope, limit, windowMs) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const key = `${scope}:${forwarded || req.socket?.remoteAddress || 'unknown'}`;
  const now = Date.now();
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  rateLimitBuckets.set(key, current);
  return { allowed: current.count <= limit, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

async function readBody(req) {
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) throw new Error('La solicitud excede el tamaño permitido.');
    return req.body;
  }
  if (req.body && typeof req.body === 'object') {
    const serialized = JSON.stringify(req.body);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) throw new Error('La solicitud excede el tamaño permitido.');
    return serialized;
  }
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (Buffer.byteLength(data, 'utf8') > MAX_BODY_BYTES) reject(new Error('La solicitud excede el tamaño permitido.'));
    });
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
  const response = await fetch(appsScriptUrl('loadConfig'), {
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
  const response = await fetch(appsScriptUrl('listDriveFolder'), {
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

function validAdminCredentials(submitted) {
  const configuredEmail = String(ADMIN_EMAIL).trim().toLowerCase();
  const configuredPassword = String(ADMIN_PASSWORD);
  if (!configuredEmail || !configuredPassword) return false;
  const submittedPassword = String(submitted.password || '');
  const expectedBuffer = Buffer.from(configuredPassword);
  const submittedBuffer = Buffer.from(submittedPassword);
  return (
    configuredEmail === String(submitted.email || '').trim().toLowerCase() &&
    expectedBuffer.length === submittedBuffer.length && timingSafeEqual(expectedBuffer, submittedBuffer)
  );
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sessionSecret() {
  if (!SESSION_SECRET) throw new Error('El secreto de sesión administrativa no está configurado.');
  return SESSION_SECRET;
}

function signSession(email) {
  const payload = JSON.stringify({
    email: String(email || '').trim().toLowerCase(),
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
  const encoded = b64url(payload);
  const signature = createHmac('sha256', sessionSecret()).update(encoded).digest('base64url');
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

function verifySession(req) {
  const token = readCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = createHmac('sha256', sessionSecret()).update(encoded).digest('base64url');
  try {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.email || Number(payload.exp) < Date.now()) return null;
    const configuredEmail = String(ADMIN_EMAIL).trim().toLowerCase();
    if (String(payload.email).toLowerCase() !== configuredEmail) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; Path=/; HttpOnly; Secure; SameSite=Strict`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`);
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

const PROMOTION_META_ID = 'xph-promotion-popup-config';

function promotionPopupFromGallery(items) {
  if (!Array.isArray(items)) return null;
  const meta = items.find((item) => item?.id === PROMOTION_META_ID && item?.mediaType === 'gallery-meta');
  return meta?.promotionPopup && typeof meta.promotionPopup === 'object' ? meta.promotionPopup : null;
}

function sanitizePublicConfig(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const copy = JSON.parse(JSON.stringify(payload));
  delete copy.spreadsheetUrl;
  if (copy.config && typeof copy.config === 'object') {
    const allGalleryItems = Array.isArray(copy.config.galleryImages) ? copy.config.galleryImages : [];
    copy.config.heroCovers = heroCoverMap(allGalleryItems);
    copy.config.heroCoverSettings = heroCoverSettingsMap(allGalleryItems);
    copy.config.promotionPopup = copy.config.promotionPopup && typeof copy.config.promotionPopup === 'object'
      ? copy.config.promotionPopup
      : promotionPopupFromGallery(allGalleryItems);
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
  copy.promotionPopup = copy.promotionPopup && typeof copy.promotionPopup === 'object'
    ? copy.promotionPopup
    : promotionPopupFromGallery(allGalleryItems);
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

function encodePromotionIntoGallery(config, patch) {
  if (!Object.prototype.hasOwnProperty.call(patch || {}, 'promotionPopup')) return patch;
  const next = { ...patch };
  const baseGallery = Array.isArray(patch.galleryImages)
    ? [...patch.galleryImages]
    : Array.isArray(config.galleryImages)
      ? [...config.galleryImages]
      : [];
  const withoutPrevious = baseGallery.filter((item) => item?.id !== PROMOTION_META_ID);

  if (patch.promotionPopup && typeof patch.promotionPopup === 'object') {
    withoutPrevious.unshift({
      id: PROMOTION_META_ID,
      title: 'Configuración del pop-up promocional',
      category: 'private',
      url: 'xph://promotion-popup-config',
      location: 'Configuración XPH',
      visibility: 'cover',
      mediaType: 'gallery-meta',
      promotionPopup: patch.promotionPopup,
      createdAt: new Date().toISOString(),
    });
  }

  next.galleryImages = withoutPrevious;
  return next;
}

async function forwardSaveConfig(patch, auditType, auditDetails) {
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

async function forwardUpload(submitted) {
  assertIntegrationConfig();
  const body = JSON.stringify({
    action: 'uploadPhoto',
    apiSecret: APPS_SCRIPT_SHARED_SECRET,
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

function analyticsPeriod(value) {
  const days = Number(value);
  return [7, 30, 90].includes(days) ? days : 30;
}

function dateRange(days) {
  const until = new Date();
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - days + 1);
  since.setUTCHours(0, 0, 0, 0);
  return { since: since.toISOString(), until: until.toISOString() };
}

function quoteCreatedAt(quote) {
  const raw = String(quote?.createdAt || '');
  const timestamp = Date.parse(raw.length <= 10 ? `${raw}T00:00:00.000Z` : raw);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function leadSummary(quotes, since, until) {
  const sinceMs = Date.parse(since);
  const untilMs = Date.parse(until);
  const validQuotes = (Array.isArray(quotes) ? quotes : []).filter((quote) => {
    const createdAt = quoteCreatedAt(quote);
    return createdAt >= sinceMs && createdAt <= untilMs;
  });

  const byDay = validQuotes.reduce((acc, quote) => {
    const day = new Date(quoteCreatedAt(quote)).toISOString().slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const byService = validQuotes.reduce((acc, quote) => {
    const service = String(quote?.eventType || 'sin-especificar');
    acc[service] = (acc[service] || 0) + 1;
    return acc;
  }, {});

  return {
    total: validQuotes.length,
    byDay: Object.entries(byDay).map(([date, count]) => ({ date, count })),
    byService: Object.entries(byService)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  };
}

async function fetchVercelAnalytics(path, range, by, limit = 10) {
  if (!VERCEL_ANALYTICS_TOKEN) throw new Error('La conexión de lectura con Vercel Analytics está pendiente.');
  const url = new URL(`https://api.vercel.com/v1/query/web-analytics/visits/${path}`);
  url.searchParams.set('projectId', VERCEL_PROJECT_ID);
  url.searchParams.set('teamId', VERCEL_TEAM_ID);
  url.searchParams.set('since', range.since);
  url.searchParams.set('until', range.until);
  if (by) url.searchParams.append('by', by);
  if (path === 'aggregate') url.searchParams.set('limit', String(limit));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${VERCEL_ANALYTICS_TOKEN}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || 'Vercel Analytics no respondió correctamente.');
  return data?.data || (path === 'count' ? { pageviews: 0, visitors: 0 } : []);
}

async function adminAnalytics(config, period) {
  const days = analyticsPeriod(period);
  const range = dateRange(days);
  const leads = leadSummary(config?.quotes, range.since, range.until);

  if (!VERCEL_ANALYTICS_TOKEN) {
    return {
      connected: false,
      period: days,
      range,
      totals: { visitors: 0, pageviews: 0, leads: leads.total, conversionRate: 0 },
      trends: [],
      countries: [],
      referrers: [],
      pages: [],
      devices: [],
      leadsByDay: leads.byDay,
      leadsByService: leads.byService,
      message: 'Web Analytics está activo. Falta autorizar la lectura segura de sus datos dentro de este panel.',
    };
  }

  const requests = await Promise.allSettled([
    fetchVercelAnalytics('count', range),
    fetchVercelAnalytics('aggregate', range, 'day', 90),
    fetchVercelAnalytics('aggregate', range, 'country', 12),
    fetchVercelAnalytics('aggregate', range, 'referrerHostname', 12),
    fetchVercelAnalytics('aggregate', range, 'requestPath', 12),
    fetchVercelAnalytics('aggregate', range, 'deviceType', 8),
  ]);

  const valueOr = (index, fallback) => requests[index].status === 'fulfilled' ? requests[index].value : fallback;
  const counts = valueOr(0, { pageviews: 0, visitors: 0 });
  const visitors = Math.max(0, Number(counts?.visitors) || 0);
  const pageviews = Math.max(0, Number(counts?.pageviews) || 0);
  const failures = requests.filter((result) => result.status === 'rejected');
  const connected = requests[0].status === 'fulfilled';

  return {
    connected,
    period: days,
    range,
    totals: {
      visitors,
      pageviews,
      leads: leads.total,
      conversionRate: visitors > 0 ? Number(((leads.total / visitors) * 100).toFixed(1)) : 0,
    },
    trends: valueOr(1, []),
    countries: valueOr(2, []),
    referrers: valueOr(3, []),
    pages: valueOr(4, []),
    devices: valueOr(5, []),
    leadsByDay: leads.byDay,
    leadsByService: leads.byService,
    message: !connected
      ? 'No se pudo leer Web Analytics temporalmente. Las cotizaciones siguen disponibles.'
      : failures.length ? 'Algunos desgloses no estuvieron disponibles temporalmente.' : '',
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST' && !isSameOrigin(req)) {
    return res.status(403).json({ status: 'error', message: 'Origen no permitido.' });
  }

  try {
    const action = String(req.query?.action || '');

    if (req.method === 'GET' && action === 'adminSession') {
      const session = verifySession(req);
      return res.status(200).json({ status: 'success', authenticated: Boolean(session), email: session?.email || '' });
    }

    if (req.method === 'POST' && action === 'adminLogout') {
      clearSessionCookie(res);
      return res.status(200).json({ status: 'success' });
    }

    if (req.method === 'POST' && action === 'adminLogin') {
      const attempt = rateLimit(req, 'admin-login', 8, 15 * 60 * 1000);
      if (!attempt.allowed) {
        res.setHeader('Retry-After', String(attempt.retryAfter));
        return res.status(429).json({ status: 'error', authenticated: false, message: 'Demasiados intentos. Intenta más tarde.' });
      }
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}
      if (!validAdminCredentials(submitted)) {
        return res.status(401).json({ status: 'error', authenticated: false, message: 'Credenciales incorrectas.' });
      }
      const email = String(ADMIN_EMAIL).trim().toLowerCase();
      setSessionCookie(res, signSession(email));
      return res.status(200).json({ status: 'success', authenticated: true, email });
    }

    if (req.method === 'POST' && action === 'adminAnalytics') {
      const session = verifySession(req);
      if (!session) {
        return res.status(401).json({ status: 'error', authenticated: false, message: 'La sesión expiró. Inicia sesión nuevamente.' });
      }
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}
      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      const analytics = await adminAnalytics(config, submitted.period);
      return res.status(200).json({ status: 'success', analytics });
    }

    if (req.method === 'POST' && ['adminConfig', 'adminSaveConfig', 'adminUpload', 'adminDriveList'].includes(action)) {
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}

      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      const session = verifySession(req);
      if (!session) {
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
        patch = encodePromotionIntoGallery(config, patch);
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
      const attempt = rateLimit(req, 'public-lead', 6, 10 * 60 * 1000);
      if (!attempt.allowed) {
        res.setHeader('Retry-After', String(attempt.retryAfter));
        return res.status(429).json({ status: 'error', message: 'Demasiadas solicitudes. Intenta más tarde.' });
      }
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
        id: lead.id || `quote-${Date.now()}`,
        clientName: String(lead.clientName).trim().slice(0, 120),
        clientEmail: String(lead.clientEmail || '').trim().slice(0, 160),
        clientPhone: String(lead.clientPhone).replace(/[^0-9+\s()-]/g, '').slice(0, 30),
        eventType: String(lead.eventType || '').slice(0, 40),
        selectedPackageId: String(lead.selectedPackageId || '').slice(0, 80),
        packageName: String(lead.packageName || '').slice(0, 120),
        packagePrice: Math.max(0, Number(lead.packagePrice) || 0),
        addons: Array.isArray(lead.addons) ? lead.addons.slice(0, 20).map((item) => String(item).slice(0, 160)) : [],
        extraHours: Math.min(24, Math.max(0, Number(lead.extraHours) || 0)),
        total: Math.max(0, Number(lead.total) || 0),
        eventDate: String(lead.eventDate).slice(0, 30),
        eventCity: String(lead.eventCity || '').slice(0, 160),
        status: 'Pendiente',
        createdAt: lead.createdAt || new Date().toISOString().split('T')[0],
        notes: String(lead.notes || '').slice(0, 1000),
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
          if (meta.galleryAllowDownloads === false) delete clean.downloadUrl;
          return clean;
        });

      return res.status(200).json({
        status: 'success',
        title: meta.galleryTitle || meta.title || 'Galería privada',
        clientName: meta.galleryClient || 'Cliente XPH',
        allowDownloads: meta.galleryAllowDownloads !== false,
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
