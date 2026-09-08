from pathlib import Path

path = Path('api/proxy.js')
text = path.read_text(encoding='utf-8')

start = text.index('function compactGalleryImagesForConfig(items) {')
end = text.index('\nasync function compactCurrentGalleryConfig', start)
old = text[start:end]
new = r'''function splitGalleryMediaIds(value) {
  return String(value || '').split(',').map((value) => value.trim()).filter(Boolean);
}

function looksLikeDriveFileId(value) {
  return /^[A-Za-z0-9_-]{20,}$/.test(String(value || ''));
}

function compactGalleryImagesForConfig(items) {
  if (!Array.isArray(items)) return [];
  const privateMetas = [];
  const metaByGallery = new Map();
  const deferredPrivateMedia = [];
  const compactPublic = [];

  const pick = (item, keys) => Object.fromEntries(keys
    .filter((key) => Object.prototype.hasOwnProperty.call(item || {}, key))
    .map((key) => [key, item[key]]));

  items.forEach((item) => {
    if (!item) return;
    if (item.visibility === 'private' && item.mediaType === 'gallery-meta') {
      const meta = pick(item, [
        'id', 'visibility', 'mediaType', 'galleryId', 'gallerySlug', 'galleryTitle',
        'galleryClient', 'galleryToken', 'galleryAllowDownloads', 'driveFolderId', 'createdAt',
        'imageIds', 'videoIds',
      ]);
      const galleryId = String(meta.galleryId || '');
      meta.imageIds = splitGalleryMediaIds(meta.imageIds).join(',');
      meta.videoIds = splitGalleryMediaIds(meta.videoIds).join(',');
      if (!meta.imageIds) delete meta.imageIds;
      if (!meta.videoIds) delete meta.videoIds;
      privateMetas.push(meta);
      if (galleryId) metaByGallery.set(galleryId, meta);
      return;
    }
    if (item.visibility === 'private') {
      deferredPrivateMedia.push(item);
      return;
    }
    if (item.mediaType === 'cover-meta' || item.mediaType === 'gallery-meta') {
      compactPublic.push(item);
      return;
    }
    if (looksLikeDriveFileId(item.id)) {
      compactPublic.push(pick(item, ['id', 'title', 'category', 'location', 'visibility', 'mediaType']));
      return;
    }
    compactPublic.push(item);
  });

  const imageIdsByGallery = new Map();
  const videoIdsByGallery = new Map();
  privateMetas.forEach((meta) => {
    const galleryId = String(meta.galleryId || '');
    imageIdsByGallery.set(galleryId, new Set(splitGalleryMediaIds(meta.imageIds)));
    videoIdsByGallery.set(galleryId, new Set(splitGalleryMediaIds(meta.videoIds)));
  });

  const orphanPrivate = [];
  deferredPrivateMedia.forEach((item) => {
    const galleryId = String(item.galleryId || '');
    const fileId = String(item.id || '');
    if (!galleryId || !fileId || !metaByGallery.has(galleryId)) {
      orphanPrivate.push(pick(item, ['id', 'visibility', 'mediaType', 'galleryId', 'galleryAllowDownloads']));
      return;
    }
    const target = item.mediaType === 'video' ? videoIdsByGallery.get(galleryId) : imageIdsByGallery.get(galleryId);
    target.add(fileId);
  });

  privateMetas.forEach((meta) => {
    const galleryId = String(meta.galleryId || '');
    const imageIds = Array.from(imageIdsByGallery.get(galleryId) || []);
    const videoIds = Array.from(videoIdsByGallery.get(galleryId) || []);
    if (imageIds.length) meta.imageIds = imageIds.join(',');
    else delete meta.imageIds;
    if (videoIds.length) meta.videoIds = videoIds.join(',');
    else delete meta.videoIds;
  });

  return [...compactPublic, ...privateMetas, ...orphanPrivate];
}

function hydrateGalleryMediaItem(item) {
  const clean = { ...(item || {}) };
  if (clean.mediaType === 'gallery-meta' || clean.mediaType === 'cover-meta') return clean;
  const fileId = String(clean.id || '').trim();
  if (!looksLikeDriveFileId(fileId)) return clean;
  const encoded = encodeURIComponent(fileId);
  const downloadUrl = `https://drive.usercontent.google.com/download?id=${encoded}&export=download&confirm=t`;
  if (clean.mediaType === 'video') {
    const previewUrl = `https://drive.google.com/file/d/${encoded}/preview`;
    clean.url = clean.url || previewUrl;
    clean.previewUrl = clean.previewUrl || previewUrl;
    clean.downloadUrl = clean.downloadUrl || downloadUrl;
    return clean;
  }
  const previewUrl = `https://lh3.googleusercontent.com/d/${encoded}`;
  clean.url = clean.url || previewUrl;
  clean.previewUrl = clean.previewUrl || previewUrl;
  clean.downloadUrl = clean.downloadUrl || downloadUrl;
  return clean;
}

function hydratePrivateGalleryMedia(item) {
  return hydrateGalleryMediaItem(item);
}

function indexedPrivateGalleryMedia(meta) {
  const galleryId = String(meta?.galleryId || '');
  const shared = {
    visibility: 'private',
    galleryId,
    galleryAllowDownloads: meta?.galleryAllowDownloads,
  };
  return [
    ...splitGalleryMediaIds(meta?.imageIds).map((id) => hydrateGalleryMediaItem({ ...shared, id, mediaType: 'image' })),
    ...splitGalleryMediaIds(meta?.videoIds).map((id) => hydrateGalleryMediaItem({ ...shared, id, mediaType: 'video' })),
  ];
}
'''
text = text[:start] + new + text[end:]

