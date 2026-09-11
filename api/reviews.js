import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const APPS_SCRIPT_URL = process.env.XPH_APPS_SCRIPT_URL || '';
const APPS_SCRIPT_SHARED_SECRET = process.env.XPH_APPS_SCRIPT_SHARED_SECRET || '';
const SESSION_SECRET = process.env.XPH_SESSION_SECRET || '';
const REVIEW_TOKEN_SHA256 = 'e328aa6adb0511d1a0e3f660bb8bd1f3aed05acd403d98b8f8313f130504e4e0';
const MAX_TESTIMONIALS = 250;
const rateLimitBuckets = globalThis.__xphReviewRateLimitBuckets || new Map();
globalThis.__xphReviewRateLimitBuckets = rateLimitBuckets;

function noIndex(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
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

function validLegacyToken(candidate) {
  const token = String(candidate || '').trim();
  if (!token || token.length > 200) return false;
  const actual = Buffer.from(createHash('sha256').update(token).digest('hex'));
  const expected = Buffer.from(REVIEW_TOKEN_SHA256);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validSignedToken(candidate) {
  const token = String(candidate || '').trim();
  if (!SESSION_SECRET || !token || !token.includes('.') || token.length > 1200) return false;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return false;
  const expected = createHmac('sha256', SESSION_SECRET).update(`review:${encoded}`).digest('base64url');
  try {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload?.kind === 'xph-review' && Number(payload.exp) > Date.now();
  } catch (_) {
    return false;
  }
}

function validToken(candidate) {
  return validSignedToken(candidate) || validLegacyToken(candidate);
}

function rateLimit(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const key = forwarded || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  rateLimitBuckets.set(key, current);
  return current.count <= 8;
}

function normalizeConfig(payload) {
  const raw = payload?.config;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }
  return raw && typeof raw === 'object' ? raw : {};
}

function integrationUrl(action) {
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_SHARED_SECRET) throw new Error('La base privada de XPH no está configurada.');
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('apiSecret', APPS_SCRIPT_SHARED_SECRET);
  url.searchParams.set('_t', Date.now().toString());
  return url.toString();
}

async function loadConfig() {
  const response = await fetch(integrationUrl('loadConfig'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('La base privada devolvió una respuesta no válida.'); }
  if (!response.ok || parsed?.status !== 'success') throw new Error(parsed?.message || 'No se pudo consultar la base privada.');
  return normalizeConfig(parsed);
}

async function saveTestimonials(testimonials) {
  const body = JSON.stringify({
    action: 'saveConfig',
    apiSecret: APPS_SCRIPT_SHARED_SECRET,
    configData: JSON.stringify({ testimonials }),
    auditType: 'TESTIMONIO_CLIENTE_PUBLICADO',
    auditDetails: 'Opinión publicada automáticamente desde liga privada de clientes',
  });
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('La base privada no confirmó el guardado.'); }
  if (!response.ok || parsed?.status !== 'success') throw new Error(parsed?.message || 'No se pudo guardar la opinión.');
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  noIndex(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    if (!validToken(req.query?.token)) return res.status(404).json({ status: 'error', message: 'La liga no es válida o ya no está disponible.' });
    return res.status(200).json({ status: 'success', valid: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ status: 'error', message: 'Método no permitido.' });
  }

  if (!isSameOrigin(req)) return res.status(403).json({ status: 'error', message: 'Origen no permitido.' });
  if (!rateLimit(req)) return res.status(429).json({ status: 'error', message: 'Se alcanzó el límite temporal de envíos. Intenta más tarde.' });

  try {
    const submitted = parseBody(req);
    if (!validToken(submitted.token)) return res.status(404).json({ status: 'error', message: 'La liga no es válida o ya no está disponible.' });

    const name = cleanText(submitted.name, 80);
    const eventType = cleanText(submitted.eventType, 60);
    const comment = cleanText(submitted.comment, 1500);
    const rating = Math.round(Number(submitted.rating || 0));

    if (name.length < 2) return res.status(400).json({ status: 'error', message: 'Escribe tu nombre.' });
    if (![1, 2, 3, 4, 5].includes(rating)) return res.status(400).json({ status: 'error', message: 'Selecciona una calificación de 1 a 5 estrellas.' });
    if (comment.length < 10) return res.status(400).json({ status: 'error', message: 'Cuéntanos un poco más sobre tu experiencia.' });

    const config = await loadConfig();
    const current = Array.isArray(config.testimonials) ? config.testimonials : [];
    const review = {
      id: `review-${randomUUID()}`,
      name,
      author: name,
      eventType,
      rating,
      comment,
      text: comment,
      approved: true,
      published: true,
      status: 'PUBLICADO',
      source: 'PRIVATE_REVIEW_LINK',
      createdAt: new Date().toISOString(),
    };

    const testimonials = [...current, review].slice(-MAX_TESTIMONIALS);
    await saveTestimonials(testimonials);

    return res.status(200).json({ status: 'success', reviewId: review.id, published: true });
  } catch (error) {
    console.error('[XPH Reviews] Error:', error);
    return res.status(500).json({ status: 'error', message: 'No se pudo guardar tu opinión en este momento. Intenta nuevamente.' });
  }
}
