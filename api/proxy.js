/**
 * api/proxy.js — Vercel Serverless Proxy for Google Apps Script
 *
 * Browser → /api/proxy (same-origin, ZERO CORS issues)
 *           → Google Apps Script (server-side Node.js, no browser CORS restriction)
 *
 * This is the definitive fix for:
 *   - ERR_FAILED on POST (Google's 302 redirect blocked by browser CORS)
 *   - 400 Bad Request on GET (payload too large for URL)
 *   - loadConfig GET blocked (CORS on redirect domain)
 */

const APPS_SCRIPT_URL =
  process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzcabU0-P7RCW04G-MMFds6m4JeQKpiPl6_IaAA40KGQsp73ZsaJx6PuwbcmhBCa4Br/exec';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let response;

    if (req.method === 'POST') {
      // Get body as string
      let bodyStr = '';
      if (typeof req.body === 'string') {
        bodyStr = req.body;
      } else if (req.body && typeof req.body === 'object') {
        bodyStr = JSON.stringify(req.body);
      } else {
        // Read raw body if body-parser not active
        bodyStr = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', (chunk) => { data += chunk; });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
      }

      // Forward POST to Apps Script (no CORS restriction server-side)
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr,
        redirect: 'follow',
      });
    } else {
      // Forward GET with query params
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(req.query || {})) {
        params.set(k, String(v));
      }
      if (!params.has('_t')) params.set('_t', Date.now().toString());

      response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        redirect: 'follow',
      });
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      parsed = { status: 'error', message: 'Non-JSON response from Apps Script', raw: text.slice(0, 500) };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[XPH Proxy] Error:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
};
