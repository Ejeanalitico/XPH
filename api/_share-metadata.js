import { escapeHtml } from './_public-config.js';

export const SITE_URL = 'https://www.xaviph.com';
export const shareImage = (kind) => `${SITE_URL}/social/${kind}.png?v=20261008`;

export function applyShareMetadata(html, { title, description, url, image, alt, privatePage = false }) {
  const replace = (matcher, value) => {
    html = matcher.test(html) ? html.replace(matcher, () => value) : html.replace('</head>', () => `${value}\n</head>`);
  };
  replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  const meta = (attribute, name, value) => replace(
    new RegExp(`<meta\\s+${attribute}=["']${name}["'][^>]*>`, 'i'),
    `<meta ${attribute}="${name}" content="${escapeHtml(value)}" />`,
  );
  meta('name', 'description', description);
  for (const [name, value] of Object.entries({ title, description, url, image, 'image:secure_url': image, 'image:type': 'image/png', 'image:width': '1200', 'image:height': '630', 'image:alt': alt, type: 'website' })) meta('property', `og:${name}`, value);
  for (const [name, value] of Object.entries({ card: 'summary_large_image', title, description, image, 'image:alt': alt })) meta('name', `twitter:${name}`, value);
  replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(url)}" />`);
  if (privatePage) meta('name', 'robots', 'noindex,nofollow,noarchive');
  return html;
}

export function galleryKind(title) {
  const normalized = String(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /maquill|peinad|makeup|beauty/.test(normalized) ? 'maquillaje' : /video/.test(normalized) && !/foto/.test(normalized) ? 'video' : 'fotos';
}
