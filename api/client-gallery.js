const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzcabU0-P7RCW04G-MMFds6m4JeQKpiPl6_IaAA40KGQsp73ZsaJx6PuwbcmhBCa4Br/exec';

function normalizeConfig(payload) {
  const raw = payload?.config;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }
  return raw && typeof raw === 'object' ? raw : {};
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Método no permitido.' });
  }

  try {
    const slug = String(req.query?.slug || '').trim();
    const token = String(req.query?.token || '').trim();
    if (!slug || !token) {
      return res.status(400).json({ status: 'error', message: 'Liga privada incompleta.' });
    }

    const response = await fetch(`${APPS_SCRIPT_URL}?action=loadConfig&_t=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'follow',
    });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch (_) {
      return res.status(502).json({ status: 'error', message: 'La galería no pudo cargarse.' });
    }

    const config = normalizeConfig(payload);
    const items = Array.isArray(config.galleryImages) ? config.galleryImages : [];
    const meta = items.find((item) =>
      item?.visibility === 'private' &&
      item?.mediaType === 'gallery-meta' &&
      String(item.gallerySlug || '') === slug &&
      String(item.galleryToken || '') === token
    );

    if (!meta) {
      return res.status(404).json({ status: 'error', message: 'Galería privada no encontrada o liga inválida.' });
    }

    const allowDownloads = meta.galleryAllowDownloads !== false;
    const media = items
      .filter((item) =>
        item?.visibility === 'private' &&
        item?.galleryId === meta.galleryId &&
        item?.mediaType !== 'gallery-meta'
      )
      .map((item) => ({
        id: item.id,
        category: 'private',
        url: item.url,
        visibility: 'private',
        mediaType: item.mediaType === 'video' ? 'video' : 'image',
        galleryId: item.galleryId,
        galleryAllowDownloads: allowDownloads,
        downloadUrl: allowDownloads ? item.downloadUrl : undefined,
        previewUrl: item.previewUrl || item.url,
        createdAt: item.createdAt,
      }));

    return res.status(200).json({
      status: 'success',
      title: meta.galleryTitle || meta.title || 'Galería privada',
      clientName: meta.galleryClient || 'Cliente XPH',
      allowDownloads,
      media,
    });
  } catch (error) {
    console.error('[XPH Client Gallery] Error:', error);
    return res.status(502).json({ status: 'error', message: 'No se pudo abrir la galería.' });
  }
}
