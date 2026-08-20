const APPS_SCRIPT_URL = process.env.XPH_APPS_SCRIPT_URL || '';
const APPS_SCRIPT_SHARED_SECRET = process.env.XPH_APPS_SCRIPT_SHARED_SECRET || '';

function appsScriptUrl(action) {
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_SHARED_SECRET) {
    throw new Error('La integración segura con Apps Script no está configurada.');
  }
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

function drivePreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

function driveOriginalStreamUrl(fileId) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
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

    const response = await fetch(appsScriptUrl('loadConfig'), {
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
      .map((item) => {
        const isVideo = item.mediaType === 'video';
        const fileId = String(item.id || '').trim();
        return {
          id: item.id,
          title: item.title || '',
          category: 'private',
          url: item.url,
          visibility: 'private',
          mediaType: isVideo ? 'video' : 'image',
          galleryId: item.galleryId,
          galleryAllowDownloads: allowDownloads,
          downloadUrl: allowDownloads ? item.downloadUrl : undefined,
          previewUrl: isVideo && fileId ? drivePreviewUrl(fileId) : (item.previewUrl || item.url),
          streamUrl: allowDownloads && isVideo && fileId ? driveOriginalStreamUrl(fileId) : undefined,
          createdAt: item.createdAt,
        };
      });

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
