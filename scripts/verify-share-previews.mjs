import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyShareMetadata } from '../api/_share-metadata.js';
import handler, { resolveShareMetadata } from '../api/share-page.js';

process.env.XPH_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
process.env.XPH_APPS_SCRIPT_SHARED_SECRET = 'test';
const calls = [];
const token = 'valid-contract-token-123456789';
globalThis.fetch = async (url, options) => {
  if (options.method === 'POST') {
    const body = JSON.parse(options.body);
    calls.push(body);
    assert.equal(body.action, 'contractResolve');
    assert.deepEqual(body.payload, { token, markViewed: false, includePdf: false });
    return Response.json({ status: 'success', contract: { clientName: 'Emily <Torres> & Josué', eventType: 'Boda' } });
  }
  assert.equal(new URL(url).searchParams.get('action'), 'loadConfig');
  return Response.json({ status: 'success', config: { galleryImages: [
    { visibility: 'private', mediaType: 'gallery-meta', gallerySlug: 'novios', galleryToken: 'secret', galleryTitle: 'Fotos de boda', galleryClient: 'Brissa & Jonathan' },
    { visibility: 'private', mediaType: 'gallery-meta', gallerySlug: 'makeup', galleryToken: 'secret', galleryTitle: 'Maquillajes y peinados', galleryClient: 'XPH' },
  ] } });
};
const contract = await resolveShareMetadata({ signingToken: token });
assert.match(contract.title, /Emily/);
assert.match(contract.image, /contratos.png/);
assert.equal(calls.length, 1);
const shell = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const html = applyShareMetadata(shell, contract);
assert.match(html, /Emily &lt;Torres&gt; &amp; Josué/);
assert.match(html, /og:image:secure_url" content="https:\/\/www.xaviph.com\/social\/contratos.png/);
assert.match(html, /noindex,nofollow,noarchive/);
assert.match(html, /og:image:width" content="1200/);
assert.equal((html.match(/property="og:title"/g) || []).length, 1);
assert.match(html, /\/assets\//);
assert.equal(applyShareMetadata(shell, { ...contract, title: '$& $` $\'' }).includes('<title>$&amp; $` $&#039;</title>'), true);
const gallery = await resolveShareMetadata({ galeria: 'novios', k: 'secret' });
assert.match(gallery.title, /Brissa & Jonathan/);
assert.match(gallery.image, /fotos.png/);
const makeup = await resolveShareMetadata({ galeria: 'makeup', k: 'secret' });
assert.match(makeup.title, /Maquillajes y peinados/);
assert.match(makeup.image, /maquillaje.png/);
const wrongKey = await resolveShareMetadata({ galeria: 'novios', k: 'wrong' });
assert.doesNotMatch(wrongKey.title, /Brissa/);
const reviews = await resolveShareMetadata({ 'xph-review': 'invitation' });
assert.match(reviews.image, /resenas.png/);
globalThis.fetch = async () => { throw new Error('backend private error'); };
const unavailable = await resolveShareMetadata({ signingToken: token });
assert.equal(unavailable.title, 'Contrato para firma | XPH');
const headers = {};
let body;
await handler({ method: 'HEAD', query: { signingToken: token } }, {
  setHeader(key, value) { headers[key] = value; },
  end(value) { body = value; },
});
assert.equal(body, '');
assert.match(headers['Cache-Control'], /no-store/);
assert.match(headers['X-Robots-Tag'], /noindex/);
console.log('Share previews verified: contracts without opens, authorized galleries, icons, escaping, fallback and HEAD.');
