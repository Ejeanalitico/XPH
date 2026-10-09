import React, { useEffect, useMemo, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Download, FileVideo2, House, Loader2, LockKeyhole, X } from 'lucide-react';
import { GalleryImage } from '../types';
import { SafeImage } from './SafeImage';

type ClientGalleryMedia = GalleryImage & { streamUrl?: string };

interface ClientGalleryPageProps {
  slug: string;
  token: string;
}

interface ClientGalleryResponse {
  status: string;
  title: string;
  clientName: string;
  allowDownloads: boolean;
  media: ClientGalleryMedia[];
  message?: string;
}

interface DriveVideoProps {
  item: ClientGalleryMedia;
  index: number;
}

const DriveVideo: React.FC<DriveVideoProps> = ({ item, index }) => {
  const [usePreviewFallback, setUsePreviewFallback] = useState(false);
  const originalSource = item.streamUrl || item.downloadUrl || '';

  if (!usePreviewFallback && originalSource) {
    return (
      <video
        src={originalSource}
        title={`Video ${index + 1}`}
        className="w-full h-full object-contain bg-black"
        controls
        playsInline
        preload="metadata"
        onError={() => setUsePreviewFallback(true)}
      />
    );
  }

  if (item.previewUrl) {
    return (
      <iframe
        src={item.previewUrl}
        title={`Video ${index + 1}`}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    );
  }

  return <div className="w-full h-full flex items-center justify-center"><FileVideo2 className="w-12 h-12 text-[#D4AF37]" /></div>;
};