old_public = '''    copy.config.galleryImages = publicGalleryOnly(allGalleryItems, copy.config.promotionPopup);'''
new_public = '''    copy.config.galleryImages = publicGalleryOnly(allGalleryItems.map(hydrateGalleryMediaItem), copy.config.promotionPopup);'''
if old_public not in text:
    raise SystemExit('public gallery hydration marker not found')
text = text.replace(old_public, new_public, 1)

old_admin = '''  const allGalleryItems = Array.isArray(copy.galleryImages) ? copy.galleryImages : [];
  copy.heroCovers = heroCoverMap(allGalleryItems);'''
new_admin = '''  const allGalleryItems = Array.isArray(copy.galleryImages) ? copy.galleryImages : [];
  copy.galleryImages = allGalleryItems.map(hydrateGalleryMediaItem);
  copy.heroCovers = heroCoverMap(allGalleryItems);'''
if old_admin not in text:
    raise SystemExit('admin gallery hydration marker not found')
text = text.replace(old_admin, new_admin, 1)

old_client = '''      const media = items
        .filter((item) => item?.visibility === 'private' && item?.galleryId === meta.galleryId && item?.mediaType !== 'gallery-meta')
        .map((item) => {
          const clean = hydratePrivateGalleryMedia(item);
          delete clean.galleryToken;
          if (meta.galleryAllowDownloads === false) delete clean.downloadUrl;
          return clean;
        });'''
new_client = '''      const inlineMedia = items
        .filter((item) => item?.visibility === 'private' && item?.galleryId === meta.galleryId && item?.mediaType !== 'gallery-meta');
      const mediaById = new Map();
      [...indexedPrivateGalleryMedia(meta), ...inlineMedia.map(hydratePrivateGalleryMedia)].forEach((item) => {
        if (!item?.id) return;
        const clean = { ...item };
        delete clean.galleryToken;
        if (meta.galleryAllowDownloads === false) delete clean.downloadUrl;
        mediaById.set(String(clean.id), clean);
      });
      const media = Array.from(mediaById.values());'''
if old_client not in text:
    raise SystemExit('client gallery marker not found')
text = text.replace(old_client, new_client, 1)

path.write_text(text, encoding='utf-8')
print('api/proxy.js compact gallery index storage applied')
