import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Image as ImageIcon, Loader2, LogIn, RefreshCw, Save, Upload } from 'lucide-react';
import { HeroCoverSetting, RoutePath } from '../types';
import {
  AdminSession,
  DriveImageRecord,
  adminLogin,
  adminUploadMedia,
  loadAdminConfig,
  loadDriveImages,
  saveAdminConfig,
} from '../utils/adminApi';

const ROUTE_LABELS: Record<RoutePath, string> = {
  inicio: 'Inicio',
  bodas: 'Bodas',
  'xv-anos': 'XV Años',
  bautizos: 'Bautizos & Familia',
  retratos: 'Retratos & Editorial',
  empresarial: 'Empresarial & Branding',
};

const DEFAULT_TEXT: Record<RoutePath, { label: string; description: string }> = {
  inicio: {
    label: 'XPH FOTOGRAFÍA & VIDEO',
    description: 'Producción audiovisual para momentos, eventos y marcas.',
  },
  bodas: {
    label: 'BODAS',
    description: 'Fotografía y video para documentar tu historia.',
  },
  'xv-anos': {
    label: 'XV AÑOS',
    description: 'Cobertura y sesiones para una celebración inolvidable.',
  },
  bautizos: {
    label: 'BAUTIZOS & FAMILIA',
    description: 'Fotografía cercana para celebraciones familiares.',
  },
  retratos: {
    label: 'RETRATOS & EDITORIAL',
    description: 'Sesiones personales, creativas y editoriales.',
  },
  empresarial: {
    label: 'EMPRESARIAL & BRANDING',
    description: 'Contenido visual para tu marca, equipo y negocio.',
  },
};

const emptySetting = (route: RoutePath): HeroCoverSetting => ({
  url: '',
  label: DEFAULT_TEXT[route].label,
  description: DEFAULT_TEXT[route].description,
  positionX: 50,
  positionY: 50,
  zoom: 100,
});

