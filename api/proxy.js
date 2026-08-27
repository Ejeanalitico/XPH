import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const APPS_SCRIPT_URL = process.env.XPH_APPS_SCRIPT_URL || '';
const APPS_SCRIPT_SHARED_SECRET = process.env.XPH_APPS_SCRIPT_SHARED_SECRET || '';
const SESSION_SECRET = process.env.XPH_SESSION_SECRET || '';
const ADMIN_EMAIL = process.env.XPH_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.XPH_ADMIN_PASSWORD || '';
const VERCEL_ANALYTICS_TOKEN = process.env.XPH_VERCEL_ANALYTICS_TOKEN || '';
const VERCEL_PROJECT_ID = process.env.XPH_VERCEL_PROJECT_ID || 'prj_cg2Vva1lVKN4kPoxncRiPK6lX6a7';
const VERCEL_TEAM_ID = process.env.XPH_VERCEL_TEAM_ID || 'team_dj8zggd573kLjdTDYe1CEta5';
const SEARCH_CONSOLE_SCRIPT_URL = process.env.XPH_SEARCH_CONSOLE_SCRIPT_URL || '';
const SEARCH_CONSOLE_SECRET = process.env.XPH_SEARCH_CONSOLE_SECRET || '';
const GOOGLE_CLIENT_ID = process.env.XPH_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.XPH_GOOGLE_CLIENT_SECRET || '';

const SESSION_COOKIE = 'xph_admin_session';
const SESSION_DAYS = 30;
const MAX_BODY_BYTES = 4_000_000;
const CRM_STATUSES = new Set(['Nuevo', 'Contactado', 'Cotización enviada', 'Esperando respuesta', 'Seguimiento pendiente', 'Interesado', 'Negociación', 'Por cerrar', 'Seguimiento', 'Cierre prioritario', 'Contratado', 'No interesado', 'Sin interés', 'No responde', 'Archivado']);
const EXPENSE_CATEGORIES = new Set(['Equipo y fotografía', 'Maquillaje e insumos', 'Transporte', 'Comida', 'Gastos personales', 'Publicidad', 'Otros del negocio']);
const EXPENSE_ACCOUNTS = new Set(['Banco', 'Efectivo', 'Bote de reserva', 'Otro']);
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

async function readBinaryBody(req, maxBytes) {
  const validateSize = (buffer) => {
    if (!buffer.length) throw new Error('El archivo está vacío.');
    if (buffer.length > maxBytes) throw new Error('El archivo excede el tamaño permitido.');
    return buffer;
  };

  if (Buffer.isBuffer(req.body)) return validateSize(req.body);
  if (req.body instanceof Uint8Array) return validateSize(Buffer.from(req.body));
  if (typeof req.body === 'string') return validateSize(Buffer.from(req.body, 'latin1'));
  if (req.body && typeof req.body === 'object') throw new Error('El archivo recibido no tiene un formato binario válido.');

  return await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) {
        reject(new Error('El archivo excede el tamaño permitido.'));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      try { resolve(validateSize(Buffer.concat(chunks))); } catch (error) { reject(error); }
    });
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

async function fetchAppsScriptJson(action, invalidMessage) {
  const attempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(appsScriptUrl(action), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
      });
      const text = await response.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch (_) {
        throw new Error(`${invalidMessage} (HTTP ${response.status}).`);
      }
      if (!response.ok || !parsed || parsed.status !== 'success') {
        throw new Error(parsed?.message || `${invalidMessage} (HTTP ${response.status}).`);
      }
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }

  throw lastError || new Error(invalidMessage);
}

async function fetchConfigFromScript() {
  return fetchAppsScriptJson('loadConfig', 'Apps Script devolvió una configuración no válida');
}

async function fetchDriveListFromScript() {
  return fetchAppsScriptJson('listDriveFolder', 'Apps Script no devolvió la carpeta de Drive correctamente');
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

function signSession(input) {
  const session = typeof input === 'string' ? { email: input } : (input || {});
  const payload = JSON.stringify({
    email: String(session.email || '').trim().toLowerCase(),
    userId: String(session.userId || 'xph-super-admin'),
    role: String(session.role || 'SUPER_ADMIN'),
    permissions: Array.isArray(session.permissions) ? session.permissions.slice(0, 100) : ['*'],
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
    if (!['SUPER_ADMIN', 'COLLABORATOR'].includes(String(payload.role || ''))) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function hasPermission(session, permission) {
  if (!session) return false;
  if (session.role === 'SUPER_ADMIN') return true;
  const permissions = Array.isArray(session.permissions) ? session.permissions : [];
  if (permission === 'CRM_OR_CLIENT_WRITE') return permissions.includes('CRM_WRITE') || permissions.includes('CLIENTS_WRITE');
  if (permission === 'CRM_OR_CLIENT_READ') return permissions.includes('CRM_READ') || permissions.includes('CLIENTS_READ') || permissions.includes('CALENDAR');
  return permissions.includes('*') || permissions.includes(permission);
}

function requirePermission(res, session, permission) {
  if (!session) {
    res.status(401).json({ status: 'error', authenticated: false, message: 'La sesión expiró. Inicia sesión nuevamente.' });
    return false;
  }
  if (!hasPermission(session, permission)) {
    res.status(403).json({ status: 'error', message: 'Tu usuario no tiene permiso para realizar esta acción.' });
    return false;
  }
  return true;
}

function signOauthState(payload) {
  const encoded = b64url(JSON.stringify({ ...payload, exp: Date.now() + 10 * 60 * 1000 }));
  const signature = createHmac('sha256', sessionSecret()).update(`oauth:${encoded}`).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyOauthState(value) {
  if (!value || !String(value).includes('.')) return null;
  const [encoded, signature] = String(value).split('.');
  const expected = createHmac('sha256', sessionSecret()).update(`oauth:${encoded}`).digest('base64url');
  try {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return Number(payload.exp) > Date.now() ? payload : null;
  } catch (_) { return null; }
}

function requestOrigin(req) {
  const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0];
  return `${protocol}://${String(req.headers?.host || 'www.xaviph.com')}`;
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

function operationalClientRecord(item) {
  return {
    ...item,
    totalAmount: 0,
    paidAmount: 0,
    estimatedCost: 0,
    allocatedAdCost: 0,
    internalNotes: '',
    notes: '',
    objection: '',
    suggestedMessage: '',
    lossReason: '',
    contractId: '',
    source: '',
    campaign: '',
    nextAction: '',
    nextActionAt: '',
    lastContactAt: '',
    firstContactAt: '',
  };
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

async function forwardBusinessAction(action, payload = {}) {
  assertIntegrationConfig();
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, apiSecret: APPS_SCRIPT_SHARED_SECRET, payload }),
    redirect: 'follow',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('La base privada devolvió una respuesta no válida.'); }
  if (!parsed || parsed.status !== 'success') throw new Error(parsed?.message || 'La operación privada no pudo completarse.');
  return parsed;
}

async function forwardBusinessActionWithLockRetry(action, payload = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await forwardBusinessAction(action, payload);
    } catch (error) {
      lastError = error;
      if (!/lock timeout|holding the lock/i.test(String(error?.message || error)) || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }
  throw lastError;
}

function isGoogleDriveResumableUploadUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' &&
      url.hostname === 'www.googleapis.com' &&
      url.pathname === '/upload/drive/v3/files' &&
      url.searchParams.get('uploadType') === 'resumable' &&
      Boolean(url.searchParams.get('upload_id'));
  } catch (_) {
    return false;
  }
}

async function forwardGoogleDriveUpload(uploadUrl, mimeType, bytes) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(bytes.length),
    },
    body: bytes,
    redirect: 'manual',
  });
  const text = await response.text();
  let parsed = {};
  try { parsed = JSON.parse(text); } catch (_) {}
  if (!response.ok || !parsed?.id) {
    throw new Error(parsed?.error?.message || `Google Drive no pudo recibir el archivo (HTTP ${response.status}).`);
  }
  return parsed;
}

function clientIp(req) {
  return String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || String(req.socket?.remoteAddress || '');
}

function isMobileSigningRequest(req) {
  const mobileHint = String(req.headers?.['sec-ch-ua-mobile'] || '');
  const userAgent = String(req.headers?.['user-agent'] || '');
  if (mobileHint === '?1') return true;
  return /(iphone|ipod|android.+mobile|windows phone|iemobile|opera mini)/i.test(userAgent);
}

