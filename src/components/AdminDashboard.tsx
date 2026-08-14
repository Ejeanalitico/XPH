import React, { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileVideo2,
  FolderLock,
  Image as ImageIcon,
  Loader2,
  LogIn,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import { ADDONS_CATALOG, PACKAGES_BY_EVENT } from '../data/packages';
import {
  AddOnOption,
  EventType,
  GalleryCategory,
  GalleryImage,
  PackageOption,
  PrivateGallerySummary,
  RoutePath,
} from '../types';
import {
  AdminSession,
  DriveImageRecord,
  adminLogin,
  adminUploadMedia,
  driveDownloadUrl,
  drivePreviewUrl,
  extractDriveFileId,
  loadAdminConfig,
  loadDriveImages,
  saveAdminConfig,
} from '../utils/adminApi';

const CATEGORY_LABELS: Record<EventType, string> = {
  bodas: 'Bodas',
  'xv-anos': 'XV Años',
  bautizos: 'Bautizos & Familia',
  retratos: 'Retratos & Editorial',
  empresarial: 'Empresarial & Branding',
};

const COVER_LABELS: Record<RoutePath, string> = {
  inicio: 'Inicio',
  bodas: 'Bodas',
  'xv-anos': 'XV Años',
  bautizos: 'Bautizos & Familia',
  retratos: 'Retratos & Editorial',
  empresarial: 'Empresarial & Branding',
};

const PUBLIC_CATEGORIES: Array<{ value: Exclude<GalleryCategory, 'all'>; label: string }> = [
  { value: 'bodas', label: 'Bodas' },
  { value: 'xv-anos', label: 'XV Años' },
  { value: 'bautizos', label: 'Bautizos & Familia' },
  { value: 'retratos', label: 'Retratos & Editorial' },
  { value: 'empresarial', label: 'Empresarial & Branding' },
  { value: 'previa', label: 'Sesión previa / Save the date' },
];

type Tab = 'packages' | 'public' | 'covers' | 'private';

const splitLines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);
const titleFromFilename = (name: string) => name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Fotografía';
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const makeToken = () => {
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  return Array.from(array).map((value) => value.toString(36)).join('');
};

const hasManagedPackages = (value: any) => Boolean(value && Object.values(value).flat().some((pkg: any) => pkg?.managedByAdmin));
const hasManagedAddons = (value: any) => Array.isArray(value) && value.some((item: any) => item?.managedByAdmin);

const privateGallerySummaries = (items: GalleryImage[]): PrivateGallerySummary[] =>
  items.filter((item) => item.visibility === 'private' && item.mediaType === 'gallery-meta').map((meta) => ({
    galleryId: meta.galleryId || meta.id,
    slug: meta.gallerySlug || '',
    title: meta.galleryTitle || meta.title,
    clientName: meta.galleryClient || 'Cliente XPH',
    token: meta.galleryToken || '',
    createdAt: meta.createdAt || '',
    mediaCount: items.filter((item) => item.galleryId === meta.galleryId && item.mediaType !== 'gallery-meta').length,
  }));

