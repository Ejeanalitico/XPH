import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SITE_URL = 'https://www.xaviph.com';
const OUTPUT_DIR = resolve('dist');

const routes = {
  bodas: {
    title: 'Fotógrafo de Bodas en CDMX | Foto y Video XPH',
    description: 'Fotografía y video para bodas en CDMX y zona centro. Cobertura civil y completa, sesión previa, video y entrega digital. Revisa paquetes XPH.',
    service: 'Fotografía y video para bodas',
    heading: 'Fotografía y video para bodas en CDMX',
  },
  'xv-anos': {
    title: 'Fotografía y Video para XV Años en CDMX | XPH',
    description: 'Paquetes de fotografía y video para XV años en CDMX: sesión previa, ceremonia, vals, fiesta y entregables digitales. Cotiza con XPH.',
    service: 'Fotografía y video para XV años',
    heading: 'Fotografía y video para XV años en CDMX',
  },
  bautizos: {
    title: 'Fotografía de Bautizos y Familia en CDMX | XPH',
    description: 'Fotografía y video para bautizos y celebraciones familiares en CDMX, Estado de México y zona centro. Solicita una propuesta personalizada.',
    service: 'Fotografía de bautizos y eventos familiares',
    heading: 'Fotografía de bautizos y familia en CDMX',
  },
  retratos: {
    title: 'Fotografía de Retrato y Sesiones en CDMX | XPH',
    description: 'Sesiones de retrato en CDMX para personas, parejas, graduaciones y proyectos editoriales. Fotografía profesional con propuesta personalizada.',
    service: 'Fotografía de retrato y sesiones',
    heading: 'Sesiones de retrato profesional en CDMX',
  },
  empresarial: {
    title: 'Fotografía y Video Empresarial en CDMX | XPH',
    description: 'Fotografía corporativa, headshots, branding y video para empresas en CDMX. Contenido visual profesional para marcas, equipos y eventos.',
    service: 'Fotografía y video empresarial',
    heading: 'Fotografía y video empresarial en CDMX',
  },
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const replaceMeta = (html, matcher, replacement) => {
  if (!matcher.test(html)) throw new Error(`No se encontró la etiqueta requerida: ${matcher}`);
  return html.replace(matcher, replacement);
};

const template = await readFile(resolve(OUTPUT_DIR, 'index.html'), 'utf8');

for (const [route, metadata] of Object.entries(routes)) {
  const canonicalUrl = `${SITE_URL}/${route}`;
  let html = template;
  html = replaceMeta(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(metadata.title)}</title>`);
  html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(metadata.description)}" />`);
  html = replaceMeta(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`);
  html = replaceMeta(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`);
  html = replaceMeta(html, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${canonicalUrl}" />`);
  html = replaceMeta(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`);
  html = replaceMeta(html, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`);
  html = replaceMeta(html, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${canonicalUrl}" />`);

  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: metadata.service,
    description: metadata.description,
    url: canonicalUrl,
    areaServed: ['Ciudad de México', 'Estado de México', 'Morelos', 'Puebla', 'Querétaro', 'Tlaxcala', 'Pachuca'],
    provider: { '@type': 'ProfessionalService', name: 'XPH Fotografía & Video', url: SITE_URL, telephone: '+52 56 1556 7863' },
  }).replaceAll('<', '\\u003c');
  html = html.replace('</head>', `    <script id="xph-prerendered-service" type="application/ld+json">${structuredData}</script>\n  </head>`);
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root"></div><noscript><main><h1>${escapeHtml(metadata.heading)}</h1><p>${escapeHtml(metadata.description)}</p><p><a href="/">Conoce todos los servicios de XPH Fotografía &amp; Video</a></p></main></noscript>`,
  );

  const routeDirectory = resolve(OUTPUT_DIR, route);
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(resolve(routeDirectory, 'index.html'), html, 'utf8');
}

console.log(`Prerender SEO generado para ${Object.keys(routes).length} rutas.`);
