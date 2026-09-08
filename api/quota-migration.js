import { gunzipSync } from 'node:zlib';

const APPS_SCRIPT_URL = process.env.XPH_APPS_SCRIPT_URL || '';
const APPS_SCRIPT_SHARED_SECRET = process.env.XPH_APPS_SCRIPT_SHARED_SECRET || '';

function decodePayload(value) {
  const input = String(value || '').trim();
  if (!input) throw new Error('Payload faltante.');
  const padding = '='.repeat((4 - (input.length % 4)) % 4);
  const compressed = Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + padding, 'base64');
  return JSON.parse(gunzipSync(compressed).toString('utf8'));
}

function assertPreview() {
  if (process.env.VERCEL_ENV === 'production') throw new Error('Ruta de mantenimiento no disponible en producción.');
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_SHARED_SECRET) throw new Error('La vista previa no tiene las credenciales de Apps Script.');
}

function actionUrl(action) {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('apiSecret', APPS_SCRIPT_SHARED_SECRET);
  url.searchParams.set('_t', Date.now().toString());
  return url.toString();
}

async function loadConfig() {
  const response = await fetch(actionUrl('loadConfig'), { method: 'GET', redirect: 'follow', headers: { Accept: 'application/json' } });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch (_) {}
  if (!response.ok || data?.status !== 'success') throw new Error(data?.message || `loadConfig HTTP ${response.status}`);
  const config = typeof data.config === 'string' ? JSON.parse(data.config || '{}') : (data.config || {});
  return { data, config };
}

async function savePatch(patch, details) {
  const body = JSON.stringify({
    action: 'saveConfig',
    apiSecret: APPS_SCRIPT_SHARED_SECRET,
    configData: JSON.stringify(patch || {}),
    auditType: 'MIGRACION_CUOTA_PROPERTIES',
    auditDetails: details || 'Migración controlada de configuración.',
  });
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
  });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch (_) {}
  if (!response.ok || data?.status !== 'success') throw new Error(data?.message || `saveConfig HTTP ${response.status}`);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    assertPreview();
    const op = String(req.query?.op || 'ping');
    if (op === 'ping') {
      const { config } = await loadConfig();
      return res.status(200).json({ status: 'success', env: process.env.VERCEL_ENV || '', keys: Object.keys(config), galleryCount: Array.isArray(config.galleryImages) ? config.galleryImages.length : 0 });
    }
    if (op === 'patch') {
      const patch = decodePayload(req.query?.payload);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('El parche no es un objeto válido.');
      await savePatch(patch, `Parche de migración: ${Object.keys(patch).join(', ')}`);
      const { config } = await loadConfig();
      return res.status(200).json({ status: 'success', keys: Object.keys(config), galleryCount: Array.isArray(config.galleryImages) ? config.galleryImages.length : 0 });
    }
    if (op === 'resetGallery') {
      await savePatch({ galleryImages: [] }, 'Reinicio de índice de galería antes de restauración compactada.');
      return res.status(200).json({ status: 'success', galleryCount: 0 });
    }
    if (op === 'appendGallery') {
      const chunk = decodePayload(req.query?.payload);
      if (!Array.isArray(chunk)) throw new Error('El bloque de galería no es una lista válida.');
      const { config } = await loadConfig();
      const current = Array.isArray(config.galleryImages) ? config.galleryImages : [];
      const next = current.concat(chunk);
      await savePatch({ galleryImages: next }, `Restauración compactada de galería: ${current.length} + ${chunk.length}.`);
      return res.status(200).json({ status: 'success', galleryCount: next.length });
    }
    return res.status(400).json({ status: 'error', message: 'Operación no reconocida.' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: String(error?.message || error) });
  }
}
