/** Extrae un ID únicamente de referencias válidas de Google Drive. */
export function extractGoogleDriveFileId(urlOrId: string): string {
  const trimmed = String(urlOrId || '').trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  let host = '';
  try { host = new URL(trimmed).hostname.toLowerCase(); } catch (_) { return ''; }
  if (!host.endsWith('google.com') && !host.endsWith('googleusercontent.com')) return '';

  const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    || trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || '';
}

/** URLs alternativas para una imagen de Drive. */
export function getGoogleDriveImageCandidates(urlOrId: string): string[] {
  const trimmed = String(urlOrId || '').trim();
  if (!trimmed) return [];
  const fileId = extractGoogleDriveFileId(trimmed);
  if (!fileId) return [trimmed];
  const encoded = encodeURIComponent(fileId);
  return Array.from(new Set([
    `https://drive.google.com/thumbnail?id=${encoded}&sz=w1600`,
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=view&id=${encoded}`,
    `https://drive.usercontent.google.com/download?id=${encoded}&export=download&confirm=t`,
  ]));
}

/** Convierte IDs y enlaces de Drive en una URL pública de vista previa. */
export function getDirectGoogleDriveUrl(urlOrId: string): string {
  return getGoogleDriveImageCandidates(urlOrId)[0] || '';
}

/** Carga únicamente la configuración pública sanitizada por el proxy de Vercel. */
export async function loadSiteDataFromCloud(): Promise<Record<string, any> | null> {
  try {
    const params = new URLSearchParams({ action: 'loadConfig', _t: Date.now().toString() });
    const response = await fetch(`/api/proxy?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.status !== 'success') throw new Error(data?.message || 'No se pudo cargar la configuración.');
    const parsed = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('[XPH Cloud] No se pudo cargar la configuración pública:', error);
    return null;
  }
}
