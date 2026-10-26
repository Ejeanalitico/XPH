import { once } from 'node:events';

const API = 'https://photospicker.googleapis.com/v1/';
const MAX_PHOTO_BYTES = 100_000_000;

export function googlePhotoDownloadUrl(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !url.hostname.endsWith('.googleusercontent.com') || url.search || url.hash) {
    throw new Error('La dirección de la fotografía de Google Fotos no es válida.');
  }
  return `${url.href}=d`;
}

export async function handleGooglePhotos(req, res, body, clientId) {
  res.setHeader('Cache-Control', 'no-store');
  if (body.operation === 'config') {
    return res.status(200).json({ status: 'success', clientId });
  }
  const token = String(body.accessToken || '');
  if (!token || token.length > 4096 || /[\r\n]/.test(token)) {
    return res.status(400).json({ status: 'error', message: 'Conecta tu cuenta de Google Fotos nuevamente.' });
  }
  const headers = { Authorization: `Bearer ${token}` };
  const sessionId = encodeURIComponent(String(body.sessionId || ''));
  let path;
  let method = 'GET';
  if (body.operation === 'create') { path = 'sessions'; method = 'POST'; }
  else if (body.operation === 'session' && sessionId) path = `sessions/${sessionId}`;
  else if (body.operation === 'list' && sessionId) {
    const params = new URLSearchParams({ sessionId: String(body.sessionId), pageSize: '100' });
    if (body.pageToken) params.set('pageToken', String(body.pageToken));
    path = `mediaItems?${params}`;
  } else if (body.operation === 'delete' && sessionId) { path = `sessions/${sessionId}`; method = 'DELETE'; }
  else if (body.operation !== 'download') {
    return res.status(400).json({ status: 'error', message: 'Operación de Google Fotos no válida.' });
  }

  if (body.operation === 'download') {
    const response = await fetch(googlePhotoDownloadUrl(body.baseUrl), {
      headers, redirect: 'error', signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error('No se pudo descargar la foto. Vuelve a seleccionarla en Google Fotos.');
    const mimeType = String(response.headers.get('content-type') || '').split(';')[0];
    if (!mimeType.startsWith('image/')) throw new Error('Selecciona únicamente fotografías en Google Fotos.');
    if (Number(response.headers.get('content-length')) > MAX_PHOTO_BYTES) {
      await response.body.cancel();
      throw new Error('La fotografía supera el límite de 100 MB.');
    }
    res.setHeader('Content-Type', mimeType);
    // Stream originals; never store expiring Photos URLs or OAuth tokens in gallery records.
    let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > MAX_PHOTO_BYTES) throw new Error('La fotografía supera el límite de 100 MB.');
        if (!res.write(chunk)) await once(res, 'drain');
      }
      return res.end();
    } catch (error) {
      res.destroy(error);
      return;
    }
  }

  const response = await fetch(`${API}${path}`, {
    method, headers: { ...headers, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: '{}' } : {}), signal: AbortSignal.timeout(30_000),
  });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) {
    const message = response.status === 401 ? 'La autorización de Google Fotos venció. Conecta tu cuenta de nuevo.'
      : response.status === 403 ? 'Google Fotos no autorizó el acceso. Revisa los permisos y que Google Photos Picker API esté habilitada en el proyecto de Google Cloud.'
      : 'No se pudo consultar Google Fotos. La selección puede haber caducado; vuelve a elegir tus fotos.';
    return res.status(response.status).json({ status: 'error', message });
  }
  return res.status(200).json({ status: 'success', data });
}
