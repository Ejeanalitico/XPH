/**
 * Paginación autenticada con API key para carpetas de Drive compartidas
 * mediante "Cualquier persona con el vínculo".
 * La clave permanece en Vercel; esta función solo recibe metadatos.
 */
export async function listPublicDriveFolderPage({
  folderId, pageToken = '', pageSize = 150, apiKey, fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error('Falta la clave de Drive para carpetas públicas.');
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(String(folderId || ''))) {
    throw new Error('ID de carpeta de Drive inválido.');
  }
  const request = new URL('https://www.googleapis.com/drive/v3/files');
  request.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
  request.searchParams.set('fields', 'nextPageToken,incompleteSearch,files(id,name,mimeType)');
  request.searchParams.set('pageSize', String(Math.min(500, Math.max(1, Math.floor(pageSize)))));
  request.searchParams.set('supportsAllDrives', 'true');
  request.searchParams.set('includeItemsFromAllDrives', 'true');
  request.searchParams.set('key', apiKey);
  if (pageToken) request.searchParams.set('pageToken', pageToken);

  // En una carpeta pública, Google admite la clave de API sin OAuth.
  const response = await fetchImpl(request.toString(), {
    method: 'GET', headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    // No devolver el cuerpo de error: podría incluir la clave en metadatos.
    throw new Error('Google Drive API no pudo consultar esta carpeta pública (HTTP ' + response.status + ').');
  }
  const data = await response.json();
  if (data.incompleteSearch) {
    throw new Error('Google Drive devolvió una lista incompleta; vuelve a intentarlo.');
  }
  const scanned = Array.isArray(data.files) ? data.files.length : 0;
  const files = (Array.isArray(data.files) ? data.files : [])
    .filter((file) => file && (String(file.mimeType || '').startsWith('image/') ||
      String(file.mimeType || '').startsWith('video/')))
    .map((file) => ({ id: String(file.id), name: String(file.name || ''), mimeType: String(file.mimeType) }))
    .filter((file) => /^[A-Za-z0-9_-]{10,}$/.test(file.id));
  return {
    status: 'success', provider: 'drive-api', files, scanned,
    nextPageToken: typeof data.nextPageToken === 'string' ? data.nextPageToken : '',
    shareFailures: 0,
  };
}

export async function listAllPublicDriveFolder({ folderId, apiKey, fetchImpl = fetch }) {
  const items = new Map();
  const tokens = new Set();
  let pageToken = '';
  for (let page = 0; page < 100; page++) {
    const result = await listPublicDriveFolderPage({
      folderId, pageToken, pageSize: 500, apiKey, fetchImpl,
    });
    for (const file of result.files) items.set(file.id, file);
    if (!result.nextPageToken) return [...items.values()];
    if (tokens.has(result.nextPageToken)) throw new Error('Drive devolvió una página repetida.');
    tokens.add(result.nextPageToken);
    pageToken = result.nextPageToken;
  }
  throw new Error('La carpeta superó las 100 páginas admitidas.');
}
