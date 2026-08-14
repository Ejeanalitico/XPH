/**
 * api/proxy.js — Vercel Serverless Proxy for Google Apps Script (ES Module)
 */

const APPS_SCRIPT_URL =
  process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzcabU0-P7RCW04G-MMFds6m4JeQKpiPl6_IaAA40KGQsp73ZsaJx6PuwbcmhBCa4Br/exec';

async function readBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function fetchConfigFromScript() {
  const response = await fetch(`${APPS_SCRIPT_URL}?action=loadConfig&_t=${Date.now()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  });
  const text = await response.text();
  return JSON.parse(text);
}

function sanitizeConfigPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const copy = JSON.parse(JSON.stringify(payload));
  if (copy.config && typeof copy.config === 'object') {
    delete copy.config.adminCredentials;
  }
  return copy;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = String(req.query?.action || '');

    // Admin credentials are checked server-side and are never returned to the browser.
    if (req.method === 'POST' && action === 'adminLogin') {
      const raw = await readBody(req);
      let submitted = {};
      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}

      const payload = await fetchConfigFromScript();
      const credentials = payload?.config?.adminCredentials || {};
      const ok =
        String(credentials.email || '').trim().toLowerCase() === String(submitted.email || '').trim().toLowerCase() &&
        String(credentials.pass || '') === String(submitted.password || '');

      return res.status(ok ? 200 : 401).json({ status: ok ? 'success' : 'error', authenticated: ok });
    }

    let scriptRes;

    if (req.method === 'POST') {
      const bodyStr = await readBody(req);
      scriptRes = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr,
        redirect: 'follow',
      });
    } else {
      const params = new URLSearchParams();
      if (req.query && typeof req.query === 'object') {
        for (const [key, value] of Object.entries(req.query)) params.set(key, String(value));
      }
      if (!params.has('_t')) params.set('_t', Date.now().toString());
      scriptRes = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
      });
    }

    const text = await scriptRes.text();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (_) { parsed = { status: 'success', raw: text }; }

    // Never expose administrative credentials from the public Vercel endpoint.
    if (req.method === 'GET' && (!action || action === 'loadConfig')) {
      parsed = sanitizeConfigPayload(parsed);
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[XPH Proxy] Error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Proxy error' });
  }
}