function signingAudit(req) {
  return {
    ip: clientIp(req).slice(0, 120),
    userAgent: String(req.headers?.['user-agent'] || '').slice(0, 700),
    acceptedAt: new Date().toISOString(),
    consentText: 'He leído el contrato completo, comprendo su contenido y acepto sus términos.',
  };
}

function cleanBase64(value) {
  const source = String(value || '');
  return source.includes(',') ? source.split(',').pop() : source;
}

function isPngDataUrl(value) {
  const source = String(value || '');
  if (!source.startsWith('data:image/png;base64,')) return false;
  try {
    const bytes = Buffer.from(cleanBase64(source), 'base64');
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  } catch (_) {
    return false;
  }
}

function isPdfDataUrl(value) {
  const source = String(value || '');
  if (!source.startsWith('data:application/pdf;base64,')) return false;
  try {
    return Buffer.from(cleanBase64(source), 'base64').subarray(0, 5).toString('ascii') === '%PDF-';
  } catch (_) {
    return false;
  }
}

async function appendClientSignature(pdfBase64, signatureDataUrl, contract, audit) {
  const pdfBytes = Buffer.from(cleanBase64(pdfBase64), 'base64');
  const signatureBytes = Buffer.from(cleanBase64(signatureDataUrl), 'base64');
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const signature = await pdf.embedPng(signatureBytes);
  const scaled = signature.scaleToFit(220, 92);

  page.drawText('CONSTANCIA DE ACEPTACIÓN Y FIRMA', { x: 54, y: 720, size: 16, font: bold, color: rgb(0.12, 0.14, 0.18) });
  page.drawText(`Contrato: ${String(contract.folio || contract.id || '').slice(0, 100)}`, { x: 54, y: 685, size: 10, font });
  page.drawText(`Cliente: ${String(contract.clientName || '').slice(0, 120)}`, { x: 54, y: 667, size: 10, font });
  page.drawText(`Fecha del evento: ${String(contract.eventDate || 'Por confirmar').slice(0, 40)}`, { x: 54, y: 649, size: 10, font });
  page.drawText('El cliente confirma que leyó el contrato completo y aceptó sus términos', { x: 54, y: 610, size: 9, font });
  page.drawText('antes de realizar la firma manuscrita electrónica que aparece abajo.', { x: 54, y: 596, size: 9, font });
  page.drawText(`Aceptado: ${audit.acceptedAt}`, { x: 54, y: 566, size: 8, font, color: rgb(0.3, 0.32, 0.36) });
  page.drawText(`IP: ${audit.ip || 'No disponible'}`, { x: 54, y: 552, size: 8, font, color: rgb(0.3, 0.32, 0.36) });
  page.drawText('FIRMAS', { x: 54, y: 485, size: 13, font: bold, color: rgb(0.12, 0.14, 0.18) });
  page.drawText('PRESTADOR DEL SERVICIO', { x: 54, y: 452, size: 10, font: bold });
  page.drawText('CLIENTE', { x: 338, y: 452, size: 10, font: bold });
  page.drawText('Pendiente de autorización', { x: 88, y: 374, size: 8, font, color: rgb(0.45, 0.46, 0.5) });
  page.drawImage(signature, { x: 338, y: 335, width: scaled.width, height: scaled.height });
  page.drawLine({ start: { x: 54, y: 325 }, end: { x: 274, y: 325 }, thickness: 0.8, color: rgb(0.15, 0.16, 0.18) });
  page.drawLine({ start: { x: 338, y: 325 }, end: { x: 558, y: 325 }, thickness: 0.8, color: rgb(0.15, 0.16, 0.18) });
  page.drawText('Javier García', { x: 54, y: 306, size: 10, font: bold });
  page.drawText('Prestador del servicio', { x: 54, y: 290, size: 9, font });
  page.drawText(String(contract.clientName || 'Cliente registrado').slice(0, 42), { x: 338, y: 306, size: 10, font: bold });
  page.drawText('Cliente / Contratante', { x: 338, y: 290, size: 9, font });
  page.drawText('Xavi.ph conserva el documento original y esta constancia como evidencia del proceso.', { x: 54, y: 95, size: 8, font, color: rgb(0.35, 0.37, 0.42) });

  return Buffer.from(await pdf.save()).toString('base64');
}

async function applyOwnerSignature(pdfBase64, signatureDataUrl, authorizedAt) {
  const pdf = await PDFDocument.load(Buffer.from(cleanBase64(pdfBase64), 'base64'));
  const pages = pdf.getPages();
  if (!pages.length) throw new Error('El contrato firmado no contiene páginas.');
  const page = pages[pages.length - 1];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const signature = await pdf.embedPng(Buffer.from(cleanBase64(signatureDataUrl), 'base64'));
  const scaled = signature.scaleToFit(220, 92);
  page.drawRectangle({ x: 50, y: 332, width: 228, height: 105, color: rgb(1, 1, 1) });
  page.drawImage(signature, { x: 54, y: 335, width: scaled.width, height: scaled.height });
  page.drawText(`Autorizado: ${authorizedAt}`, { x: 54, y: 274, size: 7, font, color: rgb(0.35, 0.37, 0.42) });
  return Buffer.from(await pdf.save()).toString('base64');
}

function analyticsPeriod(value) {
  const days = Number(value);
  return [7, 28, 90].includes(days) ? days : 28;
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

function emptySearchConsole(days, message) {
  return {
    connected: false,
    property: 'sc-domain:xaviph.com',
    period: days,
    range: null,
    totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    queries: [],
    pages: [],
    countries: [],
    devices: [],
    message,
  };
}

function normalizeSearchConsoleRow(row) {
  const keys = Array.isArray(row?.keys) ? row.keys.map((key) => String(key || '')) : [];
  return {
    keys,
    clicks: Math.max(0, Number(row?.clicks) || 0),
    impressions: Math.max(0, Number(row?.impressions) || 0),
    ctr: Math.max(0, Number(row?.ctr) || 0),
    position: Math.max(0, Number(row?.position) || 0),
  };
}

async function fetchSearchConsoleAnalytics(days) {
  if (!SEARCH_CONSOLE_SCRIPT_URL || !SEARCH_CONSOLE_SECRET) {
    return emptySearchConsole(days, 'La conexión privada con Google Search Console está pendiente de activación.');
  }

  const response = await fetch(SEARCH_CONSOLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'performance', apiSecret: SEARCH_CONSOLE_SECRET, period: days }),
    redirect: 'follow',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('Google Search Console devolvió una respuesta no válida.'); }
  if (!response.ok || parsed?.status === 'error') {
    throw new Error(parsed?.message || 'Google Search Console no respondió correctamente.');
  }

  const data = parsed?.performance || parsed?.data || parsed?.analytics || parsed?.result || parsed;
  const totals = data?.totals || data || {};
  const normalizeRows = (value) => {
    const rows = Array.isArray(value) ? value : Array.isArray(value?.rows) ? value.rows : [];
    return rows.map(normalizeSearchConsoleRow);
  };
  return {
    connected: true,
    property: String(data?.property || data?.siteUrl || 'sc-domain:xaviph.com'),
    period: days,
    range: data?.range && typeof data.range === 'object'
      ? {
          startDate: String(data.range.startDate || data.range.start || data.startDate || ''),
          endDate: String(data.range.endDate || data.range.end || data.endDate || ''),
        }
      : null,
    totals: {
      clicks: Math.max(0, Number(totals.clicks) || 0),
      impressions: Math.max(0, Number(totals.impressions) || 0),
      ctr: Math.max(0, Number(totals.ctr) || 0),
      position: Math.max(0, Number(totals.position) || 0),
    },
    queries: normalizeRows(data?.queries),
    pages: normalizeRows(data?.pages),
    countries: normalizeRows(data?.countries),
    devices: normalizeRows(data?.devices),
    message: '',
  };
}

