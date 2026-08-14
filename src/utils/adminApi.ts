import { GalleryImage } from '../types';

export type AdminSession = {
  email: string;
  password: string;
};

async function parseResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === 'error') {
    throw new Error(data?.message || `Solicitud fallida (${res.status})`);
  }
  return data;
}

export async function adminLogin(email: string, password: string): Promise<AdminSession> {
  const res = await fetch('/api/proxy?action=adminLogin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseResponse(res);
  if (!data.authenticated) throw new Error('Credenciales incorrectas.');
  return { email, password };
}

export async function loadAdminConfig(session: AdminSession): Promise<Record<string, any>> {
  const res = await fetch('/api/proxy?action=adminConfig', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
  const data = await parseResponse(res);
  return data.config || {};
}

export async function saveAdminConfig(
  session: AdminSession,
  patch: Record<string, any>,
  auditType = 'ACTUALIZACION_ADMIN',
  auditDetails = 'Cambios guardados desde el panel administrador'
): Promise<void> {
  const res = await fetch('/api/proxy?action=adminSaveConfig', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...session,
      patch,
      auditType,
      auditDetails,
    }),
  });
  await parseResponse(res);
}

export async function fetchClientGallery(slug: string, token: string): Promise<{
  title: string;
  clientName: string;
  media: GalleryImage[];
}> {
  const params = new URLSearchParams({ action: 'clientGallery', slug, token, _t: Date.now().toString() });
  const res = await fetch(`/api/proxy?${params.toString()}`, { cache: 'no-store' });
  const data = await parseResponse(res);
  return {
    title: data.title || 'Galería privada',
    clientName: data.clientName || 'Cliente XPH',
    media: Array.isArray(data.media) ? data.media : [],
  };
}

export function extractDriveFileId(value: string): string {
  const trimmed = String(value || '').trim();
  const byPath = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (byPath?.[1]) return byPath[1];
  const byId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byId?.[1]) return byId[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return '';
}

export function driveDownloadUrl(fileId: string) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function drivePreviewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
