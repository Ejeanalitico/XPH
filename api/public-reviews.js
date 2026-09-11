const APPS_SCRIPT_URL = process.env.XPH_APPS_SCRIPT_URL || '';
const APPS_SCRIPT_SHARED_SECRET = process.env.XPH_APPS_SCRIPT_SHARED_SECRET || '';

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
  const response = await fetch(integrationUrl('loadConfig'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { throw new Error('Respuesta no válida.'); }
  if (!response.ok || parsed?.status !== 'success') throw new Error(parsed?.message || 'No se pudieron consultar las reseñas.');
  return normalizeConfig(parsed);
}

function ratingFor(item) {
  const direct = Number(item?.rating || 0);
  if (direct >= 1 && direct <= 5) return direct;
  const values = [Number(item?.serviceRating || 0), Number(item?.photoRating || 0)].filter((value) => value >= 1 && value <= 5);
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Método no permitido.' });
  }

  try {
    const config = await loadConfig();
    const reviews = (Array.isArray(config.testimonials) ? config.testimonials : [])
      .filter((item) => item?.approved === true || item?.status === 'PUBLICADO' || item?.published === true)
      .map((item) => ({
        id: String(item?.id || ''),
        name: String(item?.name || item?.author || 'Cliente XPH').slice(0, 80),
        eventType: String(item?.eventType || '').slice(0, 60),
        rating: ratingFor(item),
        comment: String(item?.comment || item?.text || '').slice(0, 1500),
        createdAt: String(item?.createdAt || ''),
      }))
      .filter((item) => item.id && item.comment && item.rating >= 1)
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
      .slice(0, 24);

    return res.status(200).json({ status: 'success', reviews });
  } catch (error) {
    console.error('[XPH Public Reviews] Error:', error);
    return res.status(200).json({ status: 'success', reviews: [] });
  }
}
