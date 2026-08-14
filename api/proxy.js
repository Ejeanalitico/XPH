/**
 * api/proxy.js — Vercel Serverless Proxy for Google Apps Script (ES Module)
 */

const APPS_SCRIPT_URL =
  process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzcabU0-P7RCW04G-MMFds6m4JeQKpiPl6_IaAA40KGQsp73ZsaJx6PuwbcmhBCa4Br/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let scriptRes;

    if (req.method === 'POST') {
      let bodyStr = '';
      if (typeof req.body === 'string') {
        bodyStr = req.body;
      } else if (req.body && typeof req.body === 'object') {
        bodyStr = JSON.stringify(req.body);
      } else {
        bodyStr = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', (chunk) => { data += chunk; });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
      }

      scriptRes = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr,
        redirect: 'follow',
      });
    } else {
      const params = new URLSearchParams();
      if (req.query && typeof req.query === 'object') {
        for (const [k, v] of Object.entries(req.query)) {
          params.set(k, String(v));
        }
      }
      if (!params.has('_t')) params.set('_t', Date.now().toString());

      scriptRes = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        redirect: 'follow',
      });
    }

    const text = await scriptRes.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      parsed = { status: 'success', raw: text };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[XPH Proxy] Error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Proxy error' });
  }
}
