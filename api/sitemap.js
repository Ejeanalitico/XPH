import { escapeHtml, loadPublicConfig, slugify } from './_public-config.js';

const SITE_URL = 'https://www.xaviph.com';
const DEFAULT_CATEGORIES = ['bodas', 'xv-anos', 'bautizos', 'retratos', 'empresarial'];

const isoDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
};

const sitemapXml = (entries) => {
  const urls = [...entries.values()].map((entry) => `  <url>\n    <loc>${escapeHtml(`${SITE_URL}${entry.path}`)}</loc>\n    <lastmod>${isoDate(entry.updatedAt)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
};

const defaultEntries = () => new Map([
  ['/', { path: '/', updatedAt: '', priority: '1.0' }],
  ...DEFAULT_CATEGORIES.map((slug) => [`/${slug}`, { path: `/${slug}`, updatedAt: '', priority: '0.9' }]),
]);

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  try {
    const { config, updatedAt } = await loadPublicConfig();
    const configured = Array.isArray(config.catalogCategories) ? config.catalogCategories : [];
    const categories = configured.length
      ? configured
      : DEFAULT_CATEGORIES.map((id, index) => ({ id, slug: id, active: true, order: index + 1 }));
    const entries = new Map([['/', { path: '/', updatedAt, priority: '1.0' }]]);

    categories
      .filter((category) => category?.active !== false)
      .sort((left, right) => (Number(left?.order) || 0) - (Number(right?.order) || 0))
      .forEach((category) => {
        const id = String(category?.id || '');
        const slug = slugify(category?.slug || category?.name || id);
        const seo = config.seoSettings?.[id] || config.seoSettings?.[slug] || {};
        if (!slug || seo.indexed === false) return;
        entries.set(`/${slug}`, {
          path: `/${slug}`,
          updatedAt: category?.updatedAt || updatedAt,
          priority: DEFAULT_CATEGORIES.includes(id) ? '0.9' : '0.8',
        });
      });

    const xml = sitemapXml(entries);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    if (req.method === 'HEAD') res.end();
    else res.end(xml);
  } catch (error) {
    const xml = sitemapXml(defaultEntries());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=3600');
    res.setHeader('X-XPH-Sitemap-Fallback', '1');
    if (req.method === 'HEAD') res.end();
    else res.end(xml);
  }
}
