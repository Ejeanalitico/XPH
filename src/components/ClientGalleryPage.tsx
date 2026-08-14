import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Download, FileVideo2, Loader2, LockKeyhole, X } from 'lucide-react';
import { GalleryImage } from '../types';
import { fetchClientGallery } from '../utils/adminApi';

interface ClientGalleryPageProps {
  slug: string;
  token: string;
}

export const ClientGalleryPage: React.FC<ClientGalleryPageProps> = ({ slug, token }) => {
  const [title, setTitle] = useState('Galería privada');
  const [clientName, setClientName] = useState('Cliente XPH');
  const [media, setMedia] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);

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
    fetchClientGallery(slug, token)
      .then((data) => {
        setTitle(data.title);
        setClientName(data.clientName);
        setMedia(data.media);
      })
      .catch((err) => setError(err?.message || 'No se pudo abrir la galería.'))
      .finally(() => setLoading(false));
  }, [slug, token]);

  const photos = useMemo(() => media.filter((item) => item.mediaType !== 'video'), [media]);
  const videos = useMemo(() => media.filter((item) => item.mediaType === 'video'), [media]);

  if (loading) {
    return <main className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center"><div className="text-center space-y-3"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" /><p className="text-sm text-gray-400">Abriendo galería privada…</p></div></main>;
  }

  if (error) {
    return <main className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center p-4"><div className="max-w-md text-center rounded-2xl bg-[#161C28] border border-white/10 p-8 space-y-3"><LockKeyhole className="w-10 h-10 text-[#D4AF37] mx-auto" /><h1 className="text-xl font-bold">Galería no disponible</h1><p className="text-sm text-gray-400">{error}</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#0B0F17] text-white">
      <header className="border-b border-white/10 bg-[#0B0F17]/95 sticky top-0 z-30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center"><Camera className="w-5 h-5 text-[#D4AF37]" /></div><div><p className="text-sm font-bold">XPH Fotografía & Video</p><p className="text-[10px] uppercase tracking-widest text-gray-500">Galería privada</p></div></div>
          <span className="hidden sm:flex items-center gap-2 text-xs text-gray-400"><LockKeyhole className="w-4 h-4 text-[#D4AF37]" />Acceso exclusivo por enlace</span>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 py-10 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3"><p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">{clientName}</p><h1 className="text-3xl sm:text-5xl font-bold font-serif-luxury">{title}</h1><p className="text-sm text-gray-400">En esta liga privada sí puedes descargar individualmente las fotografías y videos entregados.</p></div>

        {photos.length > 0 && <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Fotografías</h2><span className="text-xs text-gray-500">{photos.length} archivos</span></div><div className="columns-2 md:columns-3 lg:columns-4 gap-3">{photos.map((item) => <article key={item.id} className="break-inside-avoid mb-3 rounded-xl overflow-hidden bg-[#161C28] border border-white/10 group"><button onClick={() => setActiveImage(item)} className="block w-full"><img src={item.url} alt={item.title} className="w-full object-cover" loading="lazy" /></button><div className="p-3 flex items-center justify-between gap-2"><p className="text-xs truncate">{item.title}</p><a href={item.downloadUrl || item.url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-[#D4AF37] text-black" title="Descargar fotografía"><Download className="w-4 h-4" /></a></div></article>)}</div></section>}

        {videos.length > 0 && <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Videos</h2><span className="text-xs text-gray-500">{videos.length} archivos</span></div><div className="grid md:grid-cols-2 gap-5">{videos.map((item) => <article key={item.id} className="rounded-2xl overflow-hidden bg-[#161C28] border border-white/10"><div className="aspect-video bg-black">{item.previewUrl ? <iframe src={item.previewUrl} title={item.title} className="w-full h-full border-0" allow="autoplay" /> : <div className="w-full h-full flex items-center justify-center"><FileVideo2 className="w-12 h-12 text-[#D4AF37]" /></div>}</div><div className="p-4 flex items-center justify-between gap-3"><div><p className="font-semibold text-sm">{item.title}</p><p className="text-xs text-gray-500">Video descargable</p></div><a href={item.downloadUrl || item.url} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black text-xs font-bold flex items-center gap-2"><Download className="w-4 h-4" />Descargar video</a></div></article>)}</div></section>}

        {media.length === 0 && <div className="rounded-2xl bg-[#161C28] border border-white/10 p-12 text-center text-gray-400"><Camera className="w-10 h-10 mx-auto mb-3 opacity-50" /><p>Esta galería todavía no tiene archivos publicados.</p></div>}
      </section>

      {activeImage && <div className="fixed inset-0 z-50 bg-black/95 p-4 flex items-center justify-center" onClick={() => setActiveImage(null)}><button onClick={() => setActiveImage(null)} className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white"><X className="w-6 h-6" /></button><div className="max-w-6xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}><img src={activeImage.url} alt={activeImage.title} className="max-w-full max-h-[80vh] object-contain mx-auto" /><div className="mt-3 flex items-center justify-between gap-3"><p className="text-sm text-gray-300">{activeImage.title}</p><a href={activeImage.downloadUrl || activeImage.url} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black text-xs font-bold flex items-center gap-2"><Download className="w-4 h-4" />Descargar</a></div></div></div>}
    </main>
  );
};
