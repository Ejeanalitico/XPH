import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { googlePhotoDownloadUrl, handleGooglePhotos } from '../api/_google-photos.js';
import { sharedAlbumUrl, parseSharedAlbumHtml, parseSharedAlbumPage, readSharedAlbum } from '../api/_google-photos-shared.js';
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
for (const bad of ['http://lh3.googleusercontent.com/photo', 'https://evil.test/photo', 'https://googleusercontent.com.evil.test/photo', 'https://lh3.googleusercontent.com:8443/photo', 'https://user@lh3.googleusercontent.com/photo', 'https://lh3.googleusercontent.com/photo?redirect=1']) assert.throws(() => googlePhotoDownloadUrl(bad));
for (const bad of ['https://evil.test', 'https://photos.google.com.evil.test/share/abc', 'http://photos.app.goo.gl/abc', 'https://photos.google.com/private/abc', 'https://user@photos.app.goo.gl/abc', 'https://photos.google.com:8443/share/abc']) assert.throws(() => sharedAlbumUrl(bad));
assert.equal(sharedAlbumUrl('https://photos.app.goo.gl/abc').hostname, 'photos.app.goo.gl');
const data = [null, [['photo1', ['https://lh3.googleusercontent.com/pw/photo1', 100, 100]]], 'page2', ['AF1Album', 'Sample album']];
const html = `AF_initDataCallback({key: 'ds:1', hash: '2', data:${JSON.stringify(data)}, sideChannel: {}});`;
assert.deepEqual(parseSharedAlbumHtml(html), data);
assert.throws(() => parseSharedAlbumHtml('<html>Sign in</html>'), /sin iniciar sesión/);
const nextData = [null, [['photo2', ['https://lh3.googleusercontent.com/pw/photo2']]], null];
const rpc = ")]}'\n\n" + JSON.stringify([['wrb.fr', 'snAcKc', JSON.stringify(nextData)]]);
assert.deepEqual(parseSharedAlbumPage(rpc), nextData);
assert.throws(() => parseSharedAlbumPage(")]}'\n[[\"wrb.fr\",\"snAcKc\",null]]"), /incompleto/);
const unauthenticated = response();
await handler({ method: 'POST', query: { action: 'adminGooglePhotos' }, headers: { host: 'www.xaviph.com' }, body: { operation: 'sharedAlbum' } }, unauthenticated);
assert.equal(unauthenticated.statusCode, 401);
const originalFetch = globalThis.fetch;
try {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith('https://photos.app.goo.gl/')) return new Response('', { status: 302, headers: { location: 'https://photos.google.com/share/AF1Album?key=sharedKey' } });
    if (String(url).includes('batchexecute')) return new Response(rpc);
    return new Response(html);
  };
  const first = await readSharedAlbum('https://photos.app.goo.gl/abc');
  assert.equal(first.photos.length, 1);
  assert.equal(first.nextPageToken, 'page2');
  const second = await readSharedAlbum(first.albumUrl, first.nextPageToken);
  assert.equal(second.photos[0].id, 'photo2');
  assert.equal(second.nextPageToken, '');
  const request = calls.find(x => x.url.includes('batchexecute'));
  const payload = JSON.parse(request.options.body.get('f.req'));
  assert.deepEqual(JSON.parse(payload[0][0][1]), ['AF1Album', 'page2', null, 'sharedKey']);
  assert.equal(request.options.headers.Authorization, undefined);
  globalThis.fetch = async () => new Response('', { status: 302, headers: { location: 'https://evil.test/' } });
  await assert.rejects(() => readSharedAlbum('https://photos.app.goo.gl/abc'), /liga compartida/);
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
  const photo = response();
  await handleGooglePhotos({}, photo, { operation: 'downloadShared', baseUrl: 'https://lh3.googleusercontent.com/photo' });
  assert.equal(Buffer.concat(photo.chunks).length, 3);
  assert.equal(photo.headers['cache-control'], 'no-store');
  globalThis.fetch = async () => new Response('video', { headers: { 'content-type': 'video/mp4' } });
  await assert.rejects(() => handleGooglePhotos({}, response(), { operation: 'downloadShared', baseUrl: 'https://lh3.googleusercontent.com/photo' }), /fotografías/);
} finally { globalThis.fetch = originalFetch; }
console.log('Google Fotos por liga: acceso privado, redirecciones seguras, lectura JSON, paginación completa, fallos y descarga verificados.');
