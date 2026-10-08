import { readFile } from 'node:fs/promises';
import { applyShareMetadata, galleryKind, shareImage, SITE_URL } from './_share-metadata.js';

const clean = (value, max = 180) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const first = (value) => Array.isArray(value) ? value[0] : value;

async function scriptRequest(action, payload) {
  const endpoint = process.env.XPH_APPS_SCRIPT_URL;
  const secret = process.env.XPH_APPS_SCRIPT_SHARED_SECRET;
  if (!endpoint || !secret) throw new Error('Integration unavailable');
  const url = new URL(endpoint);
  const options = { redirect: 'follow', signal: AbortSignal.timeout(12000) };
  if (payload) {
    options.method = 'POST';
    options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
    options.body = JSON.stringify({ action, apiSecret: secret, payload });
  } else {
    url.searchParams.set('action', action);
    url.searchParams.set('apiSecret', secret);
  }
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok || result?.status !== 'success') throw new Error('Preview unavailable');
  return result;
}

export async function resolveShareMetadata(query) {
  const token = clean(first(query.signingToken), 200);
  const slug = clean(first(query.galeria), 300);
  const key = clean(first(query.k), 200);
  const review = clean(first(query['xph-review']), 1600);
  let kind = token ? 'contratos' : review ? 'resenas' : 'fotos';
  let title = token ? 'Contrato para firma | XPH' : review ? 'Comparte tu experiencia | XPH' : 'Galería de fotografías | XPH';
  let description = token ? 'Revisa y firma tu contrato de XPH desde tu teléfono.' : review ? 'Cuéntanos cómo fue tu experiencia con XPH Fotografía & Video.' : 'Abre tu galería de XPH Fotografía & Video.';
  let url = `${SITE_URL}/`;
  if (token) url += `firmar/${encodeURIComponent(token)}`;
  else if (review) url += `?xph-review=${encodeURIComponent(review)}`;
  else if (slug) url += `?galeria=${encodeURIComponent(slug)}&k=${encodeURIComponent(key)}`;

  // Older links can outlive their stored gallery. Their readable slug still
  // identifies the subject without disclosing anything beyond the URL itself.
  if (!token && !review && slug) {
    const label = clean(slug.replace(/-[a-z0-9]{5}$/i, '').replace(/-/g, ' '));
    if (label) {
      title = `${label.charAt(0).toUpperCase()}${label.slice(1)} | XPH`;
      kind = galleryKind(label);
      if (kind === 'maquillaje') description = 'Galería de maquillaje y peinados de XPH. Abre la liga para ver las fotografías.';
    }
  }

  try {
    if (token && /^[\w-]{20,200}$/.test(token)) {
      // Read-only: never call contractView, invalidate a token, fetch a PDF,
      // mark it viewed, or register a client's signing session for a crawler.
      const result = await scriptRequest('contractResolve', { token, markViewed: false, includePdf: false });
      const contract = result.contract;
      if (contract?.clientName) {
        title = `Contrato · ${clean(contract.clientName)} | XPH`;
        description = `Revisa y firma tu contrato${contract.eventType ? ` de ${clean(contract.eventType, 80)}` : ''} con XPH desde tu teléfono.`;
      }
    } else if (!token && !review && slug && key) {
      const result = await scriptRequest('loadConfig');
      let config = result.config;
      if (typeof config === 'string') config = JSON.parse(config);
      const items = Array.isArray(config?.galleryImages) ? config.galleryImages : [];
      const gallery = items.find((item) => item?.visibility === 'private' && item?.mediaType === 'gallery-meta' && item.gallerySlug === slug && item.galleryToken === key);
      if (gallery) {
        const name = clean(gallery.galleryTitle || gallery.title || 'Galería de fotografías');
        const client = clean(gallery.galleryClient);
        kind = galleryKind(`${name} ${client}`);
        title = `${name}${client && client !== name ? ` · ${client}` : ''} | XPH`;
        description = kind === 'maquillaje' ? 'Galería de maquillaje y peinados de XPH. Abre la liga para ver las fotografías.' : kind === 'video' ? 'Tus videos de XPH. Abre la liga para ver tu galería.' : 'Tus fotografías de XPH. Abre la liga para ver tu galería.';
      }
    }
  } catch (_) {
    // Keep the application usable if the record expired or the data service
    // is unavailable. Never expose backend errors or unvalidated client names.
  }
  return { title, description, url, image: shareImage(kind), alt: title, privatePage: true };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    res.statusCode = 405;
    return res.end();
  }
  const shell = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const metadata = await resolveShareMetadata(req.query || {});
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.statusCode = 200;
  res.end(req.method === 'HEAD' ? '' : applyShareMetadata(shell, metadata));
}
