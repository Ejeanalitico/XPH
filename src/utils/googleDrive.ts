/** Convierte IDs y enlaces de Drive en una URL pública de vista previa. */
export function getDirectGoogleDriveUrl(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  if (trimmed.includes('googleusercontent.com') || trimmed.startsWith('data:image/') || trimmed.startsWith('http')) {
    const fileIdMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch?.[1]) return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    return trimmed;
  }
  const cleanId = trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
  return `https://lh3.googleusercontent.com/d/${cleanId}`;
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
