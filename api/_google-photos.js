import { once } from 'node:events';
import { readSharedAlbum } from './_google-photos-shared.js';

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
  if (body.operation === 'sharedAlbum') {
    return res.status(200).json({ status: 'success', data: await readSharedAlbum(body.albumUrl, body.pageToken) });
  }
  if (body.operation === 'downloadShared') {
    const response = await fetch(googlePhotoDownloadUrl(body.baseUrl), {
      redirect: 'error', signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error('No se pudo descargar la foto. Vuelve a seleccionarla en Google Fotos.');
    const mimeType = String(response.headers.get('content-type') || '').split(';')[0];
    if (!mimeType.startsWith('image/')) throw new Error('Selecciona únicamente fotografías en Google Fotos.');
    if (Number(response.headers.get('content-length')) > MAX_PHOTO_BYTES) {
      await response.body.cancel();
      throw new Error('La fotografía supera el límite de 100 MB.');
    }
    res.setHeader('Content-Type', mimeType);
    // Store a managed copy instead of persisting a temporary Google Photos URL.
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

  return res.status(400).json({ status: 'error', message: 'Operación de Google Fotos no válida.' });
}
