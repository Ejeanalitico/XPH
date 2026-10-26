import React, { useState } from 'react';

export type PhotosItem = { id: string; type: string; mediaFile: { baseUrl: string; mimeType: string; filename: string } };

async function photosRequest(operation: string, input: Record<string, unknown> = {}) {
  const response = await fetch('/api/proxy?action=adminGooglePhotos', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, ...input }),
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'success') throw new Error(result.message || 'No se pudo leer Google Fotos.');
  return result.data;
}

export async function downloadGooglePhoto(item: PhotosItem, _accessToken = ''): Promise<File> {
  const response = await fetch('/api/proxy?action=adminGooglePhotos', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'downloadShared', baseUrl: item.mediaFile.baseUrl }),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.message || 'No se pudo descargar la fotografía.');
  }
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith('image/')) throw new Error('Google Fotos no devolvió una fotografía válida.');
  return new File([blob], item.mediaFile.filename || 'Google Fotos.jpg', { type: blob.type });
}

export const GooglePhotosImport: React.FC<{
  disabled: boolean;
  onImport: (items: PhotosItem[], accessToken: string) => Promise<void>;
}> = ({ disabled, onImport }) => {
  const [url, setUrl] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [album, setAlbum] = useState<{ title: string; photos: PhotosItem[] } | null>(null);

  const readAlbum = async () => {
    let parsed: URL;
    try { parsed = new URL(url.trim()); } catch { setMessage('Pega una liga compartida válida de Google Fotos.'); return; }
    if (parsed.protocol !== 'https:' || !['photos.app.goo.gl', 'photos.google.com'].includes(parsed.hostname)) {
      setMessage('Usa una liga photos.app.goo.gl o photos.google.com/share.'); return;
    }
    setWorking(true); setAlbum(null); setMessage('Leyendo el álbum compartido…');
    try {
      const photos = new Map<string, PhotosItem>();
      const seenPages = new Set<string>();
      let pageToken = '';
      let albumUrl = url.trim();
      let title = 'Álbum de Google Fotos';
      do {
        const page = await photosRequest('sharedAlbum', { albumUrl, pageToken });
        if (page.title) title = page.title;
        if (page.albumUrl) albumUrl = page.albumUrl;
        for (const photo of page.photos || []) photos.set(photo.id, photo);
        setMessage(`Leyendo “${title}”: ${photos.size} fotografías encontradas…`);
        pageToken = page.nextPageToken || '';
        if (pageToken && seenPages.has(pageToken)) throw new Error('Google repitió un bloque. No se importó el álbum incompleto; vuelve a leer la liga.');
        if (pageToken) seenPages.add(pageToken);
        if (seenPages.size > 100) throw new Error('El álbum es demasiado grande para esta importación. Divídelo en álbumes más pequeños.');
      } while (pageToken);
      if (!photos.size) throw new Error('El álbum no contiene fotografías disponibles.');
      setAlbum({ title, photos: Array.from(photos.values()) });
      setMessage(`“${title}”: ${photos.size} fotografías listas para importar.`);
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : 'No se pudo leer el álbum.'); }
    finally { setWorking(false); }
  };

  const importAlbum = async () => {
    if (!album) return;
    setWorking(true);
    try {
      await onImport(album.photos, '');
      setMessage(`${album.photos.length} fotografías importadas desde “${album.title}”.`);
      setAlbum(null); setUrl('');
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : 'No se pudo completar la importación.'); }
    finally { setWorking(false); }
  };
  const locked = disabled || working;
  return <div className="space-y-3 rounded-xl border border-white/10 p-4">
    <h3 className="font-semibold">Agregar desde Google Fotos</h3>
    <p className="text-xs leading-5 text-gray-400">Pega la liga compartida del álbum. Debe abrir sin iniciar sesión. Se guardarán copias en esta galería privada y se conservarán los originales de Google Fotos.</p>
    <label htmlFor="google-photos-album-url" className="block text-xs text-gray-300">Liga del álbum de Google Fotos</label>
    <input id="google-photos-album-url" type="url" value={url} disabled={locked} onChange={(event) => { setUrl(event.target.value); setAlbum(null); setMessage(''); }} placeholder="https://photos.app.goo.gl/…" className="w-full rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-2.5" />
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!url.trim() || locked} onClick={readAlbum} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm disabled:opacity-40">{working && !album ? 'Leyendo álbum…' : 'Leer álbum desde la liga'}</button>
      {album && <button type="button" disabled={locked} onClick={importAlbum} className="rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">{working ? 'Importando…' : `Importar ${album.photos.length} fotografías`}</button>}
    </div>
    {message && <p role="status" className="text-xs leading-5 text-gray-300">{message}</p>}
  </div>;
};
