/**
 * api/proxy.js — Vercel Serverless Proxy for Google Apps Script
 *
 * Browser → /api/proxy (same origin, no CORS) → Google Apps Script (server-side, no CORS restriction)
 *
 * This completely solves the CORS problem. Google Apps Script accepts requests
 * from any server-side caller because there is no browser Same-Origin Policy on Node.js.
 */

const APPS_SCRIPT_URL =
  process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzcabU0-P7RCW04G-MMFds6m4JeQKpiPl6_IaAA40KGQsp73ZsaJx6PuwbcmhBCa4Br/exec';

module.exports = async function handler(req, res) {
  // Allow cross-origin from the same Vercel deployment
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let targetUrl = APPS_SCRIPT_URL;
    let fetchOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      redirect: 'follow',
    };

    if (req.method === 'POST') {
      // Forward POST body to Apps Script
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      fetchOptions.method = 'POST';
      fetchOptions.headers['Content-Type'] = 'text/plain;charset=utf-8';
      fetchOptions.body = body;
    } else {
      // Forward query params for GET (loadConfig, listDriveFolder, etc.)
      const params = new URLSearchParams(req.query || {});
      params.set('_t', Date.now().toString());
      targetUrl = `${APPS_SCRIPT_URL}?${params.toString()}`;
    }

    const scriptResponse = await fetch(targetUrl, fetchOptions);
    const responseText = await scriptResponse.text();

    // Try to parse as JSON, forward as-is
    let parsed = null;
    try {
      parsed = JSON.parse(responseText);
    } catch (_) {
      parsed = { status: 'error', message: 'Invalid JSON from Apps Script', raw: responseText };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[XPH Proxy] Error forwarding to Apps Script:', err.message);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Proxy error',
    });
  }
};
