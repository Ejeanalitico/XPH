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

function splitMediaIds(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function drivePreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

function driveImageUrl(fileId) {
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
}

function driveOriginalStreamUrl(fileId) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

function normalizeMedia(item, allowDownloads, fallbackTitle = '') {
  const isVideo = item?.mediaType === 'video';
  const fileId = String(item?.id || '').trim();
  const imageUrl = fileId ? driveImageUrl(fileId) : '';
  const videoPreview = fileId ? drivePreviewUrl(fileId) : '';
  const downloadUrl = fileId ? driveOriginalStreamUrl(fileId) : '';

  return {
    id: item?.id,
    title: item?.title || fallbackTitle,
    category: 'private',
    url: isVideo ? (item?.url || videoPreview) : (item?.url || imageUrl),
    visibility: 'private',
    mediaType: isVideo ? 'video' : 'image',
    galleryId: item?.galleryId,
    galleryAllowDownloads: allowDownloads,
    downloadUrl: allowDownloads ? (item?.downloadUrl || downloadUrl || undefined) : undefined,
    previewUrl: isVideo
      ? (item?.previewUrl || videoPreview || undefined)
      : (item?.previewUrl || item?.url || imageUrl || undefined),
    streamUrl: allowDownloads && isVideo ? (item?.streamUrl || downloadUrl || undefined) : undefined,
    createdAt: item?.createdAt,
  };
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
    const explicitMedia = items.filter((item) =>
      item?.visibility === 'private' &&
      String(item?.galleryId || '') === String(meta.galleryId || '') &&
      item?.mediaType !== 'gallery-meta'
    );

    const indexedImages = splitMediaIds(meta.imageIds).map((id, index) => ({
      id,
      title: `Fotografía ${index + 1}`,
      mediaType: 'image',
      galleryId: meta.galleryId,
    }));
    const indexedVideos = splitMediaIds(meta.videoIds).map((id, index) => ({
      id,
      title: `Video ${index + 1}`,
      mediaType: 'video',
      galleryId: meta.galleryId,
    }));

    const deduped = [];
    const seen = new Set();
    [...explicitMedia, ...indexedImages, ...indexedVideos].forEach((item) => {
      const key = `${String(item?.id || '')}:${item?.mediaType === 'video' ? 'video' : 'image'}`;
      if (!item?.id || seen.has(key)) return;
      seen.add(key);
      deduped.push(item);
    });

    const media = deduped.map((item, index) => normalizeMedia(
      item,
      allowDownloads,
      item?.mediaType === 'video' ? `Video ${index + 1}` : `Fotografía ${index + 1}`,
    ));

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
