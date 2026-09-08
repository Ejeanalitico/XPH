from pathlib import Path

path = Path('api/proxy.js')
text = path.read_text(encoding='utf-8')

old_indexed = '''function indexedPrivateGalleryMedia(meta) {
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

new_indexed = '''function indexedPrivateGalleryMedia(meta) {
  const galleryId = String(meta?.galleryId || '');
  const shared = {
    visibility: 'private',
    galleryId,
    galleryAllowDownloads: meta?.galleryAllowDownloads,
  };
  const images = splitGalleryMediaIds(meta?.imageIds);
  const videos = splitGalleryMediaIds(meta?.videoIds);
  return [
    ...images.map((id, index) => hydrateGalleryMediaItem({ ...shared, id, title: `Fotografía ${index + 1}`, mediaType: 'image' })),
    ...videos.map((id, index) => hydrateGalleryMediaItem({ ...shared, id, title: `Video ${index + 1}`, mediaType: 'video' })),
  ];
}
'''

if old_indexed in text:
    text = text.replace(old_indexed, new_indexed, 1)
elif new_indexed not in text:
    raise SystemExit('No se encontró indexedPrivateGalleryMedia.')

old_admin = '''function sanitizeAdminConfig(config) {
  const copy = JSON.parse(JSON.stringify(config || {}));
  const allGalleryItems = Array.isArray(copy.galleryImages) ? copy.galleryImages : [];
  copy.galleryImages = allGalleryItems.map(hydrateGalleryMediaItem);
  copy.heroCovers = heroCoverMap(allGalleryItems);
  copy.heroCoverSettings = heroCoverSettingsMap(allGalleryItems);
  copy.promotionPopup = copy.promotionPopup && typeof copy.promotionPopup === 'object'
    ? copy.promotionPopup
    : promotionPopupFromGallery(allGalleryItems);
  delete copy.adminCredentials;
  delete copy.quotes;
  return copy;
}
'''

new_admin = '''function sanitizeAdminConfig(config) {
  const copy = JSON.parse(JSON.stringify(config || {}));
  const allGalleryItems = Array.isArray(copy.galleryImages) ? copy.galleryImages : [];
  const hydrated = allGalleryItems.map(hydrateGalleryMediaItem);
  const existingKeys = new Set(hydrated.map((item) => `${String(item?.galleryId || '')}:${String(item?.id || '')}:${String(item?.mediaType || '')}`));
  const indexed = allGalleryItems
    .filter((item) => item?.visibility === 'private' && item?.mediaType === 'gallery-meta')
    .flatMap((meta) => indexedPrivateGalleryMedia(meta))
    .filter((item) => {
      const key = `${String(item?.galleryId || '')}:${String(item?.id || '')}:${String(item?.mediaType || '')}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
  copy.galleryImages = [...hydrated, ...indexed];
  copy.heroCovers = heroCoverMap(allGalleryItems);
  copy.heroCoverSettings = heroCoverSettingsMap(allGalleryItems);
  copy.promotionPopup = copy.promotionPopup && typeof copy.promotionPopup === 'object'
    ? copy.promotionPopup
    : promotionPopupFromGallery(allGalleryItems);
  delete copy.adminCredentials;
  delete copy.quotes;
  return copy;
}
'''

if old_admin in text:
    text = text.replace(old_admin, new_admin, 1)
elif new_admin not in text:
    raise SystemExit('No se encontró sanitizeAdminConfig.')

path.write_text(text, encoding='utf-8')
print('Hidratación de galerías privadas para administrador reparada.')
