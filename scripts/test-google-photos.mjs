import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { googlePhotoDownloadUrl, handleGooglePhotos } from '../api/_google-photos.js';
import handler from '../api/proxy.js';

function response() {
  const chunks = [];
  const res = new Writable({ write(chunk, _, done) { chunks.push(chunk); done(); } });
  res.setHeader = (key, value) => { res.headers[key.toLowerCase()] = value; };
  res.headers = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.chunks = chunks;
  return res;
}

for (const bad of ['http://lh3.googleusercontent.com/photo', 'https://evil.test/photo', 'https://googleusercontent.com.evil.test/photo', 'https://lh3.googleusercontent.com:8443/photo', 'https://user@lh3.googleusercontent.com/photo', 'https://lh3.googleusercontent.com/photo?redirect=1']) {
  assert.throws(() => googlePhotoDownloadUrl(bad));
}
assert.equal(googlePhotoDownloadUrl('https://lh3.googleusercontent.com/picked-photo'), 'https://lh3.googleusercontent.com/picked-photo=d');
const unauthenticated = response();
await handler({ method: 'POST', query: { action: 'adminGooglePhotos' }, headers: { host: 'www.xaviph.com' }, body: { operation: 'config' } }, unauthenticated);
assert.equal(unauthenticated.statusCode, 401);

const originalFetch = globalThis.fetch;
try {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ mediaItems: [], nextPageToken: 'next' }), { status: 200 });
  };
  const page = response();
  await handleGooglePhotos({}, page, { operation: 'list', accessToken: 'test-token', sessionId: 'session/1', pageToken: 'page+2' }, 'client');
  const request = new URL(calls[0].url);
  assert.equal(request.origin, 'https://photospicker.googleapis.com');
  assert.equal(request.searchParams.get('sessionId'), 'session/1');
  assert.equal(request.searchParams.get('pageToken'), 'page+2');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  assert.equal(page.body.data.nextPageToken, 'next');
  const forbidden = response();
  globalThis.fetch = async () => new Response('{}', { status: 403 });
  await handleGooglePhotos({}, forbidden, { operation: 'create', accessToken: 'test-token' }, 'client');
  assert.equal(forbidden.statusCode, 403);
  assert.match(forbidden.body.message, /Picker API/);
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
  const photo = response();
  await handleGooglePhotos({}, photo, { operation: 'download', accessToken: 'test-token', baseUrl: 'https://lh3.googleusercontent.com/photo' }, 'client');
  assert.equal(Buffer.concat(photo.chunks).length, 3);
  assert.equal(photo.headers['cache-control'], 'no-store');
  globalThis.fetch = async () => new Response('video', { headers: { 'content-type': 'video/mp4' } });
  await assert.rejects(() => handleGooglePhotos({}, response(), { operation: 'download', accessToken: 'test-token', baseUrl: 'https://lh3.googleusercontent.com/photo' }, 'client'), /fotografías/);
} finally { globalThis.fetch = originalFetch; }
console.log('Google Photos: acceso privado, URL segura, paginación, errores y descarga verificados.');