export const CoverAdminPage: React.FC = () => {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [route, setRoute] = useState<RoutePath>('bodas');
  const [settings, setSettings] = useState<Partial<Record<RoutePath, HeroCoverSetting>>>({});
  const [driveImages, setDriveImages] = useState<DriveImageRecord[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const current = useMemo(() => ({ ...emptySetting(route), ...(settings[route] || {}) }), [settings, route]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 4500);
  };

  const loadAll = async (activeSession: AdminSession) => {
    const [config, drive] = await Promise.all([
      loadAdminConfig(activeSession),
      loadDriveImages(activeSession),
    ]);

    const stored = (config.heroCoverSettings && typeof config.heroCoverSettings === 'object')
      ? config.heroCoverSettings
      : {};

    const legacyUrls = (config.heroCovers && typeof config.heroCovers === 'object') ? config.heroCovers : {};
    const galleryCovers = Array.isArray(config.galleryImages)
      ? config.galleryImages.filter((item: any) => item?.mediaType === 'cover-meta' && item?.heroFor && item?.url)
      : [];

    const merged: Partial<Record<RoutePath, HeroCoverSetting>> = { ...stored };
    (Object.keys(ROUTE_LABELS) as RoutePath[]).forEach((key) => {
      if (merged[key]) return;
      const galleryCover = galleryCovers.find((item: any) => item.heroFor === key);
      const url = galleryCover?.url || legacyUrls[key] || '';
      if (url) merged[key] = { ...emptySetting(key), url };
    });

    setSettings(merged);
    setDriveImages(drive);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      const activeSession = await adminLogin(email, password);
      setSession(activeSession);
      await loadAll(activeSession);
    } catch (error: any) {
      setAuthError(error?.message || 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const updateCurrent = (patch: Partial<HeroCoverSetting>) => {
    setSettings((prev) => ({
      ...prev,
      [route]: { ...emptySetting(route), ...(prev[route] || {}), ...patch },
    }));
  };

  const chooseDriveImage = (item: DriveImageRecord) => {
    updateCurrent({ url: item.url, positionX: 50, positionY: 50, zoom: 100 });
    notify('Imagen seleccionada. Ajusta el encuadre y pulsa Guardar portada.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadNewCover = async () => {
    if (!session || !uploadFile) return;
    setBusy(true);
    try {
      const uploaded = await adminUploadMedia(session, uploadFile, {
        title: `Portada ${ROUTE_LABELS[route]}`,
        category: route === 'inicio' ? 'bodas' : route,
        location: 'Portada XPH',
      });
      updateCurrent({ url: uploaded.url, positionX: 50, positionY: 50, zoom: 100 });
      setUploadFile(null);
      notify('Imagen subida. Ajusta el encuadre y guarda la portada.');
    } catch (error: any) {
      notify(error?.message || 'No se pudo subir la imagen.');
    } finally {
      setBusy(false);
    }
  };

  const saveCover = async () => {
    if (!session || !current.url) return;
    setBusy(true);
    try {
      const next = {
        ...settings,
        [route]: {
          ...current,
          positionX: Math.min(100, Math.max(0, Number(current.positionX) || 50)),
          positionY: Math.min(100, Math.max(0, Number(current.positionY) || 50)),
          zoom: Math.min(250, Math.max(100, Number(current.zoom) || 100)),
        },
      };
      await saveAdminConfig(
        session,
        { heroCoverSettings: next },
        'ADMIN_PORTADA_AVANZADA',
        `Portada, texto y encuadre de ${route} actualizados`
      );
      setSettings(next);
      notify(`Portada de ${ROUTE_LABELS[route]} guardada y publicada.`);
    } catch (error: any) {
      notify(error?.message || 'No se pudo guardar la portada.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setUploadFile(null);
  }, [route]);

  if (!session) {
    return (
      <main className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl bg-[#161C28] border border-white/10 p-7 space-y-5 shadow-2xl">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">Administrador XPH</p>
            <h1 className="text-2xl font-bold mt-1">Editor de portadas</h1>
            <p className="text-xs text-gray-400 mt-1">Texto, imagen y encuadre por categoría.</p>
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo de administrador" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white" required />
          {authError && <p className="text-sm text-rose-400">{authError}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}Entrar
          </button>
          <a href="/?xph-admin=panel" className="block text-center text-xs text-gray-400">Volver al administrador</a>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F17] text-white py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">Administrador XPH</p>
            <h1 className="text-3xl font-bold">Portadas · texto y encuadre</h1>
            <p className="text-sm text-gray-400">Edita exactamente el recuadro de texto y qué parte de la fotografía se ve.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/?xph-admin=panel" className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm flex items-center gap-2"><ArrowLeft className="w-4 h-4" />Administrador</a>
            <button onClick={() => loadAll(session).then(() => notify('Drive y portadas actualizados.')).catch((e) => notify(e.message))} className="px-4 py-2.5 rounded-xl border border-white/15 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />Actualizar Drive</button>
          </div>
        </header>

        {message && <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#F5D76E]">{message}</div>}

        <div className="flex overflow-x-auto gap-2 p-1.5 rounded-2xl bg-[#161C28] border border-white/10">
          {(Object.keys(ROUTE_LABELS) as RoutePath[]).map((item) => (
            <button key={item} onClick={() => setRoute(item)} className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap ${route === item ? 'bg-[#D4AF37] text-black' : 'text-gray-300 hover:bg-white/5'}`}>{ROUTE_LABELS[item]}</button>
          ))}
        </div>

        <section className="grid lg:grid-cols-[1.1fr_.9fr] gap-6">
          <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold">Vista previa</h2>
              <p className="text-xs text-gray-400">Esta vista replica el marco de portada del sitio.</p>
            </div>

            <div className="relative mx-auto max-w-xl rounded-2xl overflow-hidden border border-white/15 bg-[#0B0F17] p-2 shadow-2xl">
              <div className="relative h-[460px] rounded-xl overflow-hidden bg-black">
                {current.url ? (
                  <img
                    src={current.url}
                    alt={`Portada ${ROUTE_LABELS[route]}`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-150"
                    style={{
                      objectPosition: `${current.positionX}% ${current.positionY}%`,
                      transform: `scale(${current.zoom / 100})`,
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">Selecciona o sube una imagen</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[#0B0F17]/90 backdrop-blur-md border border-white/10">
                  <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">{current.label || 'TÍTULO'}</p>
                  <p className="text-xs text-gray-400 mt-1">{current.description || 'Descripción de la portada'}</p>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <label className="text-xs text-gray-300">Horizontal: {current.positionX}%
                <input type="range" min="0" max="100" value={current.positionX} onChange={(e) => updateCurrent({ positionX: Number(e.target.value) })} className="w-full mt-2" />
              </label>
              <label className="text-xs text-gray-300">Vertical: {current.positionY}%
                <input type="range" min="0" max="100" value={current.positionY} onChange={(e) => updateCurrent({ positionY: Number(e.target.value) })} className="w-full mt-2" />
              </label>
              <label className="text-xs text-gray-300">Zoom: {current.zoom}%
                <input type="range" min="100" max="250" step="5" value={current.zoom} onChange={(e) => updateCurrent({ zoom: Number(e.target.value) })} className="w-full mt-2" />
              </label>
            </div>

            <button onClick={() => updateCurrent({ positionX: 50, positionY: 50, zoom: 100 })} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">Restablecer encuadre</button>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
              <div><h2 className="text-xl font-bold">Texto de la portada</h2><p className="text-xs text-gray-400">Edita el texto que aparece dentro del recuadro inferior.</p></div>
              <label className="text-xs text-gray-300 block">Título
                <input value={current.label} onChange={(e) => updateCurrent({ label: e.target.value })} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white" placeholder="Ej. BODAS" />
              </label>
              <label className="text-xs text-gray-300 block">Descripción
                <textarea value={current.description} onChange={(e) => updateCurrent({ description: e.target.value })} rows={3} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white resize-y" placeholder="Texto que aparecerá debajo del título" />
              </label>
            </div>

            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
              <div><h2 className="text-xl font-bold">Subir nueva imagen</h2><p className="text-xs text-gray-400">La original se conserva en Drive; el recorte se guarda como configuración.</p></div>
              <input type="file" accept="image/*" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-300" />
              <button onClick={uploadNewCover} disabled={!uploadFile || busy} className="w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"><Upload className="w-4 h-4" />Subir y editar encuadre</button>
            </div>

            <button onClick={saveCover} disabled={!current.url || busy} className="w-full px-6 py-4 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar portada
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-[#161C28] border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Elegir una imagen existente de Drive</h2><p className="text-xs text-gray-400">Haz clic en una imagen y después ajusta zoom y posición arriba.</p></div>
            <span className="text-xs text-gray-500">{driveImages.length} imágenes</span>
          </div>
          {driveImages.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#0B0F17] border border-white/10 text-center text-sm text-gray-400">No se recibieron imágenes. Pulsa “Actualizar Drive”.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[620px] overflow-auto">
              {driveImages.map((item) => {
                const selected = current.url === item.url;
                return (
                  <button key={item.id} onClick={() => chooseDriveImage(item)} className={`relative rounded-xl overflow-hidden border ${selected ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-white/10 hover:border-white/30'}`}>
                    <img src={item.url} alt={item.name} className="w-full aspect-square object-cover" loading="lazy" />
                    <div className="p-2 bg-[#0B0F17] text-[10px] truncate">{item.name}</div>
                    {selected && <span className="absolute top-2 right-2 bg-[#D4AF37] text-black rounded-full p-1"><CheckCircle2 className="w-4 h-4" /></span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
