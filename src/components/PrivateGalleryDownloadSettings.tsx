import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, Save, ShieldCheck } from 'lucide-react';
import { GalleryImage } from '../types';
import { AdminSession, loadAdminConfig, resumeAdminSession, saveAdminConfig } from '../utils/adminApi';

const findPrivateSection = () =>
  Array.from(document.querySelectorAll<HTMLElement>('section')).find((section) => {
    const text = section.textContent || '';
    return text.includes('Crear galería privada') && text.includes('Galerías creadas');
  }) || null;

export const PrivateGalleryDownloadSettings: React.FC = () => {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [galleryId, setGalleryId] = useState('');
  const [allowDownloads, setAllowDownloads] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const galleries = useMemo(
    () => items.filter((item) => item.visibility === 'private' && item.mediaType === 'gallery-meta'),
    [items]
  );

  const selectedMeta = galleries.find((item) => (item.galleryId || item.id) === galleryId) || null;

  useEffect(() => {
    let cancelled = false;
    resumeAdminSession().then((restored) => {
      if (!cancelled) setSession(restored);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const attach = () => {
      const section = findPrivateSection();
      if (!section) {
        setHost(null);
        return;
      }
      let target = section.querySelector<HTMLElement>('[data-xph-download-settings]');
      if (!target) {
        target = document.createElement('div');
        target.dataset.xphDownloadSettings = 'true';
        section.prepend(target);
      }
      setHost(target);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const refresh = async () => {
    if (!session) return;
    const config = await loadAdminConfig(session);
    const nextItems = Array.isArray(config.galleryImages) ? config.galleryImages : [];
    setItems(nextItems);
    const metas = nextItems.filter((item: GalleryImage) => item.visibility === 'private' && item.mediaType === 'gallery-meta');
    const nextId = galleryId && metas.some((item: GalleryImage) => (item.galleryId || item.id) === galleryId)
      ? galleryId
      : (metas[0]?.galleryId || metas[0]?.id || '');
    setGalleryId(nextId);
    const meta = metas.find((item: GalleryImage) => (item.galleryId || item.id) === nextId);
    setAllowDownloads(meta?.galleryAllowDownloads !== false);
  };

  useEffect(() => {
    if (host && session) refresh().catch(() => {});
  }, [host, session]);

  useEffect(() => {
    if (selectedMeta) setAllowDownloads(selectedMeta.galleryAllowDownloads !== false);
  }, [galleryId, selectedMeta?.galleryAllowDownloads]);

  const savePermission = async () => {
    if (!session || !selectedMeta) return;
    const selectedId = selectedMeta.galleryId || selectedMeta.id;
    setBusy(true);
    setMessage('');
    try {
      const next = items.map((item) => {
        const itemGalleryId = item.galleryId || (item.mediaType === 'gallery-meta' ? item.id : '');
        if (itemGalleryId !== selectedId) return item;
        return { ...item, galleryAllowDownloads: allowDownloads };
      });
      const confirmed = await saveAdminConfig(
        session,
        { galleryImages: next },
        'ADMIN_PERMISO_DESCARGAS',
        `${allowDownloads ? 'Descargas habilitadas' : 'Descargas deshabilitadas'} para ${selectedMeta.galleryTitle || selectedMeta.title}`
      );
      setItems(Array.isArray(confirmed.galleryImages) ? confirmed.galleryImages : next);
      setMessage(allowDownloads ? 'Descargas habilitadas para esta galería.' : 'Galería configurada solo para visualización.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo guardar el permiso.');
    } finally {
      setBusy(false);
    }
  };

  if (!host || !session) return null;

  return createPortal(
    <div className="rounded-2xl bg-[#161C28] border border-[#D4AF37]/30 p-5 space-y-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Permisos de la galería privada</h2>
          <p className="text-xs text-gray-400 mt-1">Controla si el cliente puede descargar fotografías y videos. La visualización siempre permanece disponible con su liga privada.</p>
        </div>
      </div>

      {galleries.length ? (
        <div className="grid lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <label className="text-xs text-gray-400">
            Galería
            <select
              value={galleryId}
              onChange={(event) => setGalleryId(event.target.value)}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10 text-white"
            >
              {galleries.map((gallery) => {
                const id = gallery.galleryId || gallery.id;
                return <option key={id} value={id}>{gallery.galleryTitle || gallery.title} · {gallery.galleryClient || 'Cliente XPH'}</option>;
              })}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setAllowDownloads((value) => !value)}
            className={`h-12 px-4 rounded-xl border flex items-center gap-3 font-semibold text-sm transition-all ${allowDownloads ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/15 text-gray-300'}`}
            aria-pressed={allowDownloads}
          >
            <span className={`relative w-11 h-6 rounded-full transition-colors ${allowDownloads ? 'bg-emerald-500' : 'bg-gray-700'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${allowDownloads ? 'translate-x-6' : 'translate-x-1'}`} />
            </span>
            <Download className="w-4 h-4" />
            {allowDownloads ? 'Descargas: Sí' : 'Descargas: No'}
          </button>

          <button
            type="button"
            onClick={savePermission}
            disabled={busy || !selectedMeta}
            className="h-12 px-5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar permiso
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Crea una galería privada para configurar sus permisos.</p>
      )}

      {message && <p className="text-xs text-[#F5D76E]">{message}</p>}
    </div>,
    host
  );
};
