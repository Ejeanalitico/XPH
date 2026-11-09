import assert from 'node:assert/strict';
import { listPublicDriveFolderPage } from '../api/_drive-public.js';

const input = Array.from({ length: 1417 }, (_, index) => ({
  id: `drive-file-${String(index).padStart(6, '0')}`,
  name: `DSC_${index}.jpg`,
  mimeType: 'image/jpeg',
}));
input.push({ id: 'drive-other-pdf', name: 'notes.pdf', mimeType: 'application/pdf' });

const requests = [];
const mockFetch = async (url) => {
  const address = new URL(url);
  requests.push(address);
  assert.equal(address.hostname, 'www.googleapis.com');
  assert.equal(address.searchParams.get('key'), 'test-api-key');
  assert.match(address.searchParams.get('q'), /in parents and trashed = false/);
  assert.equal(address.searchParams.get('fields'), 'nextPageToken,incompleteSearch,files(id,name,mimeType)');
  const offset = Number(address.searchParams.get('pageToken') || 0);
  const pageSize = Number(address.searchParams.get('pageSize'));
  const page = input.slice(offset, offset + pageSize);
  return {
    ok: true,
    json: async () => ({
      files: page,
      nextPageToken: offset + pageSize < input.length ? String(offset + pageSize) : '',
      incompleteSearch: false,
    }),
  };
};

let cursor = '';
const results = new Map();
do {
  const page = await listPublicDriveFolderPage({
    folderId: '1ZLda1eMixKiIe2rN0r60-OaPU0NRKVYt',
    apiKey: 'test-api-key',
    pageToken: cursor,
    pageSize: 150,
    fetchImpl: mockFetch,
  });
  assert.equal(page.provider, 'drive-api');
  assert.equal(page.shareFailures, 0);
  for (const item of page.files) results.set(item.id, item);
  cursor = page.nextPageToken;
} while (cursor);
assert.equal(results.size, 1417);
assert.equal(requests.length, 10);
assert.ok(requests.every((request) => Number(request.searchParams.get('pageSize')) <= 500));

await assert.rejects(listPublicDriveFolderPage({
  folderId: '1ZLda1eMixKiIe2rN0r60-OaPU0NRKVYt',
  apiKey: 'bad',
  fetchImpl: async () => ({ ok: false, status: 403 }),
}), /HTTP 403/);

console.log('OK: Drive API recorre 1,417 imágenes (10 páginas) sin truncarse ni duplicarlas.');
