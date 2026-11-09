import assert from 'node:assert/strict';
process.env.XPH_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/example/exec';
process.env.XPH_APPS_SCRIPT_SHARED_SECRET = 'test-only';
process.env.VITE_GOOGLE_DRIVE_API_KEY = 'test-api-key';

const total = 1417;
const fileIds = Array.from({ length: total }, (_, i) => `drive-file-${String(i).padStart(6, '0')}`);
const meta = {
  id: 'meta-gallery', galleryId: 'gallery-speedfest', gallerySlug: 'speed-fest',
  galleryToken: 'sample-private-token', galleryTitle: 'Speed Fest',
  visibility: 'private', mediaType: 'gallery-meta', galleryAllowDownloads: true,
  driveFolderId: '1ZLda1eMixKiIe2rN0r60-OaPU0NRKVYt',
  driveFolderMediaCount: 1417,
  imageIds: fileIds.slice(0, 1000).join(','),
};
const entries = fileIds.map((id, index) => ({ id, name: 'DSC_' + index + '.jpg', mimeType: 'image/jpeg' }));
let pages = 0;
globalThis.fetch = async (value) => {
  const url = new URL(value);
  if (url.hostname === 'script.google.com') {
    return { text: async () => JSON.stringify({ config: { galleryImages: [meta] } }) };
  }
  assert.equal(url.hostname, 'www.googleapis.com');
  pages++;
  const offset = Number(url.searchParams.get('pageToken') || 0);
  const pageSize = Number(url.searchParams.get('pageSize') || 100);
  const page = entries.slice(offset, offset + pageSize);
  return {
    ok: true, status: 200,
    json: async () => ({
      files: page,
      nextPageToken: offset + pageSize < entries.length ? String(offset + pageSize) : '',
    }),
  };
};
const { default: handler } = await import('../api/client-gallery.js');
const response = {
  statusCode: 0, body: null,
  setHeader() { return this; },
  status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; },
};
await handler({ method: 'GET', query: { slug: 'speed-fest', token: 'sample-private-token' } }, response);
assert.equal(response.statusCode, 200);
assert.equal(response.body.status, 'success');
assert.equal(response.body.folderListed, true);
assert.equal(response.body.media.length, total);
assert.equal(new Set(response.body.media.map((item) => item.id)).size, total);
assert.ok(pages >= 3);
console.log('OK: galería privada entrega 1,417 fotos enlazadas sin duplicar las 1,000 previas.');
