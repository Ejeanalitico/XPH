import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const APPS_SCRIPT_URL = process.env.XPH_APPS_SCRIPT_URL || '';
const APPS_SCRIPT_SHARED_SECRET = process.env.XPH_APPS_SCRIPT_SHARED_SECRET || '';
const SESSION_SECRET = process.env.XPH_SESSION_SECRET || '';
const SESSION_COOKIE = 'xph_admin_session';
const REVIEW_LINK_DAYS = 30;

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
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

function verifyAdminSession(req) {
  if (!SESSION_SECRET) return null;
  const token = readCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  try {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.email || Number(payload.exp) <= Date.now()) return null;
    if (String(payload.role || '') !== 'SUPER_ADMIN') return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function isSameOrigin(req) {
  const origin = String(req.headers?.origin || '');
  if (!origin) return true;
  try { return new URL(origin).host === String(req.headers?.host || ''); } catch (_) { return false; }
}

function integrationUrl(action) {
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_SHARED_SECRET) throw new Error('La base privada de XPH no está configurada.');
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

async function loadConfig() {
  const response = await fetch(integrationUrl('loadConfig'), { method: 'GET', headers: { Accept: 'application/json' }, redirect: 'follow' });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('La base privada devolvió una respuesta no válida.'); }
  if (!response.ok || parsed?.status !== 'success') throw new Error(parsed?.message || 'No se pudo consultar la base privada.');
  return normalizeConfig(parsed);
}

async function saveTestimonials(testimonials, auditDetails) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'saveConfig',
      apiSecret: APPS_SCRIPT_SHARED_SECRET,
      configData: JSON.stringify({ testimonials }),
      auditType: 'TESTIMONIO_CLIENTE_ELIMINADO',
      auditDetails: auditDetails || 'Reseña eliminada desde el administrador',
    }),
    redirect: 'follow',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('La base privada no confirmó la eliminación.'); }
  if (!response.ok || parsed?.status !== 'success') throw new Error(parsed?.message || 'No se pudo eliminar la reseña.');
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

function ratingFor(item) {
  const direct = Number(item?.rating || 0);
  if (direct >= 1 && direct <= 5) return direct;
  const values = [Number(item?.serviceRating || 0), Number(item?.photoRating || 0)].filter((value) => value >= 1 && value <= 5);
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function safeReviews(config) {
  const reviews = Array.isArray(config?.testimonials) ? config.testimonials : [];
  return reviews
    .map((item) => ({
      id: String(item?.id || ''),
      name: String(item?.name || item?.author || 'Cliente XPH').slice(0, 80),
      eventType: String(item?.eventType || '').slice(0, 60),
      rating: ratingFor(item),
      comment: String(item?.comment || item?.text || '').slice(0, 1500),
      status: String(item?.status || (item?.approved ? 'PUBLICADO' : 'PENDIENTE')),
      approved: item?.approved === true || item?.status === 'PUBLICADO',
      createdAt: String(item?.createdAt || ''),
    }))
    .filter((item) => item.id && item.comment)
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
}

function signReviewToken(eventType) {
  if (!SESSION_SECRET) throw new Error('El secreto de sesión no está configurado.');
  const expiresAt = Date.now() + REVIEW_LINK_DAYS * 24 * 60 * 60 * 1000;
  const encoded = b64url(JSON.stringify({ kind: 'xph-review', nonce: randomUUID(), eventType: cleanText(eventType, 60), exp: expiresAt }));
  const signature = createHmac('sha256', SESSION_SECRET).update(`review:${encoded}`).digest('base64url');
  return { token: `${encoded}.${signature}`, expiresAt };
}

function requestOrigin(req) {
  const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0];
  return `${protocol}://${String(req.headers?.host || 'www.xaviph.com')}`;
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const session = verifyAdminSession(req);
  if (!session) return res.status(401).json({ status: 'error', message: 'Inicia sesión como Super Admin para administrar reseñas.' });
  if (!isSameOrigin(req)) return res.status(403).json({ status: 'error', message: 'Origen no permitido.' });

  try {
    if (req.method === 'GET') {
      const config = await loadConfig();
      return res.status(200).json({ status: 'success', reviews: safeReviews(config) });
    }

    if (req.method === 'POST') {
      const submitted = parseBody(req);
      const eventType = cleanText(submitted.eventType, 60);
      const { token, expiresAt } = signReviewToken(eventType);
      const url = `${requestOrigin(req)}/?xph-review=${encodeURIComponent(token)}`;
      return res.status(200).json({ status: 'success', url, eventType, expiresAt: new Date(expiresAt).toISOString() });
    }

    if (req.method === 'DELETE') {
      const submitted = parseBody(req);
      const reviewId = String(submitted.reviewId || '').trim();
      if (!reviewId || reviewId.length > 160) return res.status(400).json({ status: 'error', message: 'La reseña seleccionada no es válida.' });

      const config = await loadConfig();
      const current = Array.isArray(config.testimonials) ? config.testimonials : [];
      const target = current.find((item) => String(item?.id || '') === reviewId);
      if (!target) return res.status(404).json({ status: 'error', message: 'La reseña ya no existe.' });

      const testimonials = current.filter((item) => String(item?.id || '') !== reviewId);
      const author = String(target?.name || target?.author || 'Cliente XPH').slice(0, 80);
      await saveTestimonials(testimonials, `Reseña de ${author} eliminada por ${session.email}`);
      return res.status(200).json({ status: 'success', deletedId: reviewId });
    }

    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    return res.status(405).json({ status: 'error', message: 'Método no permitido.' });
  } catch (error) {
    console.error('[XPH Review Admin] Error:', error);
    return res.status(500).json({ status: 'error', message: req.method === 'DELETE' ? 'No se pudo eliminar la reseña.' : 'No se pudo cargar el módulo de reseñas.' });
  }
}
