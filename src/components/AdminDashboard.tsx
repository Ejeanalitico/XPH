import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  Clipboard,
  ExternalLink,
  FileVideo2,
  FolderLock,
  ImagePlus,
  Loader2,
  LogIn,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Settings2,
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
} from '../types';
import { uploadImageToGoogleDrive } from '../utils/googleDrive';
import {
  AdminSession,
  adminLogin,
  driveDownloadUrl,
  drivePreviewUrl,
  extractDriveFileId,
  loadAdminConfig,
  saveAdminConfig,
} from '../utils/adminApi';

const CATEGORY_LABELS: Record<EventType, string> = {
  bodas: 'Bodas',
  'xv-anos': 'XV Años',
  bautizos: 'Bautizos & Familia',
  retratos: 'Retratos & Editorial',
  empresarial: 'Empresarial & Branding',
};

const GALLERY_CATEGORIES: Array<{ value: Exclude<GalleryCategory, 'all'>; label: string }> = [
  { value: 'bodas', label: 'Bodas' },
  { value: 'xv-anos', label: 'XV Años' },
  { value: 'bautizos', label: 'Bautizos & Familia' },
  { value: 'retratos', label: 'Retratos & Editorial' },
  { value: 'empresarial', label: 'Empresarial & Branding' },
  { value: 'previa', label: 'Sesión previa / Save the date' },
];

type Tab = 'packages' | 'public-gallery' | 'private-galleries';

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const randomToken = () => {
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  return Array.from(array).map((value) => value.toString(36)).join('');
};

const splitLines = (value: string) =>
  value.split('\n').map((item) => item.trim()).filter(Boolean);

const isManagedCatalog = (packages: Record<string, PackageOption[]> | undefined) =>
  Boolean(packages && Object.values(packages).flat().some((pkg) => pkg?.managedByAdmin));

