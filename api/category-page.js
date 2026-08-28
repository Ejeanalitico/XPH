import { readFile } from 'node:fs/promises';
import { escapeHtml, loadPublicConfig, safeJson, slugify } from './_public-config.js';

const SITE_URL = 'https://www.xaviph.com';
const INDEX_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex,nofollow,noarchive';

const defaultDescription = (category) =>
  `Conoce los paquetes de ${category.name} de XPH en CDMX, Estado de México y zona centro. Compara opciones y solicita disponibilidad.`;

function replaceTag(html, matcher, replacement) {
  return matcher.test(html) ? html.replace(matcher, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function requestOrigin(req) {
  const forwardedHost = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const hostname = forwardedHost.replace(/:\d+$/, '').toLowerCase();
  const trustedHost = hostname === 'xaviph.com'
    || hostname === 'www.xaviph.com'
    || hostname.endsWith('.vercel.app')
    || hostname === 'localhost'
    || hostname === '127.0.0.1';
  if (trustedHost && /^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost) && /^(https?|http)$/i.test(forwardedProto)) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return SITE_URL;
}

async function loadShell(req) {
  try {
    return await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  } catch (_) {
    const shellResponse = await fetch(`${requestOrigin(req)}/`, {
      headers: { Accept: 'text/html', 'User-Agent': 'XPH-Category-Renderer/1.0' },
      redirect: 'follow',
    });
    if (!shellResponse.ok) throw new Error(`No se pudo cargar la plantilla pública (HTTP ${shellResponse.status}).`);
    return shellResponse.text();
  }
}

function notFound(res, slug) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', NOINDEX_ROBOTS);
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.end(`<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="robots" content="${NOINDEX_ROBOTS}"><title>Página no encontrada | XPH</title></head><body><main><h1>Página no encontrada</h1><p>La categoría ${escapeHtml(slug)} no está disponible.</p><a href="/">Volver al inicio</a></main></body></html>`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  try {
    const slug = slugify(Array.isArray(req.query?.slug) ? req.query.slug[0] : req.query?.slug);
    if (!slug) {
      notFound(res, '');
      return;
    }

    const { config } = await loadPublicConfig();
    const categories = Array.isArray(config.catalogCategories) ? config.catalogCategories : [];
    const category = categories.find((item) =>
      item?.active !== false && slugify(item?.slug || item?.name || item?.id) === slug);
    if (!category) {
      notFound(res, slug);
      return;
    }

    const categoryId = String(category.id || slug);
    const categoryName = String(category.name || slug).trim();
    const seo = config.seoSettings?.[categoryId] || config.seoSettings?.[slug] || {};
    const title = String(seo.title || `${categoryName} en CDMX | XPH Fotografía & Video`).trim().slice(0, 120);
    const description = String(seo.description || category.description || defaultDescription({ name: categoryName })).trim().slice(0, 320);
    const indexed = seo.indexed !== false;
    const robots = indexed ? INDEX_ROBOTS : NOINDEX_ROBOTS;
    const canonicalUrl = `${SITE_URL}/${slug}`;
    const heroSetting = config.heroCoverSettings?.[categoryId] || {};
    const imageUrl = String(heroSetting.url || category.imageUrl || `${SITE_URL}/xph-logo.png`).trim();
    const packages = Array.isArray(config.packages?.[categoryId]) ? config.packages[categoryId] : [];

    let html = await loadShell(req);

    html = replaceTag(html, /<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    html = replaceTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
    html = replaceTag(html, /<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${robots}" />`);
    html = replaceTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    html = replaceTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
    html = replaceTag(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonicalUrl}" />`);
    html = replaceTag(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`);
    html = replaceTag(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
    html = replaceTag(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
    html = replaceTag(html, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`);
    html = replaceTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonicalUrl}" />`);

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: categoryName,
      description,
      url: canonicalUrl,
      image: imageUrl,
      areaServed: ['Ciudad de México', 'Estado de México', 'Morelos', 'Puebla', 'Querétaro', 'Tlaxcala', 'Pachuca'],
      provider: {
        '@type': 'ProfessionalService',
        name: 'XPH Fotografía & Video',
        url: SITE_URL,
        telephone: '+52 56 1556 7863',
      },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: `Paquetes de ${categoryName}`,
        itemListElement: packages.map((item) => ({
          '@type': 'Offer',
          priceCurrency: 'MXN',
          price: Number(item?.price) || undefined,
          itemOffered: {
            '@type': 'Service',
            name: String(item?.name || 'Paquete XPH'),
            description: String(item?.description || ''),
          },
        })),
      },
    };
    html = html.replace('</head>', `    <script id="xph-dynamic-category" type="application/ld+json">${safeJson(structuredData)}</script>\n  </head>`);

    const packageMarkup = packages.map((item) =>
      `<li><strong>${escapeHtml(item?.name || 'Paquete XPH')}</strong>${item?.description ? ` — ${escapeHtml(item.description)}` : ''}</li>`).join('');
    const noscript = `<noscript><main><h1>${escapeHtml(categoryName)}</h1><p>${escapeHtml(description)}</p>${packageMarkup ? `<h2>Paquetes disponibles</h2><ul>${packageMarkup}</ul>` : ''}<p><a href="/">Conoce todos los servicios de XPH Fotografía &amp; Video</a></p></main></noscript>`;
    html = html.replace('<div id="root"></div>', `<div id="root"></div>${noscript}`);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', robots);
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
    if (req.method === 'HEAD') res.end();
    else res.end(html);
  } catch (error) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', NOINDEX_ROBOTS);
    res.setHeader('Cache-Control', 'no-store');
    res.end(`<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="robots" content="${NOINDEX_ROBOTS}"><title>Servicio temporalmente no disponible | XPH</title></head><body><main><h1>Servicio temporalmente no disponible</h1><p>${escapeHtml(error?.message || 'Intenta nuevamente.')}</p><a href="/">Volver al inicio</a></main></body></html>`);
  }
}