async function adminAnalytics(config, period) {
  const days = analyticsPeriod(period);
  const range = dateRange(days);
  const leads = leadSummary(config?.quotes, range.since, range.until);

  const searchConsolePromise = fetchSearchConsoleAnalytics(days)
    .catch((error) => emptySearchConsole(days, error instanceof Error ? error.message : 'No se pudo consultar Google Search Console.'));

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
      searchConsole: await searchConsolePromise,
      message: 'Web Analytics está activo. Falta autorizar la lectura segura de sus datos dentro de este panel.',
    };
  }

  const [requests, searchConsole] = await Promise.all([
    Promise.allSettled([
    fetchVercelAnalytics('count', range),
    fetchVercelAnalytics('aggregate', range, 'day', 90),
    fetchVercelAnalytics('aggregate', range, 'country', 12),
    fetchVercelAnalytics('aggregate', range, 'referrerHostname', 12),
    fetchVercelAnalytics('aggregate', range, 'requestPath', 12),
    fetchVercelAnalytics('aggregate', range, 'deviceType', 8),
    ]),
    searchConsolePromise,
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
    searchConsole,
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
      return res.status(200).json({ status: 'success', authenticated: Boolean(session), email: session?.email || '', userId: session?.userId || '', role: session?.role || '', permissions: session?.permissions || [] });
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
      const adminSession = { email, userId: 'xph-super-admin', role: 'SUPER_ADMIN', permissions: ['*'] };
      setSessionCookie(res, signSession(adminSession));
      return res.status(200).json({ status: 'success', authenticated: true, ...adminSession });
    }

    if (req.method === 'GET' && action === 'teamGoogleStart') {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(503).send('La conexión de Google todavía no está configurada por el Super Admin.');
      const inviteToken = String(req.query?.invite || '').trim();
      if (!inviteToken) return res.status(400).send('La invitación está incompleta.');
      const tokenHash = createHash('sha256').update(inviteToken).digest('base64url');
      const invitation = await forwardBusinessAction('teamInviteResolve', { tokenHash });
      const callbackUrl = `${requestOrigin(req)}/api/proxy?action=teamGoogleCallback`;
      const state = signOauthState({ tokenHash, callbackUrl, expectedEmail: invitation.user?.email || '' });
      const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorize.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authorize.searchParams.set('redirect_uri', callbackUrl);
      authorize.searchParams.set('response_type', 'code');
      authorize.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/calendar.events');
      authorize.searchParams.set('access_type', 'offline');
      authorize.searchParams.set('prompt', 'consent');
      authorize.searchParams.set('login_hint', invitation.user?.email || '');
      authorize.searchParams.set('state', state);
      return res.redirect(302, authorize.toString());
    }

    if (req.method === 'GET' && action === 'teamGoogleCallback') {
      const state = verifyOauthState(req.query?.state);
      if (!state || !req.query?.code) return res.redirect(302, `/admin?google_error=${encodeURIComponent('La autorización de Google no es válida o caducó.')}`);
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: String(req.query.code), client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: String(state.callbackUrl), grant_type: 'authorization_code' }),
      });
      const tokens = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokens.id_token || !tokens.access_token) return res.redirect(302, `/admin?google_error=${encodeURIComponent('Google no entregó una autorización válida.')}`);
      const identityResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`);
      const identity = await identityResponse.json().catch(() => ({}));
      const googleEmail = String(identity.email || '').trim().toLowerCase();
      if (!identityResponse.ok || !googleEmail || String(identity.aud || '') !== GOOGLE_CLIENT_ID || ![true, 'true'].includes(identity.email_verified)) {
        return res.redirect(302, `/admin?google_error=${encodeURIComponent('No se pudo verificar la identidad de Google.')}`);
      }
      if (googleEmail !== String(state.expectedEmail || '').trim().toLowerCase()) {
        return res.redirect(302, `/admin?google_error=${encodeURIComponent('Debes continuar con el mismo correo al que se envió la invitación.')}`);
      }
      const connected = await forwardBusinessAction('teamGoogleConnect', {
        tokenHash: state.tokenHash,
        googleEmail,
        googleSubject: String(identity.sub || ''),
        accessToken: String(tokens.access_token || ''),
        refreshToken: String(tokens.refresh_token || ''),
        expiresIn: Number(tokens.expires_in || 3600),
      });
      const user = connected.user;
      const collaboratorSession = { email: user.email, userId: user.id, role: 'COLLABORATOR', permissions: Array.isArray(user.permissions) ? user.permissions : [] };
      setSessionCookie(res, signSession(collaboratorSession));
      return res.redirect(302, '/admin?google=connected');
    }

    if (req.method === 'POST' && action === 'adminAnalytics') {
      const session = verifySession(req);
      if (!requirePermission(res, session, 'SEO_ADMIN')) return;
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}
      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      const analytics = await adminAnalytics(config, submitted.period);
      return res.status(200).json({ status: 'success', analytics });
    }

    const adminBusinessActions = [
      'adminBusinessClients',
      'adminBusinessSnapshot',
      'adminUploadInit',
      'adminUploadFinalize',
      'adminCrmUpsert',
      'adminFollowUpCreate',
      'adminProspectConvert',
      'adminCalendarSync',
      'adminExpenseUpsert',
      'adminPaymentUpsert',
      'adminAdjustmentUpsert',
      'adminClientPackageAssign',
      'adminServiceUpsert',
      'adminAddonUpsert',
      'adminTeamFunctionUpsert',
      'adminTeamUserUpsert',
      'adminTeamInviteCreate',
      'adminTeamAssignmentUpsert',
      'adminGmailConfigUpsert',
      'adminGmailTest',
      'adminEmailTemplateUpsert',
      'adminEmailSend',
      'adminEmailLogoUploadInit',
      'adminEmailLogoUploadFinalize',
      'adminNotificationRead',
      'adminRemindersRun',
      'adminRemindersInstall',
      'adminGalleryCreate',
      'adminGalleryUploadInit',
      'adminGalleryUploadFinalize',
      'adminGalleryStatusUpdate',
      'adminInternalEventUpsert',
      'adminContractUpload',
      'adminContractUploadInit',
      'adminDriveUploadBody',
      'adminContractUploadFinalize',
      'adminContractCreateLink',
      'adminOwnerSignatureSave',
      'adminContractFinalize',
    ];

    if (req.method === 'POST' && adminBusinessActions.includes(action)) {
      const session = verifySession(req);
      const uploadKind = String(req.headers?.['x-xph-upload-kind'] || '').trim().toLowerCase();
      const uploadPermissionByKind = { contract: 'CONTRACTS', logo: 'GMAIL_ADMIN', gallery: 'GALLERIES', media: 'GALLERIES' };
      const permissionByAction = {
        adminBusinessClients: 'CRM_OR_CLIENT_READ', adminBusinessSnapshot: 'CRM_OR_CLIENT_READ',
        adminCrmUpsert: 'CRM_OR_CLIENT_WRITE', adminFollowUpCreate: 'CRM_WRITE', adminProspectConvert: 'CRM_WRITE',
        adminCalendarSync: 'CALENDAR',
        adminExpenseUpsert: 'FINANCE', adminPaymentUpsert: 'FINANCE', adminAdjustmentUpsert: 'FINANCE',
        adminClientPackageAssign: 'CLIENTS_WRITE', adminServiceUpsert: 'CLIENTS_WRITE', adminAddonUpsert: 'CLIENTS_WRITE',
        adminContractUpload: 'CONTRACTS', adminContractUploadInit: 'CONTRACTS', adminDriveUploadBody: uploadPermissionByKind[uploadKind] || 'SUPER_ADMIN', adminContractUploadFinalize: 'CONTRACTS', adminContractCreateLink: 'CONTRACTS', adminOwnerSignatureSave: 'CONTRACTS', adminContractFinalize: 'CONTRACTS',
        adminUploadInit: 'GALLERIES', adminUploadFinalize: 'GALLERIES',
        adminTeamFunctionUpsert: 'USERS_ADMIN', adminTeamUserUpsert: 'USERS_ADMIN', adminTeamInviteCreate: 'USERS_ADMIN',
        adminTeamAssignmentUpsert: 'USERS_ADMIN',
        adminGmailConfigUpsert: 'GMAIL_ADMIN', adminGmailTest: 'GMAIL_ADMIN', adminEmailTemplateUpsert: 'GMAIL_ADMIN',
        adminEmailSend: 'EMAIL_SEND', adminEmailLogoUploadInit: 'GMAIL_ADMIN', adminEmailLogoUploadFinalize: 'GMAIL_ADMIN',
        adminNotificationRead: 'CRM_OR_CLIENT_READ', adminRemindersRun: 'GMAIL_ADMIN', adminRemindersInstall: 'GMAIL_ADMIN',
        adminGalleryCreate: 'GALLERIES', adminGalleryUploadInit: 'GALLERIES', adminGalleryUploadFinalize: 'GALLERIES', adminGalleryStatusUpdate: 'GALLERIES',
        adminInternalEventUpsert: 'USERS_ADMIN',
      };
      if (!requirePermission(res, session, permissionByAction[action] || 'SUPER_ADMIN')) return;

      if (action === 'adminDriveUploadBody') {
        const uploadUrl = String(req.headers?.['x-xph-upload-url'] || '');
        const mimeType = String(req.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
        const declaredSize = Number(req.headers?.['x-xph-upload-size'] || 0);
        const uploadRules = {
          contract: { maxBytes: 5_000_000, validMime: mimeType === 'application/pdf' },
          logo: { maxBytes: 5_000_000, validMime: ['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) },
          gallery: { maxBytes: 100_000_000, validMime: mimeType.startsWith('image/') },
          media: { maxBytes: 100_000_000, validMime: mimeType.startsWith('image/') },
        };
        const rule = uploadRules[uploadKind];
        if (!rule) return res.status(400).json({ status: 'error', message: 'El tipo de carga privada no es válido.' });
        if (!isGoogleDriveResumableUploadUrl(uploadUrl)) return res.status(400).json({ status: 'error', message: 'La sesión privada de carga no es válida.' });
        if (!rule.validMime) return res.status(400).json({ status: 'error', message: uploadKind === 'contract' ? 'El contrato debe ser un archivo PDF.' : 'Selecciona una imagen válida.' });
        if (!Number.isInteger(declaredSize) || declaredSize <= 0 || declaredSize > rule.maxBytes) return res.status(400).json({ status: 'error', message: 'El archivo excede el tamaño permitido.' });
        const bytes = await readBinaryBody(req, rule.maxBytes);
        if (bytes.length !== declaredSize) return res.status(400).json({ status: 'error', message: 'La carga llegó incompleta; vuelve a seleccionar el archivo.' });
        if (uploadKind === 'contract' && bytes.subarray(0, 5).toString('ascii') !== '%PDF-') return res.status(400).json({ status: 'error', message: 'El archivo no contiene un PDF válido.' });
        const uploaded = await forwardGoogleDriveUpload(uploadUrl, mimeType, bytes);
        return res.status(200).json({ status: 'success', fileId: uploaded.id, name: uploaded.name || '' });
      }

      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}

      if (action === 'adminBusinessSnapshot') {
        const result = await forwardBusinessAction('businessSnapshot');
        if (session.role !== 'SUPER_ADMIN') {
          const assignments = (result.snapshot?.assignments || []).filter((item) => String(item.userId) === String(session.userId) && item.status !== 'CANCELADA');
          const allowedClientIds = new Set(assignments.map((item) => String(item.clientId)));
          const canReadProspects = hasPermission(session, 'CRM_READ');
          const visibleClients = (result.snapshot?.clients || []).filter((item) => (item.recordType === 'Prospecto' && canReadProspects) || (item.recordType === 'Cliente' && allowedClientIds.has(String(item.id))));
          const visibleIds = new Set(visibleClients.map((item) => String(item.id)));
          result.snapshot.clients = visibleClients.map((item) => item.recordType === 'Cliente' ? operationalClientRecord(item) : { ...item, totalAmount: 0, paidAmount: 0, estimatedCost: 0, allocatedAdCost: 0, internalNotes: '' });
          result.snapshot.followUps = canReadProspects ? (result.snapshot.followUps || []).filter((item) => visibleIds.has(String(item.prospectId || item.clientId))) : [];
          result.snapshot.expenses = [];
          result.snapshot.payments = [];
          result.snapshot.transactions = [];
          result.snapshot.adjustments = [];
          result.snapshot.contracts = [];
          result.snapshot.packageSnapshots = [];
          result.snapshot.addons = [];
          result.snapshot.services = (result.snapshot?.services || []).filter((item) => allowedClientIds.has(String(item.clientId))).map((item) => ({ ...item, unitPrice: 0, total: 0 }));
          result.snapshot.assignments = assignments;
          result.snapshot.users = (result.snapshot?.users || []).filter((item) => String(item.id) === String(session.userId)).map((item) => ({ ...item, permissions: [] }));
          result.snapshot.teamFunctions = [];
          result.snapshot.gmailConfig = null;
          result.snapshot.emailTemplates = hasPermission(session, 'EMAIL_SEND') ? (result.snapshot.emailTemplates || []).filter((item) => item.status === 'ACTIVA') : [];
          result.snapshot.emailHistory = (result.snapshot.emailHistory || []).filter((item) => String(item.userId) === String(session.userId) && allowedClientIds.has(String(item.clientId)));
          result.snapshot.notifications = (result.snapshot.notifications || []).filter((item) => String(item.userId) === String(session.userId));
          result.snapshot.auditLog = [];
          result.snapshot.galleries = hasPermission(session, 'GALLERIES') ? (result.snapshot.galleries || []).filter((item) => allowedClientIds.has(String(item.clientId))) : [];
          result.snapshot.internalEvents = (result.snapshot.internalEvents || []).filter((item) => item.visibility === 'SELECTED' && Array.isArray(item.userIds) && item.userIds.includes(String(session.userId)));
          result.snapshot.ownerSignatureConfigured = false;
        }
        return res.status(200).json({ status: 'success', snapshot: result.snapshot });
      }
      if (action === 'adminBusinessClients') {
        const result = await forwardBusinessAction('businessClients');
        if (session.role === 'SUPER_ADMIN') return res.status(200).json({ status: 'success', clients: Array.isArray(result.clients) ? result.clients : [] });
        const snapshotResult = await forwardBusinessAction('businessSnapshot');
        const assignedIds = new Set((snapshotResult.snapshot?.assignments || []).filter((item) => String(item.userId) === String(session.userId) && item.status !== 'CANCELADA').map((item) => String(item.clientId)));
        const canReadProspects = hasPermission(session, 'CRM_READ');
        const visible = (result.clients || []).filter((item) => (item.recordType === 'Prospecto' && canReadProspects) || (item.recordType === 'Cliente' && assignedIds.has(String(item.id))));
        return res.status(200).json({ status: 'success', clients: visible.map((item) => item.recordType === 'Cliente' ? operationalClientRecord(item) : { ...item, totalAmount: 0, paidAmount: 0, estimatedCost: 0, allocatedAdCost: 0, internalNotes: '' }) });
      }
      if (action === 'adminUploadInit') {
        const filename = String(submitted.filename || '').trim().slice(0, 180);
        const mimeType = String(submitted.mimeType || '').trim().toLowerCase();
        const size = Number(submitted.size || 0);
        if (!filename || !mimeType.startsWith('image/') || size <= 0 || size > 100_000_000) {
          return res.status(400).json({ status: 'error', message: 'La fotografía debe ser válida y pesar máximo 100 MB.' });
        }
        const result = await forwardBusinessAction('uploadInit', { filename, mimeType, size });
        return res.status(200).json({ status: 'success', uploadUrl: result.uploadUrl });
      }
      if (action === 'adminUploadFinalize') {
        const fileId = String(submitted.fileId || '').trim().slice(0, 100);
        if (!fileId) return res.status(400).json({ status: 'error', message: 'No se recibió el archivo cargado.' });
        const result = await forwardBusinessAction('uploadFinalize', {
          fileId,
          title: String(submitted.title || '').slice(0, 180),
          category: String(submitted.category || '').slice(0, 80),
          location: String(submitted.location || '').slice(0, 180),
        });
        return res.status(200).json({ status: 'success', fileId: result.fileId, url: result.url, driveUrl: result.driveUrl });
      }
      if (action === 'adminCrmUpsert') {
        const client = submitted.client || {};
        if (!String(client.name || '').trim() && !String(client.phone || '').trim()) {
          return res.status(400).json({ status: 'error', message: 'Registra por lo menos el nombre o el teléfono.' });
        }
        if (client.status && !CRM_STATUSES.has(String(client.status))) {
          return res.status(400).json({ status: 'error', message: 'Estado de cliente no válido.' });
        }
        if (Number(client.paidAmount || 0) > Number(client.totalAmount || 0) && Number(client.totalAmount || 0) > 0) {
          return res.status(400).json({ status: 'error', message: 'Lo pagado no puede ser mayor al total contratado.' });
        }
        if (session.role !== 'SUPER_ADMIN') {
          const snapshotResult = await forwardBusinessAction('businessSnapshot');
          const existing = (snapshotResult.snapshot?.clients || []).find((item) => String(item.id) === String(client.id || ''));
          const isClientRecord = String(client.recordType || existing?.recordType || 'Prospecto') === 'Cliente';
          if (isClientRecord) {
            const assigned = (snapshotResult.snapshot?.assignments || []).some((item) => String(item.userId) === String(session.userId) && String(item.clientId) === String(client.id || '') && item.status !== 'CANCELADA');
            if (!hasPermission(session, 'CLIENTS_WRITE') || !assigned) return res.status(403).json({ status: 'error', message: 'Solo puedes editar clientes que tienes asignados y autorizados.' });
            client.totalAmount = existing?.totalAmount || 0; client.paidAmount = existing?.paidAmount || 0; client.estimatedCost = existing?.estimatedCost || 0; client.allocatedAdCost = existing?.allocatedAdCost || 0; client.internalNotes = existing?.internalNotes || '';
          } else if (!hasPermission(session, 'CRM_WRITE')) return res.status(403).json({ status: 'error', message: 'No tienes permiso para editar prospectos.' });
        }
        const result = await forwardBusinessAction('crmUpsert', { client });
        return res.status(200).json({ status: 'success', client: result.client });
      }
      if (action === 'adminFollowUpCreate') {
        const followUp = submitted.followUp || {};
        if (!String(followUp.recordId || '').trim() || (!String(followUp.conversation || '').trim() && !String(followUp.result || '').trim())) {
          return res.status(400).json({ status: 'error', message: 'Selecciona un registro y captura la conversación o el resultado.' });
        }
        if (session.role !== 'SUPER_ADMIN') {
          const snapshotResult = await forwardBusinessAction('businessSnapshot');
          const record = (snapshotResult.snapshot?.clients || []).find((item) => String(item.id) === String(followUp.recordId));
          const assigned = (snapshotResult.snapshot?.assignments || []).some((item) => String(item.userId) === String(session.userId) && String(item.clientId) === String(followUp.recordId) && item.status !== 'CANCELADA');
          if (!record || (record.recordType === 'Cliente' && !assigned)) return res.status(403).json({ status: 'error', message: 'No puedes registrar seguimiento en ese expediente.' });
        }
        const result = await forwardBusinessAction('followUpCreate', { followUp });
        return res.status(200).json({ status: 'success', followUp: result.followUp, client: result.client });
      }
      if (action === 'adminProspectConvert') {
        const prospectId = String(submitted.prospectId || '').trim();
        if (!prospectId) return res.status(400).json({ status: 'error', message: 'Prospecto no identificado.' });
        const result = await forwardBusinessAction('prospectConvert', { prospectId });
        return res.status(200).json({ status: 'success', client: result.client });
      }
      if (action === 'adminCalendarSync') {
        const clientId = String(submitted.clientId || '').trim();
        if (!clientId) return res.status(400).json({ status: 'error', message: 'Cliente no identificado.' });
        if (session.role !== 'SUPER_ADMIN') {
          const snapshotResult = await forwardBusinessAction('businessSnapshot');
          const assigned = (snapshotResult.snapshot?.assignments || []).some((item) => String(item.userId) === String(session.userId) && String(item.clientId) === clientId && item.status !== 'CANCELADA');
          if (!assigned || !hasPermission(session, 'CLIENTS_WRITE')) return res.status(403).json({ status: 'error', message: 'No puedes sincronizar un cliente que no tienes autorizado para editar.' });
        }
        try {
          const result = await forwardBusinessAction('calendarSync', { clientId });
          return res.status(200).json({ status: 'success', client: result.client });
        } catch (error) {
          const message = String(error?.message || error || 'No se pudo actualizar Calendar.').replace(/^Error:\s*/i, '');
          await forwardBusinessAction('crmUpsert', { client: { id: clientId, calendarSyncStatus: 'Error', calendarSyncError: message } }).catch(() => null);
          if (/fecha y el horario|fecha.*horario/i.test(message)) return res.status(400).json({ status: 'error', message });
          throw error;
        }
      }
      if (action === 'adminExpenseUpsert') {
        const expense = submitted.expense || {};
        if (!EXPENSE_CATEGORIES.has(String(expense.category || '')) || !EXPENSE_ACCOUNTS.has(String(expense.account || 'Banco'))) {
          return res.status(400).json({ status: 'error', message: 'Categoría o cuenta de gasto no válida.' });
        }
        if (!['Pagado', 'Pendiente'].includes(String(expense.paymentStatus || ''))) {
          return res.status(400).json({ status: 'error', message: 'Estado de gasto no válido.' });
        }
        const result = await forwardBusinessAction('expenseUpsert', { expense });
        return res.status(200).json({ status: 'success', expense: result.expense });
      }
      if (action === 'adminPaymentUpsert') {
        const payment = submitted.payment || {};
        if (!payment.clientId || !['Pendiente', 'Parcial', 'Liquidado', 'Anulado'].includes(String(payment.status || ''))) {
          return res.status(400).json({ status: 'error', message: 'Cliente o estado de pago no válido.' });
        }
        if (Number(payment.plannedAmount || 0) <= 0 || (['Parcial', 'Liquidado'].includes(String(payment.status)) && Number(payment.receivedAmount || 0) <= 0)) {
          return res.status(400).json({ status: 'error', message: 'Revisa los montos programado y recibido.' });
        }
        if (Number(payment.installmentNumber || 0) < 0 || Number(payment.installmentNumber || 0) > 99 || Number(payment.percentage || 0) < 0 || Number(payment.percentage || 0) > 100) {
          return res.status(400).json({ status: 'error', message: 'Número de pago o porcentaje no válido.' });
        }
        if (payment.receiptBase64 && (!['image/jpeg', 'image/png', 'application/pdf'].includes(String(payment.receiptMimeType || '')) || String(payment.receiptBase64).length > 3_600_000)) {
          return res.status(400).json({ status: 'error', message: 'El comprobante debe ser JPG, PNG o PDF y pesar máximo 2.6 MB.' });
        }
        const result = await forwardBusinessAction('paymentUpsert', { payment });
        return res.status(200).json({ status: 'success', payment: result.payment, transaction: result.transaction, client: result.client });
      }
      if (action === 'adminAdjustmentUpsert') {
        const adjustment = submitted.adjustment || {};
        if (!['Gasto no registrado', 'Pendiente por identificar', 'Ajuste financiero', 'Otro'].includes(String(adjustment.category || '')) || !['ACTIVO', 'ANULADO'].includes(String(adjustment.status || 'ACTIVO'))) {
          return res.status(400).json({ status: 'error', message: 'Categoría o estado de ajuste no válido.' });
        }
        if (!String(adjustment.concept || '').trim() || Math.abs(Number(adjustment.amount || 0)) < 0.005) {
          return res.status(400).json({ status: 'error', message: 'El ajuste requiere concepto e importe diferente de cero.' });
        }
        const result = await forwardBusinessAction('adjustmentUpsert', { adjustment });
        return res.status(200).json({ status: 'success', adjustment: result.adjustment });
      }
      if (action === 'adminClientPackageAssign') {
        const clientId = String(submitted.clientId || '').trim().slice(0, 120);
        const selectedPackage = submitted.package || {};
        if (!clientId || !String(selectedPackage.id || '').trim() || !String(selectedPackage.name || '').trim() || Number(selectedPackage.price || 0) < 0 || !Array.isArray(selectedPackage.features)) {
          return res.status(400).json({ status: 'error', message: 'Selecciona un cliente y un paquete válido.' });
        }
        if (session.role !== 'SUPER_ADMIN') {
          const snapshotResult = await forwardBusinessAction('businessSnapshot');
          const assigned = (snapshotResult.snapshot?.assignments || []).some((item) => String(item.userId) === String(session.userId) && String(item.clientId) === clientId && item.status !== 'CANCELADA');
          if (!assigned) return res.status(403).json({ status: 'error', message: 'No puedes modificar el paquete de un cliente no asignado.' });
        }
        const safePackage = {
          id: String(selectedPackage.id).slice(0, 120),
          name: String(selectedPackage.name).slice(0, 200),
          price: Math.max(0, Number(selectedPackage.price) || 0),
          description: String(selectedPackage.description || '').slice(0, 2000),
          features: selectedPackage.features.slice(0, 100).map((item) => String(item || '').slice(0, 300)).filter(Boolean),
          notIncludes: Array.isArray(selectedPackage.notIncludes) ? selectedPackage.notIncludes.slice(0, 100).map((item) => String(item || '').slice(0, 300)).filter(Boolean) : [],
        };
        const result = await forwardBusinessAction('clientPackageAssign', {
          clientId,
          category: String(submitted.category || '').slice(0, 100),
          package: safePackage,
          discount: Math.max(0, Number(submitted.discount) || 0),
          promotion: String(submitted.promotion || '').slice(0, 500),
        });
        return res.status(200).json({ status: 'success', packageSnapshot: result.packageSnapshot, services: result.services, client: result.client });
      }
      if (action === 'adminServiceUpsert') {
        const service = submitted.service || {};
        if (!service.clientId || !String(service.concept || '').trim() || Number(service.quantity || 0) <= 0 || !['PAQUETE', 'MANUAL'].includes(String(service.source || 'MANUAL'))) {
          return res.status(400).json({ status: 'error', message: 'El servicio requiere cliente, concepto, cantidad y origen válidos.' });
        }
        if (session.role !== 'SUPER_ADMIN') {
          const snapshotResult = await forwardBusinessAction('businessSnapshot');
          const assigned = (snapshotResult.snapshot?.assignments || []).some((item) => String(item.userId) === String(session.userId) && String(item.clientId) === String(service.clientId) && item.status !== 'CANCELADA');
          if (!assigned) return res.status(403).json({ status: 'error', message: 'No puedes modificar servicios de un cliente no asignado.' });
        }
        const result = await forwardBusinessAction('serviceUpsert', { service });
        return res.status(200).json({ status: 'success', service: result.service });
      }
      if (action === 'adminAddonUpsert') {
        const addon = submitted.addon || {};
        if (!addon.clientId || !String(addon.concept || '').trim() || Number(addon.quantity || 0) <= 0 || !['Pendiente', 'Confirmado', 'Entregado', 'Anulado'].includes(String(addon.status || 'Confirmado'))) {
          return res.status(400).json({ status: 'error', message: 'El adicional requiere cliente, concepto, cantidad y estado válidos.' });
        }
        if (session.role !== 'SUPER_ADMIN') {
          const snapshotResult = await forwardBusinessAction('businessSnapshot');
          const assigned = (snapshotResult.snapshot?.assignments || []).some((item) => String(item.userId) === String(session.userId) && String(item.clientId) === String(addon.clientId) && item.status !== 'CANCELADA');
          if (!assigned) return res.status(403).json({ status: 'error', message: 'No puedes modificar adicionales de un cliente no asignado.' });
        }
        const result = await forwardBusinessAction('addonUpsert', { addon });
        return res.status(200).json({ status: 'success', addon: result.addon, client: result.client, packageSnapshot: result.packageSnapshot });
      }
      if (action === 'adminTeamFunctionUpsert') {
        const teamFunction = submitted.teamFunction || {};
        if (!String(teamFunction.name || '').trim() || !['ACTIVA', 'INACTIVA'].includes(String(teamFunction.status || 'ACTIVA'))) return res.status(400).json({ status: 'error', message: 'La función requiere nombre y estado válido.' });
        const result = await forwardBusinessAction('teamFunctionUpsert', { teamFunction });
        return res.status(200).json({ status: 'success', teamFunction: result.teamFunction });
      }
      if (action === 'adminTeamUserUpsert') {
        const user = submitted.user || {};
        const allowedPermissions = new Set(['CRM_READ', 'CRM_WRITE', 'CLIENTS_READ', 'CLIENTS_WRITE', 'CALENDAR', 'EMAIL_SEND', 'GALLERIES']);
        const permissions = Array.isArray(user.permissions) ? user.permissions.map(String).filter((permission) => allowedPermissions.has(permission)) : [];
        if (!String(user.name || '').trim() || !/^\S+@\S+\.\S+$/.test(String(user.email || '')) || !['INVITADO', 'ACTIVO', 'INACTIVO'].includes(String(user.status || 'INVITADO'))) return res.status(400).json({ status: 'error', message: 'El usuario requiere nombre, correo y estado válidos.' });
        const result = await forwardBusinessAction('teamUserUpsert', { user: { ...user, role: 'COLLABORATOR', permissions } });
        return res.status(200).json({ status: 'success', user: result.user });
      }
      if (action === 'adminTeamInviteCreate') {
        const userId = String(submitted.userId || '').trim();
        if (!userId) return res.status(400).json({ status: 'error', message: 'Selecciona el colaborador que recibirá la invitación.' });
        const token = randomBytes(32).toString('base64url');
        const tokenHash = createHash('sha256').update(token).digest('base64url');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const inviteUrl = `${requestOrigin(req)}/api/proxy?action=teamGoogleStart&invite=${encodeURIComponent(token)}`;
        const result = await forwardBusinessAction('teamInviteCreate', { userId, tokenHash, expiresAt, inviteUrl });
        return res.status(200).json({ status: 'success', user: result.user, expiresAt: result.expiresAt });
      }
      if (action === 'adminTeamAssignmentUpsert') {
        const assignment = submitted.assignment || {};
        if (!assignment.clientId || !assignment.userId || !/^\d{4}-\d{2}-\d{2}/.test(String(assignment.startDate || '')) || !['EVENT', 'SESSION', 'MANUAL'].includes(String(assignment.scheduleSource || 'EVENT'))) return res.status(400).json({ status: 'error', message: 'La asignación requiere cliente, colaborador, fecha y origen de horario válidos.' });
        const result = await forwardBusinessAction('teamAssignmentUpsert', { assignment: { ...assignment, scheduleSource: String(assignment.scheduleSource || 'EVENT') }, allowOverride: Boolean(submitted.allowOverride) });
        if (result.conflict && !submitted.allowOverride) return res.status(409).json({ status: 'conflict', message: 'El colaborador ya tiene una actividad que se traslapa.', conflict: result.conflict });
        return res.status(200).json({ status: 'success', assignment: result.assignment, conflict: result.conflict || null });
      }
      if (action === 'adminGmailConfigUpsert') {
        const input = submitted.gmailConfig || {};
        if (String(input.replyTo || '') && !/^\S+@\S+\.\S+$/.test(String(input.replyTo))) return res.status(400).json({ status: 'error', message: 'El correo de respuesta no es válido.' });
        const result = await forwardBusinessAction('gmailConfigUpsert', { gmailConfig: {
          enabled: Boolean(input.enabled), senderName: String(input.senderName || '').slice(0, 160), replyTo: String(input.replyTo || '').slice(0, 180),
          signatureHtml: String(input.signatureHtml || '').slice(0, 12000), autoPaymentReceived: Boolean(input.autoPaymentReceived),
          autoPaymentDue: Boolean(input.autoPaymentDue), autoEventReminders: Boolean(input.autoEventReminders),
        } });
        return res.status(200).json({ status: 'success', gmailConfig: result.gmailConfig });
      }
      if (action === 'adminGmailTest') {
        const recipient = String(submitted.recipient || '').trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(recipient)) return res.status(400).json({ status: 'error', message: 'Escribe un correo válido para la prueba.' });
        const result = await forwardBusinessAction('gmailTest', { recipient, userId: session.userId });
        return res.status(200).json({ status: 'success', emailHistory: result.emailHistory });
      }
      if (action === 'adminEmailTemplateUpsert') {
        const emailTemplate = submitted.emailTemplate || {};
        if (!String(emailTemplate.name || '').trim() || !String(emailTemplate.subject || '').trim() || !String(emailTemplate.htmlBody || '').trim() || !['ACTIVA', 'INACTIVA'].includes(String(emailTemplate.status || 'ACTIVA'))) {
          return res.status(400).json({ status: 'error', message: 'La plantilla requiere nombre, asunto, contenido y estado válido.' });
        }
        const result = await forwardBusinessAction('emailTemplateUpsert', { emailTemplate: { id: String(emailTemplate.id || '').slice(0, 120), name: String(emailTemplate.name).slice(0, 160), subject: String(emailTemplate.subject).slice(0, 300), htmlBody: String(emailTemplate.htmlBody).slice(0, 30000), status: String(emailTemplate.status || 'ACTIVA') } });
        return res.status(200).json({ status: 'success', emailTemplate: result.emailTemplate });
      }
      if (action === 'adminEmailSend') {
        const clientId = String(submitted.clientId || '').trim();
        const templateId = String(submitted.templateId || '').trim();
        if (!clientId || !templateId) return res.status(400).json({ status: 'error', message: 'Selecciona un cliente/prospecto y una plantilla.' });
        if (session.role !== 'SUPER_ADMIN') {
          const snapshotResult = await forwardBusinessAction('businessSnapshot');
          const related = (snapshotResult.snapshot?.clients || []).find((item) => String(item.id) === clientId);
          const allowed = (snapshotResult.snapshot?.assignments || []).some((item) => String(item.userId) === String(session.userId) && String(item.clientId) === clientId && item.status !== 'CANCELADA');
          const prospectAllowed = related?.recordType === 'Prospecto' && (hasPermission(session, 'CRM_READ') || hasPermission(session, 'CRM_WRITE'));
          if (!allowed && !prospectAllowed) return res.status(403).json({ status: 'error', message: 'No puedes enviar correo a este contacto.' });
        }
        const result = await forwardBusinessAction('emailSend', { clientId, templateId, variables: submitted.variables && typeof submitted.variables === 'object' ? submitted.variables : {}, userId: session.userId });
        return res.status(200).json({ status: 'success', emailHistory: result.emailHistory });
      }
      if (action === 'adminEmailLogoUploadInit') {
        const filename = String(submitted.filename || '').trim().slice(0, 180);
        const mimeType = String(submitted.mimeType || '').trim().toLowerCase();
        const size = Number(submitted.size || 0);
        if (!filename || !['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) || size <= 0 || size > 5_000_000) return res.status(400).json({ status: 'error', message: 'El logo debe ser PNG, JPG o WebP y pesar máximo 5 MB.' });
        const result = await forwardBusinessAction('gmailLogoUploadInit', { filename, mimeType, size });
        return res.status(200).json({ status: 'success', uploadUrl: result.uploadUrl });
      }
      if (action === 'adminEmailLogoUploadFinalize') {
        const fileId = String(submitted.fileId || '').trim().slice(0, 200);
        if (!fileId) return res.status(400).json({ status: 'error', message: 'No se recibió el logo cargado.' });
        const result = await forwardBusinessAction('gmailLogoUploadFinalize', { fileId });
        return res.status(200).json({ status: 'success', gmailConfig: result.gmailConfig });
      }
      if (action === 'adminNotificationRead') {
        const notificationId = String(submitted.notificationId || '').trim();
        if (!notificationId) return res.status(400).json({ status: 'error', message: 'Notificación no identificada.' });
        if (session.role !== 'SUPER_ADMIN') {
          const snapshotResult = await forwardBusinessAction('businessSnapshot');
          const ownsNotification = (snapshotResult.snapshot?.notifications || []).some((item) => String(item.id) === notificationId && String(item.userId) === String(session.userId));
          if (!ownsNotification) return res.status(403).json({ status: 'error', message: 'No puedes modificar esa notificación.' });
        }
        const result = await forwardBusinessActionWithLockRetry('notificationRead', { notificationId, status: submitted.status === 'PENDIENTE' ? 'PENDIENTE' : 'LEIDA' });
        return res.status(200).json({ status: 'success', notification: result.notification });
      }
      if (action === 'adminRemindersRun') {
        const result = await forwardBusinessAction('remindersRun', {});
        return res.status(200).json(result);
      }
      if (action === 'adminRemindersInstall') {
        const result = await forwardBusinessAction('remindersInstall', {});
        return res.status(200).json(result);
      }
      if (action === 'adminGalleryCreate') {
        const clientId = String(submitted.clientId || '').trim().slice(0, 120);
        if (!clientId) return res.status(400).json({ status: 'error', message: 'Selecciona un cliente para crear la galería.' });
        if (session.role !== 'SUPER_ADMIN') {
          const snapshotResult = await forwardBusinessAction('businessSnapshot');
          const allowed = (snapshotResult.snapshot?.assignments || []).some((item) => String(item.userId) === String(session.userId) && String(item.clientId) === clientId && item.status !== 'CANCELADA');
          if (!allowed) return res.status(403).json({ status: 'error', message: 'No puedes administrar una galería de un cliente que no tienes asignado.' });
        }
        const token = randomBytes(32).toString('base64url');
        const baseSlug = String(submitted.clientName || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'cliente';
        const slug = `${baseSlug}-${randomBytes(4).toString('hex')}`;
        const galleryId = `galeria-${randomBytes(12).toString('hex')}`;
        const galleryUrl = `${requestOrigin(req)}/?galeria=${encodeURIComponent(slug)}&k=${encodeURIComponent(token)}`;
        const result = await forwardBusinessAction('galleryCreate', { clientId, title: String(submitted.title || '').slice(0, 240), galleryId, slug, accessToken: token, galleryUrl });
        return res.status(200).json({ status: 'success', gallery: result.gallery, created: Boolean(result.created) });
      }
      if (action === 'adminGalleryUploadInit') {
        const galleryId = String(submitted.galleryId || '').trim().slice(0, 120);
        const filename = String(submitted.filename || '').trim().slice(0, 180);
        const mimeType = String(submitted.mimeType || '').trim().toLowerCase();
        const size = Number(submitted.size || 0);
        if (!galleryId || !filename || !mimeType.startsWith('image/') || size <= 0 || size > 100_000_000) return res.status(400).json({ status: 'error', message: 'La fotografía debe ser válida y pesar máximo 100 MB.' });
        const result = await forwardBusinessAction('galleryUploadInit', { galleryId, filename, mimeType, size });
        return res.status(200).json({ status: 'success', uploadUrl: result.uploadUrl });
      }
      if (action === 'adminGalleryUploadFinalize') {
        const galleryId = String(submitted.galleryId || '').trim().slice(0, 120);
        const fileId = String(submitted.fileId || '').trim().slice(0, 200);
        if (!galleryId || !fileId) return res.status(400).json({ status: 'error', message: 'La fotografía o la galería no están identificadas.' });
        const result = await forwardBusinessAction('galleryUploadFinalize', { galleryId, fileId, title: String(submitted.title || '').slice(0, 180) });
        return res.status(200).json({ status: 'success', gallery: result.gallery, media: result.media });
      }
      if (action === 'adminGalleryStatusUpdate') {
        const galleryId = String(submitted.galleryId || '').trim();
        const status = String(submitted.status || '');
        if (!galleryId || !['BORRADOR', 'ACTIVA', 'LISTA', 'ARCHIVADA'].includes(status)) return res.status(400).json({ status: 'error', message: 'Galería o estado no válido.' });
        const result = await forwardBusinessAction('galleryStatusUpdate', { galleryId, status });
        return res.status(200).json({ status: 'success', gallery: result.gallery });
      }
      if (action === 'adminInternalEventUpsert') {
        const internalEvent = submitted.internalEvent || {};
        if (!String(internalEvent.title || '').trim() || !/^\d{4}-\d{2}-\d{2}/.test(String(internalEvent.startDate || '')) || !['SUPER_ADMIN', 'SELECTED'].includes(String(internalEvent.visibility || 'SUPER_ADMIN')) || !['ACTIVO', 'CANCELADO'].includes(String(internalEvent.status || 'ACTIVO'))) {
          return res.status(400).json({ status: 'error', message: 'El evento interno requiere título, fecha, visibilidad y estado válidos.' });
        }
        const userIds = Array.isArray(internalEvent.userIds) ? internalEvent.userIds.map(String).filter(Boolean).slice(0, 100) : [];
        if (internalEvent.visibility === 'SELECTED' && !userIds.length) return res.status(400).json({ status: 'error', message: 'Selecciona al menos un usuario para este evento interno.' });
        const result = await forwardBusinessAction('internalEventUpsert', { internalEvent: { ...internalEvent, title: String(internalEvent.title).slice(0, 240), notes: String(internalEvent.notes || '').slice(0, 4000), location: String(internalEvent.location || '').slice(0, 600), userIds } });
        return res.status(200).json({ status: 'success', internalEvent: result.internalEvent });
      }
      if (action === 'adminContractUpload') {
        const contract = submitted.contract || {};
        if (!contract.clientId || !contract.clientName || !contract.folio || !contract.base64) {
          return res.status(400).json({ status: 'error', message: 'Faltan datos del contrato.' });
        }
        if (String(contract.mimeType || '') !== 'application/pdf' || !isPdfDataUrl(contract.base64)) {
          return res.status(400).json({ status: 'error', message: 'El contrato debe ser un archivo PDF.' });
        }
        const result = await forwardBusinessAction('contractUpload', { contract });
        return res.status(200).json({ status: 'success', contract: result.contract });
      }
      if (action === 'adminContractUploadInit') {
        const filename = String(submitted.filename || '').trim().slice(0, 180);
        const mimeType = String(submitted.mimeType || '').trim().toLowerCase();
        const size = Number(submitted.size || 0);
        if (!filename || mimeType !== 'application/pdf' || size <= 0 || size > 5_000_000) return res.status(400).json({ status: 'error', message: 'El contrato debe ser PDF y pesar máximo 5 MB.' });
        const result = await forwardBusinessAction('contractUploadInit', { filename, mimeType, size });
        return res.status(200).json({ status: 'success', uploadUrl: result.uploadUrl });
      }
      if (action === 'adminContractUploadFinalize') {
        const contract = submitted.contract || {};
        if (!contract.fileId || !contract.clientId || !contract.clientName || !contract.folio) return res.status(400).json({ status: 'error', message: 'Faltan datos del contrato cargado.' });
        const result = await forwardBusinessAction('contractUploadFinalize', { contract: {
          fileId: String(contract.fileId).slice(0, 200), clientId: String(contract.clientId).slice(0, 120), clientName: String(contract.clientName).slice(0, 180),
          folio: String(contract.folio).slice(0, 100), eventType: String(contract.eventType || '').slice(0, 120), eventDate: String(contract.eventDate || '').slice(0, 40),
        } });
        return res.status(200).json({ status: 'success', contract: result.contract });
      }
      if (action === 'adminContractCreateLink') {
        const contractId = String(submitted.contractId || '');
        if (!contractId) return res.status(400).json({ status: 'error', message: 'Contrato no identificado.' });
        const token = randomBytes(32).toString('base64url');
        const tokenHash = createHash('sha256').update(token).digest('base64url');
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        await forwardBusinessAction('contractCreateLink', { contractId, tokenHash, expiresAt });
        const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0];
        const host = String(req.headers?.host || 'www.xaviph.com');
        return res.status(200).json({ status: 'success', url: `${protocol}://${host}/firmar/${token}`, expiresAt });
      }
      if (action === 'adminOwnerSignatureSave') {
        const signatureDataUrl = String(submitted.signatureDataUrl || '');
        if (!isPngDataUrl(signatureDataUrl)) return res.status(400).json({ status: 'error', message: 'Firma inválida.' });
        await forwardBusinessAction('ownerSignatureSave', { signatureDataUrl });
        return res.status(200).json({ status: 'success' });
      }
      if (action === 'adminContractFinalize') {
        const contractId = String(submitted.contractId || '');
        const material = await forwardBusinessAction('contractFinalizeData', { contractId });
        const authorizedAt = new Date().toISOString();
        const finalizedPdfBase64 = await applyOwnerSignature(material.pdfBase64, material.ownerSignatureDataUrl, authorizedAt);
        const finalDocumentHash = createHash('sha256').update(Buffer.from(finalizedPdfBase64, 'base64')).digest('hex');
        const result = await forwardBusinessAction('contractFinalize', { contractId, finalizedPdfBase64, finalDocumentHash, authorizedAt });
        return res.status(200).json({ status: 'success', contract: result.contract });
      }
    }

    if (req.method === 'GET' && action === 'adminContractPdf') {
      const session = verifySession(req);
      if (!requirePermission(res, session, 'CONTRACTS')) return;
      const contractId = String(req.query?.contractId || '').trim();
      const requestedVersion = String(req.query?.version || 'latest');
      const version = ['original', 'signed', 'final', 'latest'].includes(requestedVersion) ? requestedVersion : 'latest';
      if (!contractId) return res.status(400).json({ status: 'error', message: 'Contrato no identificado.' });
      const result = await forwardBusinessAction('contractAdminPdfData', { contractId, version });
      const pdf = Buffer.from(cleanBase64(result.pdfBase64), 'base64');
      if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('El contrato privado no contiene un PDF válido.');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="contrato-${String(result.folio || 'xph').replace(/[^a-z0-9-]/gi, '_')}.pdf"`);
      return res.status(200).send(pdf);
    }

    if (req.method === 'GET' && (action === 'contractView' || action === 'contractPdf')) {
      const token = String(req.query?.token || '').trim();
      if (!token) return res.status(400).json({ status: 'error', message: 'Liga incompleta.' });
      if (!isMobileSigningRequest(req)) {
        await forwardBusinessAction('contractInvalidate', { token }).catch(() => null);
        return res.status(410).json({ status: 'error', message: 'Esta liga solo funciona en un teléfono. Se canceló por seguridad; solicita una nueva a Javier.' });
      }
      const result = await forwardBusinessAction('contractResolve', { token, includePdf: action === 'contractPdf', markViewed: true });
      if (action === 'contractPdf') {
        const pdf = Buffer.from(cleanBase64(result.pdfBase64), 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="contrato-${String(result.contract?.folio || 'xaviph').replace(/[^a-z0-9-]/gi, '_')}.pdf"`);
        return res.status(200).send(pdf);
      }
      return res.status(200).json({ status: 'success', contract: result.contract });
    }

    if (req.method === 'POST' && action === 'contractSign') {
      if (!isMobileSigningRequest(req)) return res.status(403).json({ status: 'error', message: 'La firma solo está permitida desde un teléfono.' });
      const attempt = rateLimit(req, 'contract-sign', 5, 30 * 60 * 1000);
      if (!attempt.allowed) return res.status(429).json({ status: 'error', message: 'Demasiados intentos. Solicita una liga nueva.' });
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}
      const token = String(submitted.token || '');
      const signatureDataUrl = String(submitted.signatureDataUrl || '');
      if (!submitted.accepted || !token || !isPngDataUrl(signatureDataUrl)) {
        return res.status(400).json({ status: 'error', message: 'Aceptación o firma incompleta.' });
      }
      if (Buffer.byteLength(signatureDataUrl, 'utf8') > 900_000) return res.status(413).json({ status: 'error', message: 'La firma excede el tamaño permitido.' });
      const material = await forwardBusinessAction('contractResolve', { token, includePdf: true, markViewed: true });
      const audit = signingAudit(req);
      const signedPdfBase64 = await appendClientSignature(material.pdfBase64, signatureDataUrl, material.contract, audit);
      const originalDocumentHash = createHash('sha256').update(Buffer.from(cleanBase64(material.pdfBase64), 'base64')).digest('hex');
      const signedDocumentHash = createHash('sha256').update(Buffer.from(signedPdfBase64, 'base64')).digest('hex');
      await forwardBusinessAction('contractCompleteSignature', {
        token,
        signedPdfBase64,
        signatureDataUrl,
        originalDocumentHash,
        signedDocumentHash,
        audit,
      });
      return res.status(200).json({ status: 'success', message: 'Firma recibida.' });
    }

    if (req.method === 'POST' && ['adminConfig', 'adminSaveConfig', 'adminUpload', 'adminDriveList'].includes(action)) {
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}

      const payload = await fetchConfigFromScript();
      const config = normalizeConfig(payload);
      const session = verifySession(req);
      if (!requirePermission(res, session, 'SUPER_ADMIN')) return;

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
      await forwardBusinessAction('crmUpsert', {
        client: {
          id: `web-${String(safeLead.id).replace(/[^a-z0-9-]/gi, '').slice(0, 100)}`,
          recordType: 'Prospecto',
          name: safeLead.clientName,
          phone: safeLead.clientPhone,
          email: safeLead.clientEmail,
          eventType: safeLead.eventType,
          eventDate: safeLead.eventDate,
          eventLocation: safeLead.eventCity,
          packageName: safeLead.packageName,
          totalAmount: safeLead.total,
          paidAmount: 0,
          status: 'Nuevo',
          source: 'Formulario de xaviph.com',
          firstContactAt: new Date().toISOString(),
          lastContactAt: '',
          nextAction: 'Responder solicitud de disponibilidad',
          nextActionAt: '',
          notes: safeLead.notes,
          campaign: '',
          followUpAttempts: 0,
        },
      });
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
