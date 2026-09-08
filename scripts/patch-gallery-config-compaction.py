from pathlib import Path

path = Path('api/proxy.js')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    if new in text:
        print(f'{label}: already applied')
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)
    print(f'{label}: applied')

helpers = r'''function compactGalleryImagesForConfig(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || item.visibility !== 'private') return item;
    const pick = (keys) => Object.fromEntries(keys
      .filter((key) => Object.prototype.hasOwnProperty.call(item, key))
      .map((key) => [key, item[key]]));
    if (item.mediaType === 'gallery-meta') {
      return pick([
        'id', 'visibility', 'mediaType', 'galleryId', 'gallerySlug', 'galleryTitle',
        'galleryClient', 'galleryToken', 'galleryAllowDownloads', 'driveFolderId', 'createdAt',
      ]);
    }
    return pick(['id', 'visibility', 'mediaType', 'galleryId', 'galleryAllowDownloads']);
  });
}

function hydratePrivateGalleryMedia(item) {
  const clean = { ...(item || {}) };
  if (clean.visibility !== 'private' || clean.mediaType === 'gallery-meta') return clean;
  const fileId = String(clean.id || '').trim();
  if (!fileId) return clean;
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

async function compactCurrentGalleryConfig(details = 'Compactación automática de metadatos privados de galería.') {
  try {
    const payload = await fetchConfigFromScript();
    const config = normalizeConfig(payload);
    const current = Array.isArray(config.galleryImages) ? config.galleryImages : [];
    const compact = compactGalleryImagesForConfig(current);
    if (JSON.stringify(current) === JSON.stringify(compact)) return;
    await forwardSaveConfig(
      { galleryImages: compact },
      'MANTENIMIENTO_GALERIA_COMPACTADA',
      details,
    );
  } catch (error) {
    console.error('[XPH Gallery Compaction] Error:', error);
  }
}

'''
marker = 'function operationalClientRecord(item) {'
if 'function compactGalleryImagesForConfig(items)' not in text:
    if marker not in text:
        raise SystemExit('helpers marker not found')
    text = text.replace(marker, helpers + marker, 1)
    print('helpers: applied')
else:
    print('helpers: already applied')

old_forward = r'''async function forwardSaveConfig(patch, auditType, auditDetails) {
  assertIntegrationConfig();
  const body = JSON.stringify({
    action: 'saveConfig',
    apiSecret: APPS_SCRIPT_SHARED_SECRET,
    configData: JSON.stringify(patch || {}),
    auditType: auditType || 'ACTUALIZACION_ADMIN',
    auditDetails: auditDetails || 'Cambios guardados desde panel administrador',
  });'''
new_forward = r'''async function forwardSaveConfig(patch, auditType, auditDetails) {
  assertIntegrationConfig();
  const normalizedPatch = patch && typeof patch === 'object' ? { ...patch } : {};
  if (Array.isArray(normalizedPatch.galleryImages)) {
    normalizedPatch.galleryImages = compactGalleryImagesForConfig(normalizedPatch.galleryImages);
  }
  const body = JSON.stringify({
    action: 'saveConfig',
    apiSecret: APPS_SCRIPT_SHARED_SECRET,
    configData: JSON.stringify(normalizedPatch),
    auditType: auditType || 'ACTUALIZACION_ADMIN',
    auditDetails: auditDetails || 'Cambios guardados desde panel administrador',
  });'''
replace_once(old_forward, new_forward, 'forwardSaveConfig compaction')

old_map = r'''.map((item) => {
          const clean = { ...item };
          delete clean.galleryToken;
          if (meta.galleryAllowDownloads === false) delete clean.downloadUrl;
          return clean;
        });'''
new_map = r'''.map((item) => {
          const clean = hydratePrivateGalleryMedia(item);
          delete clean.galleryToken;
          if (meta.galleryAllowDownloads === false) delete clean.downloadUrl;
          return clean;
        });'''
replace_once(old_map, new_map, 'client gallery hydration')

old_create = r'''        const result = await forwardBusinessAction('galleryCreate', { clientId, title: String(submitted.title || '').slice(0, 240), galleryId, slug, accessToken: token, galleryUrl });
        return res.status(200).json({ status: 'success', gallery: result.gallery, created: Boolean(result.created) });'''
new_create = r'''        const result = await forwardBusinessAction('galleryCreate', { clientId, title: String(submitted.title || '').slice(0, 240), galleryId, slug, accessToken: token, galleryUrl });
        await compactCurrentGalleryConfig(`Galería ${galleryId} compactada después de crearla.`);
        return res.status(200).json({ status: 'success', gallery: result.gallery, created: Boolean(result.created) });'''
replace_once(old_create, new_create, 'gallery create post-compaction')

old_finalize = r'''        const result = await forwardBusinessAction('galleryUploadFinalize', { galleryId, fileId, title: String(submitted.title || '').slice(0, 180) });
        return res.status(200).json({ status: 'success', gallery: result.gallery, media: result.media });'''
new_finalize = r'''        const result = await forwardBusinessAction('galleryUploadFinalize', { galleryId, fileId, title: String(submitted.title || '').slice(0, 180) });
        await compactCurrentGalleryConfig(`Galería ${galleryId} compactada después de agregar el archivo ${fileId}.`);
        return res.status(200).json({ status: 'success', gallery: result.gallery, media: hydratePrivateGalleryMedia(result.media) });'''
replace_once(old_finalize, new_finalize, 'gallery upload post-compaction')

path.write_text(text, encoding='utf-8')
print('api/proxy.js updated')