const getGallerySummaries = (items: GalleryImage[]): PrivateGallerySummary[] => {
  const metas = items.filter((item) => item.visibility === 'private' && item.mediaType === 'gallery-meta');
  return metas.map((meta) => ({
    galleryId: meta.galleryId || meta.id,
    slug: meta.gallerySlug || '',
    title: meta.galleryTitle || meta.title,
    clientName: meta.galleryClient || 'Cliente XPH',
    token: meta.galleryToken || '',
    createdAt: meta.createdAt || '',
    mediaCount: items.filter((item) => item.galleryId === meta.galleryId && item.mediaType !== 'gallery-meta').length,
  }));
};

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
  const [activeCategory, setActiveCategory] = useState<EventType>('bodas');

  const [publicCategory, setPublicCategory] = useState<Exclude<GalleryCategory, 'all'>>('bodas');
  const [publicLocation, setPublicLocation] = useState('CDMX');
  const [publicFiles, setPublicFiles] = useState<File[]>([]);
  const [uploadingPublic, setUploadingPublic] = useState(false);

  const [galleryClient, setGalleryClient] = useState('');
  const [galleryTitle, setGalleryTitle] = useState('');
  const [selectedGalleryId, setSelectedGalleryId] = useState('');
  const [privateFiles, setPrivateFiles] = useState<File[]>([]);
  const [uploadingPrivate, setUploadingPrivate] = useState(false);
  const [driveMediaUrl, setDriveMediaUrl] = useState('');
  const [driveMediaTitle, setDriveMediaTitle] = useState('');
  const [driveMediaType, setDriveMediaType] = useState<'image' | 'video'>('video');

  const privateGalleries = useMemo(() => getGallerySummaries(galleryImages), [galleryImages]);
  const selectedGallery = privateGalleries.find((item) => item.galleryId === selectedGalleryId) || null;
  const selectedGalleryMedia = galleryImages.filter(
    (item) => item.galleryId === selectedGalleryId && item.mediaType !== 'gallery-meta'
  );

  const publicImages = galleryImages.filter((item) =>
    item.visibility !== 'private' && item.mediaType !== 'gallery-meta' && item.category !== 'private'
  );

  const refreshAdminData = async (activeSession: AdminSession) => {
    const config = await loadAdminConfig(activeSession);
    const cloudPackages = config.packages as Record<EventType, PackageOption[]> | undefined;
    const cloudAddons = config.addons as AddOnOption[] | undefined;
    setPackages(isManagedCatalog(cloudPackages) ? cloudPackages! : PACKAGES_BY_EVENT);
    setAddons(Array.isArray(cloudAddons) && cloudAddons.some((addon) => addon?.managedByAdmin) ? cloudAddons : ADDONS_CATALOG);
    setGalleryImages(Array.isArray(config.galleryImages) ? config.galleryImages : []);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      const nextSession = await adminLogin(email, password);
      setSession(nextSession);
      await refreshAdminData(nextSession);
    } catch (error: any) {
      setAuthError(error?.message || 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 5000);
  };

  const saveCatalog = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const managedPackages = Object.fromEntries(
        Object.entries(packages).map(([category, list]) => [
          category,
          list.map((pkg) => ({ ...pkg, managedByAdmin: true })),
        ])
      ) as Record<EventType, PackageOption[]>;
      const managedAddons = addons.map((addon) => ({ ...addon, managedByAdmin: true }));
      await saveAdminConfig(
        session,
        { packages: managedPackages, addons: managedAddons },
        'ADMIN_PAQUETES',
        'Paquetes y adicionales actualizados desde el administrador web'
      );
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
    const id = `pkg_${activeCategory}_${Date.now()}`;
    setPackages((prev) => ({
      ...prev,
      [activeCategory]: [
        ...prev[activeCategory],
        {
          id,
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

  const deletePackage = (id: string) => {
    setPackages((prev) => ({
      ...prev,
      [activeCategory]: prev[activeCategory].filter((pkg) => pkg.id !== id),
    }));
  };

  const addAddon = () => {
    setAddons((prev) => [
      ...prev,
      {
        id: `addon_${Date.now()}`,
        name: 'Nuevo adicional',
        price: 0,
        description: 'Descripción del adicional.',
        type: 'checkbox',
        managedByAdmin: true,
      },
    ]);
  };

  const handlePublicUpload = async () => {
    if (!session || publicFiles.length === 0) return;
    setUploadingPublic(true);
    try {
      const added: GalleryImage[] = [];
      for (const file of publicFiles) {
        if (!file.type.startsWith('image/')) continue;
        const result = await uploadImageToGoogleDrive(file, file.name, {
          title: file.name.replace(/\.[^/.]+$/, ''),
          category: publicCategory,
          location: publicLocation || 'CDMX',
        });
        if (!result.isDrive) throw new Error(`No se pudo subir ${file.name}`);
        added.push({
          id: result.fileId,
          title: file.name.replace(/\.[^/.]+$/, ''),
          category: publicCategory,
          url: result.url,
          location: publicLocation || 'CDMX',
          visibility: 'public',
          mediaType: 'image',
          createdAt: new Date().toISOString(),
        });
      }

      const byId = new Map<string, GalleryImage>();
      [...added, ...galleryImages].forEach((item) => byId.set(item.id, item));
      const next = Array.from(byId.values());
      await saveAdminConfig(session, { galleryImages: next }, 'ADMIN_GALERIA_PUBLICA', `${added.length} imágenes públicas cargadas`);
      setGalleryImages(next);
      setPublicFiles([]);
      notify(`${added.length} imágenes publicadas.`);
    } catch (error: any) {
      notify(error?.message || 'Error al cargar imágenes.');
    } finally {
      setUploadingPublic(false);
    }
  };

  const deletePublicImage = async (id: string) => {
    if (!session) return;
    const next = galleryImages.filter((item) => item.id !== id);
    setGalleryImages(next);
    try {
      await saveAdminConfig(session, { galleryImages: next }, 'ADMIN_GALERIA_PUBLICA', `Imagen ${id} retirada del portafolio`);
      notify('Imagen retirada del portafolio. El archivo original permanece en Drive.');
    } catch (error: any) {
      notify(error?.message || 'No se pudo retirar la imagen.');
    }
  };

  const createPrivateGallery = async () => {
    if (!session || !galleryClient.trim() || !galleryTitle.trim()) return;
    const galleryId = `gallery-${Date.now()}`;
    const slug = `${slugify(galleryClient)}-${Math.random().toString(36).slice(2, 7)}`;
    const token = randomToken();
    const meta: GalleryImage = {
      id: `meta-${galleryId}`,
      title: galleryTitle.trim(),
      category: 'private',
      url: 'data:image/x-xph-gallery-meta;base64,',
      location: '',
      visibility: 'private',
      mediaType: 'gallery-meta',
      galleryId,
      gallerySlug: slug,
      galleryTitle: galleryTitle.trim(),
      galleryClient: galleryClient.trim(),
      galleryToken: token,
      createdAt: new Date().toISOString(),
    };
    const next = [meta, ...galleryImages];
    setBusy(true);
    try {
      await saveAdminConfig(session, { galleryImages: next }, 'ADMIN_GALERIA_PRIVADA', `Galería privada creada para ${galleryClient.trim()}`);
      setGalleryImages(next);
      setSelectedGalleryId(galleryId);
      setGalleryClient('');
      setGalleryTitle('');
      notify('Galería privada creada. Ya puedes copiar su liga y cargar archivos.');
    } catch (error: any) {
      notify(error?.message || 'No se pudo crear la galería.');
    } finally {
      setBusy(false);
    }
  };

  const deletePrivateGallery = async (galleryId: string) => {
    if (!session) return;
    const next = galleryImages.filter((item) => item.galleryId !== galleryId);
    setBusy(true);
    try {
      await saveAdminConfig(session, { galleryImages: next }, 'ADMIN_GALERIA_PRIVADA', `Galería privada ${galleryId} eliminada`);
      setGalleryImages(next);
      if (selectedGalleryId === galleryId) setSelectedGalleryId('');
      notify('Galería eliminada del sitio. Los archivos originales permanecen en Drive.');
    } catch (error: any) {
      notify(error?.message || 'No se pudo eliminar la galería.');
    } finally {
      setBusy(false);
    }
  };

  const privateLink = (gallery: PrivateGallerySummary) =>
    `${window.location.origin}/?galeria=${encodeURIComponent(gallery.slug)}&k=${encodeURIComponent(gallery.token)}`;

  const uploadPrivateMedia = async () => {
    if (!session || !selectedGallery || privateFiles.length === 0) return;
    setUploadingPrivate(true);
    try {
      const added: GalleryImage[] = [];
      for (const file of privateFiles) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
        if (file.type.startsWith('video/') && file.size > 18 * 1024 * 1024) {
          throw new Error(`El video ${file.name} supera 18 MB. Súbelo directamente a Drive y regístralo con su liga en el campo inferior.`);
        }

        const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
        const result = await uploadImageToGoogleDrive(file, file.name, {
          title: file.name.replace(/\.[^/.]+$/, ''),
          category: 'private',
          location: selectedGallery.clientName,
        });
        if (!result.isDrive) throw new Error(`No se pudo subir ${file.name}`);

        added.push({
          id: result.fileId,
          title: file.name.replace(/\.[^/.]+$/, ''),
          category: 'private',
          url: result.url,
          location: selectedGallery.clientName,
          visibility: 'private',
          mediaType,
          galleryId: selectedGallery.galleryId,
          gallerySlug: selectedGallery.slug,
          galleryTitle: selectedGallery.title,
          galleryClient: selectedGallery.clientName,
          downloadUrl: driveDownloadUrl(result.fileId),
          previewUrl: mediaType === 'video' ? drivePreviewUrl(result.fileId) : result.url,
          createdAt: new Date().toISOString(),
        });
      }

      const autoUploadedIds = new Set(added.map((item) => item.id));
      const cleanExisting = galleryImages.filter((item) => !autoUploadedIds.has(item.id));
      const next = [...added, ...cleanExisting];
      await saveAdminConfig(session, { galleryImages: next }, 'ADMIN_GALERIA_PRIVADA', `${added.length} archivos agregados a ${selectedGallery.title}`);
      setGalleryImages(next);
      setPrivateFiles([]);
      notify(`${added.length} archivos agregados a la galería privada.`);
    } catch (error: any) {
      notify(error?.message || 'No se pudieron cargar los archivos.');
    } finally {
      setUploadingPrivate(false);
    }
  };

  const registerDriveMedia = async () => {
    if (!session || !selectedGallery) return;
    const fileId = extractDriveFileId(driveMediaUrl);
    if (!fileId) {
      notify('No pude identificar el ID del archivo de Google Drive.');
      return;
    }
    const record: GalleryImage = {
      id: fileId,
      title: driveMediaTitle.trim() || (driveMediaType === 'video' ? 'Video del evento' : 'Fotografía'),
      category: 'private',
      url: driveMediaType === 'image' ? `https://lh3.googleusercontent.com/d/${fileId}` : drivePreviewUrl(fileId),
      location: selectedGallery.clientName,
      visibility: 'private',
      mediaType: driveMediaType,
      galleryId: selectedGallery.galleryId,
      gallerySlug: selectedGallery.slug,
      galleryTitle: selectedGallery.title,
      galleryClient: selectedGallery.clientName,
      downloadUrl: driveDownloadUrl(fileId),
      previewUrl: driveMediaType === 'video' ? drivePreviewUrl(fileId) : `https://lh3.googleusercontent.com/d/${fileId}`,
      createdAt: new Date().toISOString(),
    };
    const next = [record, ...galleryImages.filter((item) => item.id !== fileId)];
    setBusy(true);
    try {
      await saveAdminConfig(session, { galleryImages: next }, 'ADMIN_GALERIA_PRIVADA', `Archivo de Drive agregado a ${selectedGallery.title}`);
      setGalleryImages(next);
      setDriveMediaUrl('');
      setDriveMediaTitle('');
      notify('Archivo de Drive agregado a la galería.');
    } catch (error: any) {
      notify(error?.message || 'No se pudo registrar el archivo.');
    } finally {
      setBusy(false);
    }
  };

  const removePrivateMedia = async (id: string) => {
    if (!session) return;
    const next = galleryImages.filter((item) => item.id !== id);
    setBusy(true);
    try {
      await saveAdminConfig(session, { galleryImages: next }, 'ADMIN_GALERIA_PRIVADA', `Archivo ${id} retirado de galería privada`);
      setGalleryImages(next);
      notify('Archivo retirado de la galería. El original permanece en Drive.');
    } catch (error: any) {
      notify(error?.message || 'No se pudo retirar el archivo.');
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <main className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl bg-[#161C28] border border-white/10 p-7 space-y-5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center"><Settings2 className="w-5 h-5 text-[#D4AF37]" /></div>
            <div><h1 className="text-xl font-bold">Administrador XPH</h1><p className="text-xs text-gray-400">Paquetes, galería pública y galerías privadas</p></div>
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo de administrador" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white outline-none focus:border-[#D4AF37]" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white outline-none focus:border-[#D4AF37]" required />
          {authError && <p className="text-sm text-rose-400">{authError}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}Entrar</button>
          <a href="/" className="block text-center text-xs text-gray-400 hover:text-white">Volver a la página pública</a>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F17] text-white py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div><p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">XPH Fotografía & Video</p><h1 className="text-3xl font-bold font-serif-luxury">Administrador</h1><p className="text-sm text-gray-400">Los cambios de paquetes se publican al guardar; las galerías privadas solo se ven con su liga.</p></div>
          <div className="flex gap-2"><button onClick={() => session && refreshAdminData(session).then(() => notify('Datos actualizados desde Apps Script.'))} className="px-4 py-2.5 rounded-xl border border-white/15 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />Actualizar</button><a href="/" className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm">Ver sitio</a></div>
        </header>

        {message && <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#F5D76E]">{message}</div>}

        <div className="flex overflow-x-auto gap-2 p-1.5 rounded-2xl bg-[#161C28] border border-white/10">
          {[
            { id: 'packages' as Tab, label: 'Paquetes & precios', icon: PackagePlus },
            { id: 'public-gallery' as Tab, label: 'Galería pública', icon: Camera },
            { id: 'private-galleries' as Tab, label: 'Galerías privadas', icon: FolderLock },
          ].map((item) => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => setTab(item.id)} className={`px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap flex items-center gap-2 ${tab === item.id ? 'bg-[#D4AF37] text-black' : 'text-gray-300 hover:bg-white/5'}`}><Icon className="w-4 h-4" />{item.label}</button>;
          })}
        </div>

        {tab === 'packages' && (
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex overflow-x-auto gap-2">{(Object.keys(CATEGORY_LABELS) as EventType[]).map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap ${activeCategory === category ? 'bg-white text-black' : 'bg-[#161C28] border border-white/10 text-gray-300'}`}>{CATEGORY_LABELS[category]}</button>)}</div>
              <div className="flex gap-2"><button onClick={addPackage} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo paquete</button><button onClick={saveCatalog} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center gap-2"><Save className="w-4 h-4" />Guardar y publicar</button></div>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              {packages[activeCategory].map((pkg) => (
                <article key={pkg.id} className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
                  <div className="flex justify-between gap-3"><div className="flex-1"><label className="text-[11px] text-gray-500">Nombre</label><input value={pkg.name} onChange={(e) => updatePackage(pkg.id, { name: e.target.value })} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white font-semibold" /></div><button onClick={() => deletePackage(pkg.id)} className="self-end p-3 rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4" /></button></div>
                  <div className="grid sm:grid-cols-2 gap-3"><label className="text-[11px] text-gray-500">Precio MXN<input type="number" min="0" value={pkg.price} onChange={(e) => updatePackage(pkg.id, { price: Number(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white" /></label><label className="text-[11px] text-gray-500">Insignia<input value={pkg.badge || ''} onChange={(e) => updatePackage(pkg.id, { badge: e.target.value })} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white" placeholder="Ej. Más vendido" /></label></div>
                  <label className="text-[11px] text-gray-500 block">Descripción<textarea value={pkg.description} onChange={(e) => updatePackage(pkg.id, { description: e.target.value })} rows={3} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white resize-y" /></label>
                  <label className="text-[11px] text-gray-500 block">Qué incluye · un concepto por línea<textarea value={pkg.features.join('\n')} onChange={(e) => updatePackage(pkg.id, { features: splitLines(e.target.value) })} rows={6} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white resize-y" /></label>
                  <label className="text-[11px] text-gray-500 block">No incluye · un concepto por línea<textarea value={(pkg.notIncludes || []).join('\n')} onChange={(e) => updatePackage(pkg.id, { notIncludes: splitLines(e.target.value) })} rows={3} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white resize-y" /></label>
                  <label className="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={Boolean(pkg.popular)} onChange={(e) => updatePackage(pkg.id, { popular: e.target.checked })} />Marcar como paquete destacado</label>
                </article>
              ))}
            </div>

            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Adicionales</h2><p className="text-xs text-gray-400">También se pueden editar y publicar desde aquí.</p></div><button onClick={addAddon} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo adicional</button></div>
              <div className="grid md:grid-cols-2 gap-3">{addons.map((addon, index) => <div key={addon.id} className="p-4 rounded-xl bg-[#0B0F17] border border-white/10 space-y-3"><div className="flex gap-2"><input value={addon.name} onChange={(e) => setAddons((prev) => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="flex-1 px-3 py-2 rounded-lg bg-[#161C28] border border-white/10" /><button onClick={() => setAddons((prev) => prev.filter((_, i) => i !== index))} className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4" /></button></div><div className="grid grid-cols-2 gap-2"><input type="number" min="0" value={addon.price} onChange={(e) => setAddons((prev) => prev.map((item, i) => i === index ? { ...item, price: Number(e.target.value) || 0 } : item))} className="px-3 py-2 rounded-lg bg-[#161C28] border border-white/10" /><select value={addon.type} onChange={(e) => setAddons((prev) => prev.map((item, i) => i === index ? { ...item, type: e.target.value as 'checkbox' | 'counter' } : item))} className="px-3 py-2 rounded-lg bg-[#161C28] border border-white/10"><option value="checkbox">Selección</option><option value="counter">Contador</option></select></div><textarea value={addon.description} onChange={(e) => setAddons((prev) => prev.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} rows={2} className="w-full px-3 py-2 rounded-lg bg-[#161C28] border border-white/10 resize-y" /></div>)}</div>
            </div>
          </section>
        )}

        {tab === 'public-gallery' && (
          <section className="space-y-6">
            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-6 space-y-4">
              <div><h2 className="text-xl font-bold">Carga masiva al portafolio público</h2><p className="text-xs text-gray-400">Estas imágenes se pueden visualizar, pero el sitio público no mostrará botones de descarga.</p></div>
              <div className="grid md:grid-cols-2 gap-3"><select value={publicCategory} onChange={(e) => setPublicCategory(e.target.value as Exclude<GalleryCategory, 'all'>)} className="px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10">{GALLERY_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><input value={publicLocation} onChange={(e) => setPublicLocation(e.target.value)} placeholder="Ubicación" className="px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10" /></div>
              <input type="file" accept="image/*" multiple onChange={(e) => setPublicFiles(Array.from(e.target.files || []))} className="block w-full text-sm text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-[#D4AF37] file:text-black file:font-bold" />
              <div className="flex justify-between items-center gap-3"><span className="text-xs text-gray-400">{publicFiles.length} imágenes seleccionadas</span><button onClick={handlePublicUpload} disabled={!publicFiles.length || uploadingPublic} className="px-5 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center gap-2 disabled:opacity-40">{uploadingPublic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Subir y publicar</button></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">{publicImages.map((image) => <div key={image.id} className="rounded-xl overflow-hidden bg-[#161C28] border border-white/10"><img src={image.url} alt={image.title} className="w-full aspect-square object-cover" /><div className="p-2"><p className="text-xs truncate">{image.title}</p><p className="text-[10px] text-gray-500 truncate">{image.category}</p><button onClick={() => deletePublicImage(image.id)} className="mt-2 w-full py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-[10px]">Retirar</button></div></div>)}</div>
          </section>
        )}

        {tab === 'private-galleries' && (
          <section className="grid lg:grid-cols-[360px_1fr] gap-6">
            <div className="space-y-5">
              <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-3">
                <div><h2 className="text-lg font-bold">Nueva galería de cliente</h2><p className="text-xs text-gray-400">Genera una liga privada distinta para cada cliente.</p></div>
                <input value={galleryClient} onChange={(e) => setGalleryClient(e.target.value)} placeholder="Nombre del cliente" className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" />
                <input value={galleryTitle} onChange={(e) => setGalleryTitle(e.target.value)} placeholder="Ej. Boda Nalleli & Omar" className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" />
                <button onClick={createPrivateGallery} disabled={!galleryClient.trim() || !galleryTitle.trim() || busy} className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"><FolderLock className="w-4 h-4" />Crear galería privada</button>
              </div>

              <div className="space-y-2">{privateGalleries.length === 0 ? <div className="rounded-xl border border-white/10 p-5 text-sm text-gray-400">Todavía no hay galerías privadas.</div> : privateGalleries.map((gallery) => <button key={gallery.galleryId} onClick={() => setSelectedGalleryId(gallery.galleryId)} className={`w-full text-left rounded-xl p-4 border ${selectedGalleryId === gallery.galleryId ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/10 bg-[#161C28]'}`}><div className="flex justify-between gap-2"><div><p className="font-semibold text-sm">{gallery.title}</p><p className="text-xs text-gray-400">{gallery.clientName}</p></div><span className="text-[10px] text-[#D4AF37]">{gallery.mediaCount} archivos</span></div></button>)}</div>
            </div>

            <div className="space-y-5">
              {!selectedGallery ? <div className="rounded-2xl bg-[#161C28] border border-white/10 p-10 text-center text-gray-400"><FolderLock className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Selecciona o crea una galería privada.</p></div> : <>
                <div className="rounded-2xl bg-[#161C28] border border-[#D4AF37]/30 p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><p className="text-xs text-[#D4AF37]">{selectedGallery.clientName}</p><h2 className="text-2xl font-bold">{selectedGallery.title}</h2></div><button onClick={() => deletePrivateGallery(selectedGallery.galleryId)} className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2"><Trash2 className="w-4 h-4" />Eliminar galería</button></div>
                  <div className="flex gap-2"><input readOnly value={privateLink(selectedGallery)} className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-xs text-gray-300" /><button onClick={() => navigator.clipboard.writeText(privateLink(selectedGallery)).then(() => notify('Liga privada copiada.'))} className="px-3 rounded-xl bg-white/5 border border-white/10"><Clipboard className="w-4 h-4" /></button><a href={privateLink(selectedGallery)} target="_blank" rel="noreferrer" className="px-3 rounded-xl bg-white/5 border border-white/10 flex items-center"><ExternalLink className="w-4 h-4" /></a></div>
                </div>

                <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
                  <div><h3 className="font-bold">Cargar fotos y videos</h3><p className="text-xs text-gray-400">Fotos y videos pequeños pueden subirse desde aquí. Para videos grandes, súbelos a Drive y registra la liga en el siguiente bloque.</p></div>
                  <input type="file" accept="image/*,video/*" multiple onChange={(e) => setPrivateFiles(Array.from(e.target.files || []))} className="block w-full text-sm text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-[#D4AF37] file:text-black file:font-bold" />
                  <div className="flex justify-between items-center gap-3"><span className="text-xs text-gray-400">{privateFiles.length} archivos seleccionados</span><button onClick={uploadPrivateMedia} disabled={!privateFiles.length || uploadingPrivate} className="px-5 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center gap-2 disabled:opacity-40">{uploadingPrivate ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}Agregar a galería</button></div>
                </div>

                <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-3">
                  <div><h3 className="font-bold">Registrar archivo que ya está en Google Drive</h3><p className="text-xs text-gray-400">Recomendado para videos grandes: pega la liga del archivo compartido.</p></div>
                  <div className="grid md:grid-cols-[140px_1fr] gap-2"><select value={driveMediaType} onChange={(e) => setDriveMediaType(e.target.value as 'image' | 'video')} className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10"><option value="video">Video</option><option value="image">Imagen</option></select><input value={driveMediaTitle} onChange={(e) => setDriveMediaTitle(e.target.value)} placeholder="Título del archivo" className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /></div>
                  <input value={driveMediaUrl} onChange={(e) => setDriveMediaUrl(e.target.value)} placeholder="https://drive.google.com/file/d/.../view" className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" />
                  <button onClick={registerDriveMedia} disabled={!driveMediaUrl.trim() || busy} className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm flex items-center gap-2"><FileVideo2 className="w-4 h-4 text-[#D4AF37]" />Registrar archivo</button>
                </div>

                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{selectedGalleryMedia.map((media) => <div key={media.id} className="rounded-xl overflow-hidden bg-[#161C28] border border-white/10">{media.mediaType === 'video' ? <div className="aspect-video bg-black flex items-center justify-center"><FileVideo2 className="w-10 h-10 text-[#D4AF37]" /></div> : <img src={media.url} alt={media.title} className="w-full aspect-square object-cover" />}<div className="p-3"><p className="text-sm font-semibold truncate">{media.title}</p><p className="text-[10px] uppercase text-gray-500">{media.mediaType}</p><button onClick={() => removePrivateMedia(media.id)} className="mt-2 text-[10px] text-rose-400">Retirar de la galería</button></div></div>)}</div>
              </>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
