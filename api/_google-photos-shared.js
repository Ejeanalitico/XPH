// Shared albums are read from Google's public web representation, not the Picker API.
// Parse data as JSON only; never execute scripts returned by the shared page.
export function sharedAlbumUrl(value) {
  const url = new URL(String(value || '').trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !(url.hostname === 'photos.app.goo.gl' && /^\/[A-Za-z0-9_-]+$/.test(url.pathname) ||
        url.hostname === 'photos.google.com' && /^\/share\/[A-Za-z0-9_-]+\/?$/.test(url.pathname))) {
    throw new Error('Pega una liga compartida de Google Fotos (photos.app.goo.gl o photos.google.com/share).');
  }
  url.hash = '';
  return url;
}

async function readText(response, limit = 8_000_000) {
  if (!response.ok) throw new Error('Google Fotos no permitió leer el álbum. Comprueba que la liga siga compartida.');
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('La respuesta del álbum es demasiado grande.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function parseSharedAlbumHtml(html) {
  const matches = html.matchAll(/AF_initDataCallback\(\{key:\s*['"]ds:\d+['"][\s\S]*?\bdata:([\s\S]*?),\s*sideChannel:/g);
  for (const match of matches) {
    let data;
    try { data = JSON.parse(match[1]); } catch { continue; }
    if (Array.isArray(data?.[1]) && Array.isArray(data?.[3]) && typeof data[3][0] === 'string' && data[3][0].startsWith('AF1')) return data;
  }
  throw new Error('No se pudo leer el álbum compartido. La liga debe abrir sin iniciar sesión. Google puede haber cambiado el formato de la página.');
}

export function parseSharedAlbumPage(text) {
  const start = text.indexOf('\n');
  const frames = text.slice(start + 1).split('\n').filter((line) => line.startsWith('['));
  for (const frame of frames) {
    let batch;
    try { batch = JSON.parse(frame); } catch { continue; }
    const result = batch.find((entry) => entry[0] === 'wrb.fr' && entry[1] === 'snAcKc');
    if (typeof result?.[2] === 'string') return JSON.parse(result[2]);
  }
  throw new Error('Google Fotos no devolvió el siguiente bloque. No se importó un álbum incompleto.');
}

function normalizePage(data) {
  if (!Array.isArray(data?.[1])) throw new Error('Google Fotos devolvió un bloque de fotos no válido.');
  const photos = data[1].filter((row) => typeof row?.[0] === 'string' &&
    typeof row?.[1]?.[0] === 'string' && row[1][0].startsWith('https://lh3.googleusercontent.com/'))
    .map((row) => ({ id: row[0], type: 'PHOTO', mediaFile: {
      baseUrl: row[1][0], mimeType: 'image/jpeg', filename: `Google Fotos ${row[0].slice(-12)}.jpg`,
    } }));
  return { photos, nextPageToken: typeof data[2] === 'string' ? data[2] : '' };
}

export async function readSharedAlbum(input, pageToken = '') {
  let url = sharedAlbumUrl(input);
  // Follow only validated Google Photos destinations, without cookies or login.
  let response;
  for (let hop = 0; hop < 5; hop++) {
    response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25_000) });
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error('La liga compartida no tiene un destino válido.');
    url = sharedAlbumUrl(new URL(location, url).href);
    response = undefined;
  }
  if (!response || url.hostname !== 'photos.google.com') throw new Error('No se pudo resolver la liga de Google Fotos.');
  const albumId = url.pathname.split('/')[2];
  if (pageToken) {
    await response.body?.cancel();
    if (String(pageToken).length > 4096) throw new Error('El bloque solicitado no es válido.');
    const rpc = new URL('https://photos.google.com/_/PhotosUi/data/batchexecute');
    rpc.searchParams.set('rpcids', 'snAcKc');
    rpc.searchParams.set('source-path', url.pathname);
    const payload = [[['snAcKc', JSON.stringify([albumId, pageToken, null, url.searchParams.get('key')]), null, 'generic']]];
    const next = await fetch(rpc, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ 'f.req': JSON.stringify(payload) }),
    });
    return { ...normalizePage(parseSharedAlbumPage(await readText(next))), albumUrl: url.href };
  }
  const data = parseSharedAlbumHtml(await readText(response));
  return { ...normalizePage(data), title: String(data[3][1] || 'Álbum de Google Fotos'), albumUrl: url.href };
}