export const AdminDashboard: React.FC = () => {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<Tab>('packages');

  const [packages, setPackages] = useState<Record<EventType, PackageOption[]>>(PACKAGES_BY_EVENT);
  const [addons, setAddons] = useState<AddOnOption[]>(ADDONS_CATALOG);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [driveImages, setDriveImages] = useState<DriveImageRecord[]>([]);
  const [activeCategory, setActiveCategory] = useState<EventType>('bodas');

  const [publicCategory, setPublicCategory] = useState<Exclude<GalleryCategory, 'all'>>('bodas');
  const [publicLocation, setPublicLocation] = useState('CDMX');
  const [publicFiles, setPublicFiles] = useState<File[]>([]);
  const [selectedDriveIds, setSelectedDriveIds] = useState<string[]>([]);

  const [coverRoute, setCoverRoute] = useState<RoutePath>('inicio');
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [galleryClient, setGalleryClient] = useState('');
  const [galleryTitle, setGalleryTitle] = useState('');
  const [selectedGalleryId, setSelectedGalleryId] = useState('');
  const [privateFiles, setPrivateFiles] = useState<File[]>([]);
  const [driveMediaUrl, setDriveMediaUrl] = useState('');
  const [driveMediaTitle, setDriveMediaTitle] = useState('');
  const [driveMediaType, setDriveMediaType] = useState<'image' | 'video'>('video');

  const privateGalleries = useMemo(() => privateGallerySummaries(galleryImages), [galleryImages]);
  const selectedGallery = privateGalleries.find((item) => item.galleryId === selectedGalleryId) || null;
  const selectedGalleryMedia = galleryImages.filter((item) => item.galleryId === selectedGalleryId && item.mediaType !== 'gallery-meta');
  const publicImages = galleryImages.filter((item) => item.visibility !== 'private' && item.visibility !== 'cover' && item.mediaType !== 'gallery-meta' && item.mediaType !== 'cover-meta' && item.mediaType !== 'video' && item.category !== 'private');
  const currentCover = galleryImages.find((item) => item.mediaType === 'cover-meta' && item.heroFor === coverRoute) || null;

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 5000);
  };

  const refresh = async (activeSession: AdminSession) => {
    const [config, drive] = await Promise.all([
      loadAdminConfig(activeSession),
      loadDriveImages(activeSession),
    ]);
    setPackages(hasManagedPackages(config.packages) ? config.packages : PACKAGES_BY_EVENT);
    setAddons(hasManagedAddons(config.addons) ? config.addons : ADDONS_CATALOG);
    setGalleryImages(Array.isArray(config.galleryImages) ? config.galleryImages : []);
    setDriveImages(drive);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      const nextSession = await adminLogin(email, password);
      setSession(nextSession);
      await refresh(nextSession);
    } catch (error: any) {
      setAuthError(error?.message || 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const persistGallery = async (next: GalleryImage[], type: string, details: string) => {
    if (!session) return;
    await saveAdminConfig(session, { galleryImages: next }, type, details);
    setGalleryImages(next);
  };

  const saveCatalog = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const managedPackages = Object.fromEntries(
        Object.entries(packages).map(([key, list]) => [key, list.map((pkg) => ({ ...pkg, managedByAdmin: true }))])
      ) as Record<EventType, PackageOption[]>;
      const managedAddons = addons.map((addon) => ({ ...addon, managedByAdmin: true }));
      await saveAdminConfig(session, { packages: managedPackages, addons: managedAddons }, 'ADMIN_PAQUETES', 'Paquetes y adicionales actualizados desde el administrador web');
      setPackages(managedPackages);
      setAddons(managedAddons);
      notify('Paquetes guardados y publicados.');
    } catch (error: any) {
      notify(error?.message || 'No se pudieron guardar los paquetes.');
    } finally {
      setBusy(false);
    }
  };

  const updatePackage = (id: string, patch: Partial<PackageOption>) => {
    setPackages((prev) => ({
      ...prev,
      [activeCategory]: prev[activeCategory].map((pkg) => (pkg.id === id ? { ...pkg, ...patch } : pkg)),
    }));
  };

  const addPackage = () => {
    setPackages((prev) => ({
      ...prev,
      [activeCategory]: [
        ...prev[activeCategory],
        {
          id: `pkg_${activeCategory}_${Date.now()}`,
          name: 'NUEVO PAQUETE',
          price: 0,
          description: 'Describe aquí el objetivo y alcance del paquete.',
          features: ['Servicio incluido'],
          notIncludes: [],
          managedByAdmin: true,
        },
      ],
    }));
  };

  const uploadPublicFiles = async () => {
    if (!session || !publicFiles.length) return;
    setBusy(true);
    try {
      const added: GalleryImage[] = [];
      for (const file of publicFiles) {
        if (!file.type.startsWith('image/')) continue;
        const uploaded = await adminUploadMedia(session, file, {
          title: titleFromFilename(file.name),
          category: publicCategory,
          location: publicLocation || 'CDMX',
        });
        added.push({
          id: uploaded.fileId,
          title: titleFromFilename(file.name),
          category: publicCategory,
          url: uploaded.url,
          location: publicLocation || 'CDMX',
          visibility: 'public',
          mediaType: 'image',
          createdAt: new Date().toISOString(),
        });
      }
      const ids = new Set(added.map((item) => item.id));
      const next = [...added, ...galleryImages.filter((item) => !ids.has(item.id))];
      await persistGallery(next, 'ADMIN_GALERIA_PUBLICA', `${added.length} imágenes públicas cargadas`);
      setPublicFiles([]);
      await refresh(session);
      notify(`${added.length} imágenes publicadas.`);
    } catch (error: any) {
      notify(error?.message || 'No se pudieron subir las imágenes.');
    } finally {
      setBusy(false);
    }
  };

  const registerDriveSelection = async () => {
    if (!session || !selectedDriveIds.length) return;
    setBusy(true);
    try {
      const selected = driveImages.filter((item) => selectedDriveIds.includes(item.id));
      const selectedIds = new Set(selected.map((item) => item.id));
      const records: GalleryImage[] = selected.map((item) => ({
        id: item.id,
        title: titleFromFilename(item.name),
        category: publicCategory,
        url: item.url,
        location: publicLocation || 'CDMX',
        visibility: 'public',
        mediaType: 'image',
        createdAt: item.createdTime || new Date().toISOString(),
      }));
      const next = [...records, ...galleryImages.filter((item) => !selectedIds.has(item.id))];
      await persistGallery(next, 'ADMIN_GALERIA_DRIVE', `${records.length} imágenes existentes de Drive registradas`);
      setSelectedDriveIds([]);
      notify(`${records.length} imágenes de Drive registradas.`);
    } catch (error: any) {
      notify(error?.message || 'No se pudieron registrar las imágenes de Drive.');
    } finally {
      setBusy(false);
    }
  };

  const setCoverFromUrl = async (url: string, title: string) => {
    if (!session || !url) return;
    setBusy(true);
    try {
      const cover: GalleryImage = {
        id: `cover-${coverRoute}`,
        title,
        category: coverRoute === 'inicio' ? 'bodas' : coverRoute,
        url,
        location: 'Portada XPH',
        visibility: 'cover',
        mediaType: 'cover-meta',
        heroFor: coverRoute,
        createdAt: new Date().toISOString(),
      };
      const next = [cover, ...galleryImages.filter((item) => !(item.mediaType === 'cover-meta' && item.heroFor === coverRoute))];
      await persistGallery(next, 'ADMIN_PORTADA', `Portada de ${coverRoute} actualizada`);
      notify(`Portada de ${COVER_LABELS[coverRoute]} actualizada.`);
    } catch (error: any) {
      notify(error?.message || 'No se pudo actualizar la portada.');
    } finally {
      setBusy(false);
    }
  };

  const uploadCover = async () => {
    if (!session || !coverFile) return;
    setBusy(true);
    try {
      const uploaded = await adminUploadMedia(session, coverFile, {
        title: titleFromFilename(coverFile.name),
        category: coverRoute === 'inicio' ? 'bodas' : coverRoute,
        location: 'Portada XPH',
      });
      const cover: GalleryImage = {
        id: `cover-${coverRoute}`,
        title: titleFromFilename(coverFile.name),
        category: coverRoute === 'inicio' ? 'bodas' : coverRoute,
        url: uploaded.url,
        location: 'Portada XPH',
        visibility: 'cover',
        mediaType: 'cover-meta',
        heroFor: coverRoute,
        createdAt: new Date().toISOString(),
      };
      const next = [cover, ...galleryImages.filter((item) => !(item.mediaType === 'cover-meta' && item.heroFor === coverRoute))];
      await persistGallery(next, 'ADMIN_PORTADA', `Portada de ${coverRoute} cargada`);
      setCoverFile(null);
      notify(`Portada de ${COVER_LABELS[coverRoute]} actualizada.`);
    } catch (error: any) {
      notify(error?.message || 'No se pudo subir la portada.');
    } finally {
      setBusy(false);
    }
  };

  const createPrivateGallery = async () => {
    if (!session || !galleryClient.trim() || !galleryTitle.trim()) return;
    setBusy(true);
    try {
      const galleryId = `gallery-${Date.now()}`;
      const meta: GalleryImage = {
        id: `meta-${galleryId}`,
        title: galleryTitle.trim(),
        category: 'private',
        url: 'xph://gallery-meta',
        location: '',
        visibility: 'private',
        mediaType: 'gallery-meta',
        galleryId,
        gallerySlug: `${slugify(galleryClient)}-${Math.random().toString(36).slice(2, 7)}`,
        galleryTitle: galleryTitle.trim(),
        galleryClient: galleryClient.trim(),
        galleryToken: makeToken(),
        createdAt: new Date().toISOString(),
      };
      const next = [meta, ...galleryImages];
      await persistGallery(next, 'ADMIN_GALERIA_PRIVADA', `Galería privada creada para ${galleryClient.trim()}`);
      setSelectedGalleryId(galleryId);
      setGalleryClient('');
      setGalleryTitle('');
      notify('Galería privada creada.');
    } catch (error: any) {
      notify(error?.message || 'No se pudo crear la galería.');
    } finally {
      setBusy(false);
    }
  };

  const uploadPrivateImages = async () => {
    if (!session || !selectedGallery || !privateFiles.length) return;
    setBusy(true);
    try {
      const added: GalleryImage[] = [];
      for (const file of privateFiles) {
        if (!file.type.startsWith('image/')) continue;
        const uploaded = await adminUploadMedia(session, file, {
          title: titleFromFilename(file.name),
          category: 'private',
          location: selectedGallery.clientName,
        });
        added.push({
          id: uploaded.fileId,
          title: titleFromFilename(file.name),
          category: 'private',
          url: uploaded.url,
          location: selectedGallery.clientName,
          visibility: 'private',
          mediaType: 'image',
          galleryId: selectedGallery.galleryId,
          gallerySlug: selectedGallery.slug,
          galleryTitle: selectedGallery.title,
          galleryClient: selectedGallery.clientName,
          downloadUrl: driveDownloadUrl(uploaded.fileId),
          previewUrl: uploaded.url,
          createdAt: new Date().toISOString(),
        });
      }
      const ids = new Set(added.map((item) => item.id));
      const next = [...added, ...galleryImages.filter((item) => !ids.has(item.id))];
      await persistGallery(next, 'ADMIN_GALERIA_PRIVADA', `${added.length} fotografías agregadas a ${selectedGallery.title}`);
      setPrivateFiles([]);
      notify(`${added.length} fotografías agregadas.`);
    } catch (error: any) {
      notify(error?.message || 'No se pudieron agregar las fotografías.');
    } finally {
      setBusy(false);
    }
  };

  const registerPrivateDriveFile = async () => {
    if (!session || !selectedGallery) return;
    const fileId = extractDriveFileId(driveMediaUrl);
    if (!fileId) return notify('No pude identificar el archivo de Google Drive.');
    setBusy(true);
    try {
      const preview = driveMediaType === 'video' ? drivePreviewUrl(fileId) : `https://lh3.googleusercontent.com/d/${fileId}`;
      const record: GalleryImage = {
        id: fileId,
        title: driveMediaTitle.trim() || (driveMediaType === 'video' ? 'Video del evento' : 'Fotografía'),
        category: 'private',
        url: preview,
        location: selectedGallery.clientName,
        visibility: 'private',
        mediaType: driveMediaType,
        galleryId: selectedGallery.galleryId,
        gallerySlug: selectedGallery.slug,
        galleryTitle: selectedGallery.title,
        galleryClient: selectedGallery.clientName,
        downloadUrl: driveDownloadUrl(fileId),
        previewUrl: preview,
        createdAt: new Date().toISOString(),
      };
      const next = [record, ...galleryImages.filter((item) => item.id !== fileId)];
      await persistGallery(next, 'ADMIN_GALERIA_PRIVADA', `Archivo de Drive agregado a ${selectedGallery.title}`);
      setDriveMediaUrl('');
      setDriveMediaTitle('');
      notify('Archivo agregado a la galería privada.');
    } catch (error: any) {
      notify(error?.message || 'No se pudo registrar el archivo.');
    } finally {
      setBusy(false);
    }
  };

  const privateLink = (gallery: PrivateGallerySummary) => `${window.location.origin}/?galeria=${encodeURIComponent(gallery.slug)}&k=${encodeURIComponent(gallery.token)}`;

  if (!session) {
    return (
      <main className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl bg-[#161C28] border border-white/10 p-7 space-y-5 shadow-2xl">
          <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center"><Shield className="w-5 h-5 text-[#D4AF37]" /></div><div><h1 className="text-xl font-bold">Administrador XPH</h1><p className="text-xs text-gray-400">Paquetes, portadas y galerías</p></div></div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo de administrador" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white" required />
          {authError && <p className="text-sm text-rose-400">{authError}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-40">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}Entrar</button>
          <a href="/" className="block text-center text-xs text-gray-400">Volver al sitio</a>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F17] text-white py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">XPH Fotografía & Video</p><h1 className="text-3xl font-bold">Administrador</h1><p className="text-sm text-gray-400">Administra paquetes, imágenes, portadas y galerías privadas.</p></div><div className="flex gap-2"><button onClick={() => refresh(session).then(() => notify('Drive y configuración actualizados.')).catch((e) => notify(e.message))} className="px-4 py-2.5 rounded-xl border border-white/15 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />Actualizar Drive</button><a href="/" className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm">Ver sitio</a></div></header>

        {message && <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#F5D76E]">{message}</div>}

        <nav className="flex overflow-x-auto gap-2 p-1.5 rounded-2xl bg-[#161C28] border border-white/10">
          {[
            { id: 'packages' as Tab, label: 'Paquetes & precios', icon: PackagePlus },
            { id: 'public' as Tab, label: 'Galería pública', icon: Camera },
            { id: 'covers' as Tab, label: 'Portadas', icon: ImageIcon },
            { id: 'private' as Tab, label: 'Galerías privadas', icon: FolderLock },
          ].map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap flex items-center gap-2 ${tab === item.id ? 'bg-[#D4AF37] text-black' : 'text-gray-300 hover:bg-white/5'}`}><Icon className="w-4 h-4" />{item.label}</button>; })}
        </nav>

        {tab === 'packages' && <section className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div className="flex overflow-x-auto gap-2">{(Object.keys(CATEGORY_LABELS) as EventType[]).map((item) => <button key={item} onClick={() => setActiveCategory(item)} className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap ${activeCategory === item ? 'bg-white text-black' : 'bg-[#161C28] border border-white/10 text-gray-300'}`}>{CATEGORY_LABELS[item]}</button>)}</div><div className="flex gap-2"><button onClick={addPackage} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo paquete</button><button onClick={saveCatalog} className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center gap-2"><Save className="w-4 h-4" />Guardar y publicar</button></div></div>
          <div className="grid lg:grid-cols-2 gap-5">{packages[activeCategory].map((pkg) => <article key={pkg.id} className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4"><div className="flex gap-2"><input value={pkg.name} onChange={(e) => updatePackage(pkg.id, { name: e.target.value })} className="flex-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 font-semibold" /><button onClick={() => setPackages((prev) => ({ ...prev, [activeCategory]: prev[activeCategory].filter((item) => item.id !== pkg.id) }))} className="p-3 rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4" /></button></div><div className="grid sm:grid-cols-2 gap-3"><label className="text-[11px] text-gray-500">Precio MXN<input type="number" min="0" value={pkg.price} onChange={(e) => updatePackage(pkg.id, { price: Number(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /></label><label className="text-[11px] text-gray-500">Insignia<input value={pkg.badge || ''} onChange={(e) => updatePackage(pkg.id, { badge: e.target.value })} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /></label></div><textarea value={pkg.description} onChange={(e) => updatePackage(pkg.id, { description: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><textarea value={pkg.features.join('\n')} onChange={(e) => updatePackage(pkg.id, { features: splitLines(e.target.value) })} rows={6} className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" placeholder="Un servicio incluido por línea" /></article>)}</div>
          <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4"><div className="flex justify-between"><h2 className="text-xl font-bold">Adicionales</h2><button onClick={() => setAddons((prev) => [...prev, { id: `addon_${Date.now()}`, name: 'Nuevo adicional', price: 0, description: '', type: 'checkbox', managedByAdmin: true }])} className="px-3 py-2 rounded-xl bg-white/5 text-xs">Nuevo adicional</button></div><div className="grid md:grid-cols-2 gap-3">{addons.map((addon, index) => <div key={addon.id} className="p-4 rounded-xl bg-[#0B0F17] border border-white/10 space-y-2"><div className="flex gap-2"><input value={addon.name} onChange={(e) => setAddons((prev) => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="flex-1 px-3 py-2 rounded-lg bg-[#161C28] border border-white/10" /><button onClick={() => setAddons((prev) => prev.filter((_, i) => i !== index))} className="p-2 rounded-lg bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4" /></button></div><input type="number" min="0" value={addon.price} onChange={(e) => setAddons((prev) => prev.map((item, i) => i === index ? { ...item, price: Number(e.target.value) || 0 } : item))} className="w-full px-3 py-2 rounded-lg bg-[#161C28] border border-white/10" /><textarea value={addon.description} onChange={(e) => setAddons((prev) => prev.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} rows={2} className="w-full px-3 py-2 rounded-lg bg-[#161C28] border border-white/10" /></div>)}</div></div>
        </section>}

        {tab === 'public' && <section className="space-y-6">
          <div className="rounded-2xl bg-[#161C28] border border-white/10 p-6 space-y-4"><h2 className="text-xl font-bold">Subir imágenes nuevas</h2><div className="grid md:grid-cols-2 gap-3"><select value={publicCategory} onChange={(e) => setPublicCategory(e.target.value as Exclude<GalleryCategory, 'all'>)} className="px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10">{PUBLIC_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><input value={publicLocation} onChange={(e) => setPublicLocation(e.target.value)} placeholder="Ubicación" className="px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10" /></div><input type="file" accept="image/*" multiple onChange={(e) => setPublicFiles(Array.from(e.target.files || []))} className="block w-full text-sm text-gray-300" /><button onClick={uploadPublicFiles} disabled={!publicFiles.length || busy} className="px-5 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center gap-2 disabled:opacity-40"><Upload className="w-4 h-4" />Subir {publicFiles.length || ''} imágenes</button></div>

          <div className="rounded-2xl bg-[#161C28] border border-white/10 p-6 space-y-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Imágenes que ya están en Google Drive</h2><p className="text-xs text-gray-400">Selecciona varias y asígnalas a la sección elegida arriba.</p></div><button onClick={() => refresh(session).then(() => notify('Drive actualizado.')).catch((e) => notify(e.message))} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />Recargar Drive</button></div>{driveImages.length === 0 ? <div className="p-8 rounded-xl bg-[#0B0F17] border border-white/10 text-center text-sm text-gray-400">No se recibieron imágenes desde Drive. Pulsa “Recargar Drive”.</div> : <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[560px] overflow-auto">{driveImages.map((item) => { const selected = selectedDriveIds.includes(item.id); return <button key={item.id} onClick={() => setSelectedDriveIds((prev) => selected ? prev.filter((id) => id !== item.id) : [...prev, item.id])} className={`relative rounded-xl overflow-hidden border ${selected ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-white/10'}`}><img src={item.url} alt={item.name} className="w-full aspect-square object-cover" loading="lazy" /><div className="p-2 bg-[#0B0F17] text-[10px] truncate">{item.name}</div>{selected && <span className="absolute top-2 right-2 bg-[#D4AF37] text-black rounded-full p-1"><CheckCircle2 className="w-4 h-4" /></span>}</button>; })}</div>}<div className="flex flex-col sm:flex-row justify-between gap-3"><div className="flex gap-2"><button onClick={() => setSelectedDriveIds(driveImages.map((item) => item.id))} className="px-3 py-2 rounded-lg bg-white/5 text-xs">Seleccionar todas</button><button onClick={() => setSelectedDriveIds([])} className="px-3 py-2 rounded-lg bg-white/5 text-xs">Limpiar</button></div><button onClick={registerDriveSelection} disabled={!selectedDriveIds.length || busy} className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm disabled:opacity-40">Registrar {selectedDriveIds.length || ''} en {PUBLIC_CATEGORIES.find((item) => item.value === publicCategory)?.label}</button></div></div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">{publicImages.map((image) => <div key={image.id} className="rounded-xl overflow-hidden bg-[#161C28] border border-white/10"><img src={image.url} alt={image.title} className="w-full aspect-square object-cover" /><div className="p-2"><p className="text-xs truncate">{image.title}</p><p className="text-[10px] text-gray-500">{image.category}</p></div></div>)}</div>
        </section>}

        {tab === 'covers' && <section className="space-y-6">
          <div className="rounded-2xl bg-[#161C28] border border-white/10 p-6 space-y-4"><div><h2 className="text-xl font-bold">Imagen principal por categoría</h2><p className="text-xs text-gray-400">Elige qué imagen aparece en el encabezado de cada sección.</p></div><div className="flex flex-wrap gap-2">{(Object.keys(COVER_LABELS) as RoutePath[]).map((route) => <button key={route} onClick={() => setCoverRoute(route)} className={`px-4 py-2.5 rounded-xl text-xs font-semibold ${coverRoute === route ? 'bg-[#D4AF37] text-black' : 'bg-[#0B0F17] border border-white/10'}`}>{COVER_LABELS[route]}</button>)}</div>{currentCover && <div className="max-w-xl rounded-xl overflow-hidden border border-[#D4AF37]/30"><img src={currentCover.url} alt={currentCover.title} className="w-full aspect-video object-cover" /><div className="p-3 bg-[#0B0F17] text-sm">Portada actual: {currentCover.title}</div></div>}
            <div className="pt-4 border-t border-white/10 space-y-3"><h3 className="font-semibold">Subir una portada nueva</h3><input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-300" /><button onClick={uploadCover} disabled={!coverFile || busy} className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm disabled:opacity-40">Subir y usar como portada</button></div>
          </div>

          <div className="rounded-2xl bg-[#161C28] border border-white/10 p-6 space-y-4"><div className="flex items-center justify-between"><div><h3 className="font-bold">Elegir una imagen existente de Drive</h3><p className="text-xs text-gray-400">No necesitas volver a subirla.</p></div><button onClick={() => refresh(session).then(() => notify('Drive actualizado.')).catch((e) => notify(e.message))} className="px-3 py-2 rounded-xl bg-white/5 text-xs flex items-center gap-2"><RefreshCw className="w-4 h-4" />Recargar</button></div><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[560px] overflow-auto">{driveImages.map((item) => <button key={item.id} onClick={() => setCoverFromUrl(item.url, titleFromFilename(item.name))} className="rounded-xl overflow-hidden border border-white/10 hover:border-[#D4AF37]"><img src={item.url} alt={item.name} className="w-full aspect-square object-cover" /><div className="p-2 bg-[#0B0F17] text-[10px] truncate">Usar: {item.name}</div></button>)}</div></div>
        </section>}

        {tab === 'private' && <section className="grid lg:grid-cols-[340px_1fr] gap-6">
          <aside className="space-y-4"><div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-3"><h2 className="font-bold">Nueva galería privada</h2><input value={galleryClient} onChange={(e) => setGalleryClient(e.target.value)} placeholder="Nombre del cliente" className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><input value={galleryTitle} onChange={(e) => setGalleryTitle(e.target.value)} placeholder="Ej. Boda Nalleli & Omar" className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><button onClick={createPrivateGallery} disabled={!galleryClient.trim() || !galleryTitle.trim() || busy} className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm">Crear galería</button></div>{privateGalleries.map((gallery) => <button key={gallery.galleryId} onClick={() => setSelectedGalleryId(gallery.galleryId)} className={`w-full text-left p-4 rounded-xl border ${selectedGalleryId === gallery.galleryId ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/10 bg-[#161C28]'}`}><p className="font-semibold text-sm">{gallery.title}</p><p className="text-xs text-gray-400">{gallery.clientName} · {gallery.mediaCount} archivos</p></button>)}</aside>
          <div>{!selectedGallery ? <div className="rounded-2xl bg-[#161C28] border border-white/10 p-10 text-center text-gray-400">Selecciona o crea una galería.</div> : <div className="space-y-5"><div className="rounded-2xl bg-[#161C28] border border-[#D4AF37]/30 p-5 space-y-3"><h2 className="text-2xl font-bold">{selectedGallery.title}</h2><p className="text-sm text-gray-400">{selectedGallery.clientName}</p><div className="flex gap-2"><input readOnly value={privateLink(selectedGallery)} className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-xs" /><button onClick={() => navigator.clipboard.writeText(privateLink(selectedGallery)).then(() => notify('Liga privada copiada.'))} className="px-3 rounded-xl bg-white/5 border border-white/10"><Clipboard className="w-4 h-4" /></button><a href={privateLink(selectedGallery)} target="_blank" rel="noreferrer" className="px-3 rounded-xl bg-white/5 border border-white/10 flex items-center"><ExternalLink className="w-4 h-4" /></a></div></div>
            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-3"><h3 className="font-bold">Subir fotografías</h3><input type="file" accept="image/*" multiple onChange={(e) => setPrivateFiles(Array.from(e.target.files || []))} className="block w-full text-sm text-gray-300" /><button onClick={uploadPrivateImages} disabled={!privateFiles.length || busy} className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm">Agregar {privateFiles.length || ''} fotografías</button></div>
            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-3"><h3 className="font-bold">Agregar archivo desde Google Drive</h3><p className="text-xs text-gray-400">Para videos, sube el archivo a Drive y pega aquí la liga. El cliente tendrá reproducción y botón de descarga.</p><div className="grid sm:grid-cols-[120px_1fr] gap-2"><select value={driveMediaType} onChange={(e) => setDriveMediaType(e.target.value as 'image' | 'video')} className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10"><option value="video">Video</option><option value="image">Imagen</option></select><input value={driveMediaTitle} onChange={(e) => setDriveMediaTitle(e.target.value)} placeholder="Título" className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /></div><input value={driveMediaUrl} onChange={(e) => setDriveMediaUrl(e.target.value)} placeholder="Liga del archivo de Google Drive" className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><button onClick={registerPrivateDriveFile} disabled={!driveMediaUrl.trim() || busy} className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm flex items-center gap-2"><FileVideo2 className="w-4 h-4 text-[#D4AF37]" />Registrar archivo</button></div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{selectedGalleryMedia.map((media) => <div key={media.id} className="rounded-xl overflow-hidden bg-[#161C28] border border-white/10">{media.mediaType === 'video' ? <div className="aspect-video bg-black flex items-center justify-center"><FileVideo2 className="w-10 h-10 text-[#D4AF37]" /></div> : <img src={media.url} alt={media.title} className="w-full aspect-square object-cover" />}<div className="p-3"><p className="text-sm font-semibold truncate">{media.title}</p><p className="text-[10px] uppercase text-gray-500">{media.mediaType}</p></div></div>)}</div></div>}</div>
        </section>}
      </div>
    </main>
  );
};