const fetchPrivateGallery = async (slug: string, token: string): Promise<ClientGalleryResponse> => {
  const response = await fetch(`/api/client-gallery?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}&_t=${Date.now()}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok || data?.status !== 'success') {
    throw new Error(data?.message || 'No se pudo abrir la galería.');
  }
  return data;
};

export const ClientGalleryPage: React.FC<ClientGalleryPageProps> = ({ slug, token }) => {
  const [title, setTitle] = useState('Galería privada');
  const [clientName, setClientName] = useState('Cliente XPH');
  const [media, setMedia] = useState<ClientGalleryMedia[]>([]);
  const [downloadsEnabled, setDownloadsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"]');
    const meta = existing || document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex,nofollow,noarchive');
    if (!existing) document.head.appendChild(meta);
    document.title = `${title} | XPH Fotografía & Video`;
    return () => {
      if (!existing) meta.remove();
    };
  }, [title]);

  useEffect(() => {
    setLoading(true);
    fetchPrivateGallery(slug, token)
      .then((data) => {
        setTitle(data.title);
        setClientName(data.clientName);
        setDownloadsEnabled(data.allowDownloads !== false);
        setMedia(data.media || []);
      })
      .catch((err) => setError(err?.message || 'No se pudo abrir la galería.'))
      .finally(() => setLoading(false));
  }, [slug, token]);

  const photos = useMemo(() => media.filter((item) => item.mediaType !== 'video'), [media]);
  const videos = useMemo(() => media.filter((item) => item.mediaType === 'video'), [media]);
  const activePhoto = activePhotoIndex !== null ? photos[activePhotoIndex] : null;

  const showPrevious = () => {
    if (!photos.length || activePhotoIndex === null) return;
    setActivePhotoIndex((activePhotoIndex - 1 + photos.length) % photos.length);
  };

  const showNext = () => {
    if (!photos.length || activePhotoIndex === null) return;
    setActivePhotoIndex((activePhotoIndex + 1) % photos.length);
  };

  useEffect(() => {
    if (activePhotoIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActivePhotoIndex(null);
      if (event.key === 'ArrowLeft') showPrevious();
      if (event.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhotoIndex, photos.length]);

  const galleryHeader = (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0F17]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]" aria-label="XPH Fotografía & Video: ir al inicio">
          <img
            src="/xph-logo.png?v=20260814-6"
            alt="Logotipo de XPH Fotografía & Video"
            className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
            width="56"
            height="56"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-white sm:text-base">XPH Fotografía & Video</span>
            <span className="block text-[10px] uppercase tracking-widest text-gray-400">Galería privada</span>
          </span>
        </a>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-gray-400 md:flex">
            <LockKeyhole className="h-4 w-4 text-[#D4AF37]" />
            Acceso exclusivo por enlace
          </span>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/45 bg-[#D4AF37]/10 px-3 py-2 text-sm font-semibold text-[#F5D76E] transition-colors hover:bg-[#D4AF37]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37] sm:px-4"
            aria-label="Inicio: visitar la página principal de XPH"
          >
            <House className="h-4 w-4" aria-hidden="true" />
            Inicio
          </a>
        </div>
      </div>
    </header>
  );

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col bg-[#0B0F17] text-white">
        {galleryHeader}
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="space-y-3 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#D4AF37]" /><p className="text-sm text-gray-400">Abriendo galería privada…</p></div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col bg-[#0B0F17] text-white">
        {galleryHeader}
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="max-w-md space-y-3 rounded-2xl border border-white/10 bg-[#161C28] p-8 text-center">
            <LockKeyhole className="mx-auto h-10 w-10 text-[#D4AF37]" />
            <h1 className="text-xl font-bold">Galería no disponible</h1>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F17] text-white">
      {galleryHeader}

      <section className="max-w-7xl mx-auto px-4 py-10 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">{clientName}</p>
          <h1 className="text-3xl sm:text-5xl font-bold font-serif-luxury">{title}</h1>
          <p className="text-sm text-gray-400">
            {downloadsEnabled
              ? 'Puedes visualizar y descargar los archivos habilitados en esta galería.'
              : 'Esta galería está habilitada únicamente para visualización.'}
          </p>
        </div>

        {videos.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Videos</h2><span className="text-xs text-gray-500">{videos.length} archivos</span></div>
            <div className="grid md:grid-cols-2 gap-5">
              {videos.map((item, index) => (
                <article key={item.id} className="rounded-2xl overflow-hidden bg-[#161C28] border border-white/10">
                  <div className="aspect-video bg-black">
                    <DriveVideo item={item} index={index} />
                  </div>
                  {downloadsEnabled && item.downloadUrl && (
                    <div className="p-4 flex justify-end">
                      <a href={item.downloadUrl} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black text-xs font-bold flex items-center gap-2">
                        <Download className="w-4 h-4" />Descargar video
                      </a>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {photos.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Fotografías</h2><span className="text-xs text-gray-500">{photos.length} archivos</span></div>
            <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
              {photos.map((item, index) => (
                <article key={item.id} className="break-inside-avoid mb-3 rounded-xl overflow-hidden bg-[#161C28] border border-white/10 group relative">
                  <button onClick={() => setActivePhotoIndex(index)} className="block w-full">
                    <SafeImage src={item.url} alt={`Fotografía ${index + 1}`} className="w-full object-cover" />
                  </button>
                  {downloadsEnabled && item.downloadUrl && (
                    <a href={item.downloadUrl} target="_blank" rel="noreferrer" className="absolute bottom-3 right-3 p-2.5 rounded-full bg-[#D4AF37] text-black shadow-xl opacity-0 group-hover:opacity-100 transition-opacity" title="Descargar fotografía" aria-label={`Descargar fotografía ${index + 1}`}>
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {media.length === 0 && <div className="rounded-2xl bg-[#161C28] border border-white/10 p-12 text-center text-gray-400"><Camera className="w-10 h-10 mx-auto mb-3 opacity-50" /><p>Esta galería todavía no tiene archivos publicados.</p></div>}
      </section>

      {activePhoto && activePhotoIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 p-4 flex items-center justify-center" onClick={() => setActivePhotoIndex(null)}>
          <button onClick={() => setActivePhotoIndex(null)} className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white z-20" aria-label="Cerrar visor"><X className="w-6 h-6" /></button>

          {photos.length > 1 && (
            <>
              <button onClick={(event) => { event.stopPropagation(); showPrevious(); }} className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-white/10 hover:bg-white/20 text-white z-20" aria-label="Fotografía anterior"><ChevronLeft className="w-7 h-7" /></button>
              <button onClick={(event) => { event.stopPropagation(); showNext(); }} className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-white/10 hover:bg-white/20 text-white z-20" aria-label="Fotografía siguiente"><ChevronRight className="w-7 h-7" /></button>
            </>
          )}

          <div className="max-w-6xl max-h-[92vh] w-full flex flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <SafeImage src={activePhoto.url} alt={`Fotografía ${activePhotoIndex + 1}`} className="max-w-full max-h-[82vh] object-contain mx-auto" />
            <div className="mt-3 flex items-center justify-center gap-4 min-h-10">
              <span className="text-xs text-gray-500">{activePhotoIndex + 1} / {photos.length}</span>
              {downloadsEnabled && activePhoto.downloadUrl && (
                <a href={activePhoto.downloadUrl} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black text-xs font-bold flex items-center gap-2">
                  <Download className="w-4 h-4" />Descargar
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
