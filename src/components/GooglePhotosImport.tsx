import React, { useEffect, useRef, useState } from 'react';

const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
export type PhotosItem = { id: string; type: string; mediaFile: { baseUrl: string; mimeType: string; filename: string } };
type PickingSession = { id: string; pickerUri: string; mediaItemsSet?: boolean; expireTime?: string };
type TokenClient = { requestAccessToken: () => void };
type GoogleIdentity = { accounts: { oauth2: { initTokenClient: (options: {
  client_id: string; scope: string; callback: (result: { access_token?: string; expires_in?: number; error?: string }) => void;
  error_callback: () => void;
}) => TokenClient } } };

async function photosRequest(operation: string, input: Record<string, unknown> = {}) {
  const response = await fetch('/api/proxy?action=adminGooglePhotos', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, ...input }),
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'success') throw new Error(result.message || 'No se pudo conectar con Google Fotos.');
  return result;
}

export async function downloadGooglePhoto(item: PhotosItem, accessToken: string): Promise<File> {
  const response = await fetch('/api/proxy?action=adminGooglePhotos', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'download', accessToken, baseUrl: item.mediaFile.baseUrl }),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.message || 'No se pudo descargar la fotografía.');
  }
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith('image/')) throw new Error('Google Fotos no devolvió una fotografía válida.');
  return new File([blob], item.mediaFile.filename || 'Google Fotos.jpg', { type: blob.type });
}

let identityScript: Promise<void> | undefined;
function loadIdentity() {
  if ((window as Window & { google?: GoogleIdentity }).google?.accounts?.oauth2) return Promise.resolve();
  if (!identityScript) identityScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { identityScript = undefined; script.remove(); reject(new Error('No se pudo cargar la conexión con Google. Recarga la página.')); };
    document.head.appendChild(script);
  });
  return identityScript;
}

export const GooglePhotosImport: React.FC<{
  disabled: boolean;
  onImport: (items: PhotosItem[], accessToken: string) => Promise<void>;
}> = ({ disabled, onImport }) => {
  const client = useRef<TokenClient | null>(null);
  const auth = useRef({ token: '', expires: 0 });
  const pickingRef = useRef<PickingSession | null>(null);
  const [picking, setPicking] = useState<PickingSession | null>(null);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('Preparando conexión con Google Fotos…');
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { clientId } = await photosRequest('config');
        if (!clientId) throw new Error('La conexión de Google Fotos aún no está configurada.');
        await loadIdentity();
        if (!active) return;
        const google = (window as Window & { google?: GoogleIdentity }).google!;
        client.current = google.accounts.oauth2.initTokenClient({
          client_id: clientId, scope: SCOPE,
          callback: (result) => {
            if (!active) return;
            setWorking(false);
            if (!result.access_token || result.error) { setMessage('No se autorizó Google Fotos. Puedes volver a conectar.'); return; }
            auth.current = { token: result.access_token, expires: Date.now() + Number(result.expires_in || 3600) * 1000 - 30_000 };
            setConnected(true); setPicking(null); pickingRef.current = null;
            setMessage('Cuenta conectada. Abre el selector y elige las fotografías que deseas importar.');
          },
          error_callback: () => { if (active) { setWorking(false); setMessage('Se cerró o bloqueó la autorización. Permite las ventanas emergentes y vuelve a conectar.'); } },
        });
        setReady(true); setMessage('Conecta tu cuenta para seleccionar fotografías de Google Fotos.');
      } catch (error: unknown) { if (active) setMessage(error instanceof Error ? error.message : 'No se pudo preparar Google Fotos.'); }
    })();
    return () => {
      active = false;
      if (pickingRef.current && auth.current.token) void photosRequest('delete', { sessionId: pickingRef.current.id, accessToken: auth.current.token }).catch(() => {});
      auth.current = { token: '', expires: 0 };
    };
  }, []);

  const validToken = () => {
    if (!auth.current.token || Date.now() >= auth.current.expires) {
      setConnected(false); throw new Error('La autorización venció. Conecta tu cuenta otra vez.');
    }
    return auth.current.token;
  };
  const choose = async () => {
    // Reserve a tab during the click so popup blockers do not discard the picker.
    const popup = window.open('about:blank', '_blank');
    if (!popup) { setMessage('Permite las ventanas emergentes para abrir Google Fotos.'); return; }
    popup.opener = null;
    setWorking(true);
    try {
      const accessToken = validToken();
      if (pickingRef.current) await photosRequest('delete', { sessionId: pickingRef.current.id, accessToken }).catch(() => {});
      const { data } = await photosRequest('create', { accessToken });
      const uri = new URL(data.pickerUri);
      if (uri.protocol !== 'https:' || uri.hostname !== 'photos.google.com') throw new Error('Google Fotos devolvió un selector no válido.');
      pickingRef.current = data; setPicking(data);
      popup.location.href = uri.href;
      setMessage('Selecciona tus fotografías en Google Fotos, pulsa Listo y regresa para importar. Los videos no se importarán.');
    } catch (error: unknown) { popup.close(); setMessage(error instanceof Error ? error.message : 'No se pudo abrir Google Fotos.'); }
    finally { setWorking(false); }
  };
  const importSelection = async () => {
    if (!picking) return;
    setWorking(true);
    try {
      const accessToken = validToken();
      const { data } = await photosRequest('session', { accessToken, sessionId: picking.id });
      if (!data.mediaItemsSet) { setMessage('La selección todavía no está lista. Pulsa Listo en Google Fotos y vuelve a importar.'); return; }
      const items: PhotosItem[] = [];
      let pageToken = '';
      do {
        const page = await photosRequest('list', { accessToken, sessionId: picking.id, pageToken });
        items.push(...(page.data.mediaItems || []).filter((item: PhotosItem) => item.type === 'PHOTO' && item.mediaFile?.mimeType?.startsWith('image/')));
        pageToken = page.data.nextPageToken || '';
      } while (pageToken);
      if (!items.length) { setMessage('No hay fotografías en la selección. Abre el selector para elegir fotos.'); return; }
      await onImport(items, accessToken);
      await photosRequest('delete', { accessToken, sessionId: picking.id }).catch(() => {});
      pickingRef.current = null; setPicking(null);
      setMessage(`${items.length} fotografías importadas. Las copias ya no dependen de la sesión de Google Fotos.`);
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : 'No se pudo importar la selección.'); }
    finally { setWorking(false); }
  };
  const locked = disabled || working;
  return <div className="space-y-3 rounded-xl border border-white/10 p-4 lg:col-span-2">
    <h3 className="font-semibold">Agregar desde Google Fotos</h3>
    <p className="text-xs leading-5 text-gray-400">Selecciona fotos de tu cuenta y guarda una copia en este álbum privado. Los originales de Google Fotos se conservan. No necesitas compartir públicamente tu álbum.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!ready || locked} onClick={() => { setWorking(true); client.current?.requestAccessToken(); }} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm disabled:opacity-40">{connected ? 'Cambiar o reconectar cuenta' : 'Conectar Google Fotos'}</button>
      {connected && <button type="button" disabled={locked} onClick={choose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm disabled:opacity-40">Elegir fotografías</button>}
      {picking && <button type="button" disabled={locked} onClick={importSelection} className="rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">{working ? 'Procesando…' : 'Importar selección'}</button>}
    </div>
    <p role="status" className="text-xs leading-5 text-gray-300">{message}</p>
  </div>;
};
