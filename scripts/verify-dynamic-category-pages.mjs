import assert from 'node:assert/strict';

process.env.XPH_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
process.env.XPH_APPS_SCRIPT_SHARED_SECRET = 'test-secret';

const sampleConfig = {
  catalogCategories: [
    { id: 'bodas', name: 'Bodas', slug: 'bodas', active: true, order: 1 },
    { id: 'category-makeup', name: 'Maquillaje & Peinado', slug: 'makeup', description: 'Maquillaje y peinado profesional.', imageUrl: 'https://example.com/makeup.jpg', active: true, order: 2 },
    { id: 'hidden', name: 'Oculta', slug: 'oculta', active: false, order: 3 },
  ],
  packages: {
    'category-makeup': [
      { id: 'glam', name: 'Social Glam', price: 2500, description: 'Maquillaje social.', features: ['Maquillaje', 'Peinado'] },
    ],
  },
  seoSettings: {
    'category-makeup': { title: 'Maquillaje y Peinado en CDMX | XPH', description: 'Servicio profesional de maquillaje y peinado.', indexed: true },
  },
};

const shell = `<!doctype html><html lang="es-MX"><head>
<title>Inicio</title>
<meta name="description" content="Inicio" />
<meta name="robots" content="index,follow" />
<meta property="og:title" content="Inicio" />
<meta property="og:description" content="Inicio" />
<meta property="og:url" content="https://www.xaviph.com/" />
<meta property="og:image" content="https://www.xaviph.com/xph-logo.png" />
<meta name="twitter:title" content="Inicio" />
<meta name="twitter:description" content="Inicio" />
<meta name="twitter:image" content="https://www.xaviph.com/xph-logo.png" />
<link rel="canonical" href="https://www.xaviph.com/" />
</head><body><div id="root"></div></body></html>`;

globalThis.fetch = async (url) => {
  const value = String(url);
  if (value.includes('action=loadConfig')) {
    return new Response(JSON.stringify({ status: 'success', config: sampleConfig, updatedAt: '2026-08-28T00:00:00.000Z' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (value === 'https://www.xaviph.com/') {
    return new Response(shell, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
  throw new Error(`Solicitud no esperada: ${value}`);
};

const { default: categoryPage } = await import('../api/category-page.js');
const { default: sitemap } = await import('../api/sitemap.js');

const invoke = async (handler, query = {}) => {
  const headers = new Map();
  let body = '';
  const req = { method: 'GET', query, headers: { host: 'www.xaviph.com', 'x-forwarded-proto': 'https' } };
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    end(value = '') { body += String(value); },
  };
  await handler(req, res);
  return { statusCode: res.statusCode, headers, body };
};

const page = await invoke(categoryPage, { slug: 'makeup' });
assert.equal(page.statusCode, 200);
assert.match(page.body, /<title>Maquillaje y Peinado en CDMX \| XPH<\/title>/);
assert.match(page.body, /<link rel="canonical" href="https:\/\/www\.xaviph\.com\/makeup"/);
assert.match(page.body, /Social Glam/);
assert.match(page.body, /Maquillaje &amp; Peinado/);
assert.equal(page.headers.get('x-robots-tag'), 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');

const missing = await invoke(categoryPage, { slug: 'categoria-inexistente' });
assert.equal(missing.statusCode, 404);
assert.match(missing.headers.get('x-robots-tag'), /^noindex/);

const sitemapResponse = await invoke(sitemap);
assert.equal(sitemapResponse.statusCode, 200);
assert.match(sitemapResponse.body, /https:\/\/www\.xaviph\.com\/makeup/);
assert.doesNotMatch(sitemapResponse.body, /https:\/\/www\.xaviph\.com\/oculta/);
assert.equal((sitemapResponse.body.match(/\/makeup<\/loc>/g) || []).length, 1);

console.log('Páginas dinámicas, metadatos, 404 y sitemap verificados.');

