import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  Camera,
  Check,
  CheckCircle2,
  Clipboard,
  FileVideo2,
  FolderLock,
  Image as ImageIcon,
  Loader2,
  LogIn,
  LogOut,
  Megaphone,
  PackagePlus,
  PanelBottom,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ADDONS_CATALOG, PACKAGES_BY_EVENT } from '../data/packages';
import {
  AddOnOption,
  EventType,
  FooterContact,
  FooterQuickLink,
  FooterServiceLink,
  FooterSocialLink,
  GalleryCategory,
  GalleryImage,
  HeroCoverSetting,
  PackageOption,
  PrivateGallerySummary,
  RoutePath,
  SeoSettings,
} from '../types';
import { DEFAULT_FOOTER_CONTACT, normalizeFooterContact } from '../footerConfig';
import { PromotionAdminSettings } from './PromotionAdminSettings';
import { AnalyticsAdminPanel } from './AnalyticsAdminPanel';
import { BusinessAdminPanel } from './BusinessAdminPanel';
import { setAnalyticsExcluded } from '../utils/analyticsPrivacy';
import { normalizeSeoSettings } from '../utils/seo';
import {
  AdminSession,
  DriveImageRecord,
  adminLogin,
  adminLogout,
  adminUploadMedia,
  driveDownloadUrl,
  drivePreviewUrl,
  extractDriveFileId,
  loadAdminConfig,
  loadDriveImages,
  resumeAdminSession,
  saveAdminConfig,
} from '../utils/adminApi';

type Tab = 'business' | 'packages' | 'public' | 'covers' | 'promotions' | 'analytics' | 'footer' | 'private';

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

const DEFAULT_COVER_TEXT: Record<RoutePath, { label: string; description: string }> = {
  inicio: { label: 'XPH FOTOGRAFÍA & VIDEO', description: 'Producción audiovisual para momentos, eventos y marcas.' },
  bodas: { label: 'BODAS', description: 'Fotografía y video para documentar tu historia.' },
  'xv-anos': { label: 'XV AÑOS', description: 'Cobertura y sesiones para una celebración inolvidable.' },
  bautizos: { label: 'BAUTIZOS & FAMILIA', description: 'Fotografía cercana para celebraciones familiares.' },
  retratos: { label: 'RETRATOS & EDITORIAL', description: 'Sesiones personales, creativas y editoriales.' },
  empresarial: { label: 'EMPRESARIAL & BRANDING', description: 'Contenido visual para tu marca, equipo y negocio.' },
};

const PUBLIC_CATEGORIES: Array<{ value: Exclude<GalleryCategory, 'all'>; label: string }> = [
  { value: 'bodas', label: 'Bodas' },
  { value: 'xv-anos', label: 'XV Años' },
  { value: 'bautizos', label: 'Bautizos & Familia' },
  { value: 'retratos', label: 'Retratos & Editorial' },
  { value: 'empresarial', label: 'Empresarial & Branding' },
  { value: 'previa', label: 'Sesión previa / Save the date' },
];

const titleFromFilename = (name: string) => name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Fotografía';
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const makeToken = () => {
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  return Array.from(array).map((value) => value.toString(36)).join('');
};
const hasManagedPackages = (value: any) => Boolean(value && Object.values(value).flat().some((pkg: any) => pkg?.managedByAdmin));
const hasManagedAddons = (value: any) => Array.isArray(value) && value.some((item: any) => item?.managedByAdmin);

const emptyCover = (route: RoutePath): HeroCoverSetting => ({
  url: '',
  label: DEFAULT_COVER_TEXT[route].label,
  description: DEFAULT_COVER_TEXT[route].description,
  positionX: 50,
  positionY: 50,
  zoom: 100,
});

const privateGallerySummaries = (items: GalleryImage[]): PrivateGallerySummary[] =>
  items.filter((item) => item.visibility === 'private' && item.mediaType === 'gallery-meta').map((meta) => ({
    galleryId: meta.galleryId || meta.id,
    slug: meta.gallerySlug || '',
    title: meta.galleryTitle || meta.title,
    clientName: meta.galleryClient || 'Cliente XPH',
    token: meta.galleryToken || '',
    createdAt: meta.createdAt || '',
    mediaCount: items.filter((item) => item.galleryId === meta.galleryId && item.mediaType !== 'gallery-meta').length,
    allowDownloads: meta.galleryAllowDownloads !== false,
  }));

const stablePackages = (value: Record<EventType, PackageOption[]>) =>
  JSON.stringify(value, Object.keys(value).sort());

interface Props {
  initialTab?: Tab;
}

export const UnifiedAdminDashboard: React.FC<Props> = ({ initialTab = 'packages' }) => {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [successModal, setSuccessModal] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);

  const [packages, setPackages] = useState<Record<EventType, PackageOption[]>>(PACKAGES_BY_EVENT);
  const [addons, setAddons] = useState<AddOnOption[]>(ADDONS_CATALOG);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [driveImages, setDriveImages] = useState<DriveImageRecord[]>([]);
  const [heroSettings, setHeroSettings] = useState<Partial<Record<RoutePath, HeroCoverSetting>>>({});
  const [footerContact, setFooterContact] = useState<FooterContact>(DEFAULT_FOOTER_CONTACT);
  const [seoSettings, setSeoSettings] = useState<SeoSettings>(() => normalizeSeoSettings({}));

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
  const currentCover = { ...emptyCover(coverRoute), ...(heroSettings[coverRoute] || {}) };

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 5000);
  };

  const applyConfig = (config: Record<string, any>) => {
    setPackages(hasManagedPackages(config.packages) ? config.packages : PACKAGES_BY_EVENT);
    setAddons(hasManagedAddons(config.addons) ? config.addons : ADDONS_CATALOG);
    setGalleryImages(Array.isArray(config.galleryImages) ? config.galleryImages : []);
    setHeroSettings(config.heroCoverSettings && typeof config.heroCoverSettings === 'object' ? config.heroCoverSettings : {});
    setFooterContact(normalizeFooterContact(config.footerContact));
    setSeoSettings(normalizeSeoSettings(config.seoSettings));
  };

  const refresh = async () => {
    const [config, drive] = await Promise.all([loadAdminConfig(session), loadDriveImages(session)]);
    applyConfig(config);
    setDriveImages(drive);
  };

  useEffect(() => {
    let mounted = true;
    resumeAdminSession()
      .then(async (restored) => {
        if (!mounted) return;
        setSession(restored);
        if (restored) {
          setAnalyticsExcluded(true);
          const [config, drive] = await Promise.all([loadAdminConfig(restored), loadDriveImages(restored)]);
          if (!mounted) return;
          applyConfig(config);
          setDriveImages(drive);
        }
      })
      .catch(() => setSession(null))
      .finally(() => mounted && setCheckingSession(false));
    return () => { mounted = false; };
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      const next = await adminLogin(email, password);
      setAnalyticsExcluded(true);
      setSession(next);
      const [config, drive] = await Promise.all([loadAdminConfig(next), loadDriveImages(next)]);
      applyConfig(config);
      setDriveImages(drive);
      setPassword('');
    } catch (error: any) {
      setAuthError(error?.message || 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setSession(null);
    setEmail('');
    setPassword('');
  };

  const saveCatalog = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const managedPackages = Object.fromEntries(
        (Object.entries(packages) as [EventType, PackageOption[]][]).map(([key, list]) => [key, list.map((pkg) => ({ ...pkg, managedByAdmin: true, features: pkg.features.filter((x) => x.trim()) }))])
      ) as Record<EventType, PackageOption[]>;
      const managedAddons = addons.map((addon) => ({ ...addon, managedByAdmin: true }));
      const confirmed = await saveAdminConfig(session, { packages: managedPackages, addons: managedAddons }, 'ADMIN_PAQUETES', 'Paquetes y adicionales actualizados desde el administrador web');
      if (!hasManagedPackages(confirmed.packages) || !hasManagedAddons(confirmed.addons)) throw new Error('La nube no devolvió el catálogo guardado.');
      if (stablePackages(confirmed.packages) !== stablePackages(managedPackages)) throw new Error('Los paquetes no coinciden después del guardado. Vuelve a intentarlo.');
      setPackages(confirmed.packages);
      setAddons(confirmed.addons);
      setSuccessModal(true);
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

  const updateFeature = (pkg: PackageOption, index: number, value: string) => {
    const features = [...pkg.features];
    features[index] = value;
    updatePackage(pkg.id, { features });
  };

  const addFeatureAfter = (pkg: PackageOption, index: number) => {
    const features = [...pkg.features];
    features.splice(index + 1, 0, '');
    updatePackage(pkg.id, { features });
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`[data-feature="${pkg.id}-${index + 1}"]`);
      input?.focus();
    });
  };

  const removeFeature = (pkg: PackageOption, index: number) => {
    const features = pkg.features.filter((_, i) => i !== index);
    updatePackage(pkg.id, { features: features.length ? features : [''] });
  };

  const addPackage = () => {
    setPackages((prev) => ({
      ...prev,
      [activeCategory]: [...prev[activeCategory], {
        id: `pkg_${activeCategory}_${Date.now()}`,
        name: 'NUEVO PAQUETE',
        price: 0,
        description: '',
        features: [''],
        notIncludes: [],
        managedByAdmin: true,
      }],
    }));
  };

  const addAddon = () => setAddons((prev) => [...prev, {
    id: `addon_${Date.now()}`,
    name: 'Nuevo adicional',
    price: 0,
    description: '',
    type: 'checkbox',
    managedByAdmin: true,
  }]);

  const persistGallery = async (next: GalleryImage[], type: string, details: string) => {
    const confirmed = await saveAdminConfig(session, { galleryImages: next }, type, details);
    const saved = Array.isArray(confirmed.galleryImages) ? confirmed.galleryImages : next;
    setGalleryImages(saved);
    return saved;
  };

  const uploadPublicFiles = async () => {
    if (!session || !publicFiles.length) return;
    setBusy(true);
    try {
      const added: GalleryImage[] = [];
      for (const file of publicFiles) {
        if (!file.type.startsWith('image/')) continue;
        const uploaded = await adminUploadMedia(session, file, { title: titleFromFilename(file.name), category: publicCategory, location: publicLocation || 'CDMX' });
        added.push({ id: uploaded.fileId, title: titleFromFilename(file.name), category: publicCategory, url: uploaded.url, location: publicLocation || 'CDMX', visibility: 'public', mediaType: 'image', createdAt: new Date().toISOString() });
      }
      const ids = new Set(added.map((item) => item.id));
      await persistGallery([...added, ...galleryImages.filter((item) => !ids.has(item.id))], 'ADMIN_GALERIA_PUBLICA', `${added.length} imágenes públicas cargadas`);
      setPublicFiles([]);
      notify(`${added.length} imágenes publicadas.`);
    } catch (error: any) { notify(error?.message || 'No se pudieron subir las imágenes.'); }
    finally { setBusy(false); }
  };

  const registerDriveSelection = async () => {
    if (!session || !selectedDriveIds.length) return;
    setBusy(true);
    try {
      const selected = driveImages.filter((item) => selectedDriveIds.includes(item.id));
      const ids = new Set(selected.map((item) => item.id));
      const records: GalleryImage[] = selected.map((item) => ({ id: item.id, title: titleFromFilename(item.name), category: publicCategory, url: item.url, location: publicLocation || 'CDMX', visibility: 'public', mediaType: 'image', createdAt: item.createdTime || new Date().toISOString() }));
      await persistGallery([...records, ...galleryImages.filter((item) => !ids.has(item.id))], 'ADMIN_GALERIA_DRIVE', `${records.length} imágenes existentes de Drive registradas`);
      setSelectedDriveIds([]);
      notify(`${records.length} imágenes de Drive registradas.`);
    } catch (error: any) { notify(error?.message || 'No se pudieron registrar las imágenes de Drive.'); }
    finally { setBusy(false); }
  };

  const updateCover = (patch: Partial<HeroCoverSetting>) => {
    setHeroSettings((prev) => ({ ...prev, [coverRoute]: { ...emptyCover(coverRoute), ...(prev[coverRoute] || {}), ...patch } }));
  };

  const uploadCover = async () => {
    if (!session || !coverFile) return;
    setBusy(true);
    try {
      const uploaded = await adminUploadMedia(session, coverFile, { title: `Portada ${COVER_LABELS[coverRoute]}`, category: coverRoute === 'inicio' ? 'bodas' : coverRoute, location: 'Portada XPH' });
      updateCover({ url: uploaded.url, positionX: 50, positionY: 50, zoom: 100 });
      setCoverFile(null);
      notify('Imagen cargada. Ajusta el encuadre y guarda la portada.');
    } catch (error: any) { notify(error?.message || 'No se pudo subir la portada.'); }
    finally { setBusy(false); }
  };

  const saveCover = async () => {
    if (!session || !currentCover.url) return;
    setBusy(true);
    try {
      const next = { ...heroSettings, [coverRoute]: currentCover };
      const confirmed = await saveAdminConfig(session, { heroCoverSettings: next }, 'ADMIN_PORTADA_AVANZADA', `Portada, texto y encuadre de ${coverRoute} actualizados`);
      const confirmedSetting = confirmed.heroCoverSettings?.[coverRoute];
      if (!confirmedSetting?.url || confirmedSetting.url !== currentCover.url) throw new Error('La portada no quedó confirmada en la nube.');
      setHeroSettings(confirmed.heroCoverSettings);
      notify(`Portada de ${COVER_LABELS[coverRoute]} guardada y publicada.`);
    } catch (error: any) { notify(error?.message || 'No se pudo guardar la portada.'); }
    finally { setBusy(false); }
  };

  const patchFooter = <K extends keyof FooterContact>(key: K, value: FooterContact[K]) => {
    setFooterContact((prev) => ({ ...prev, [key]: value }));
  };

  const saveFooter = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const next = normalizeFooterContact(footerContact);
      const confirmed = await saveAdminConfig(session, { footerContact: next }, 'ADMIN_PIE_PAGINA', 'Pie de página, contacto, servicios y redes sociales actualizados');
      const saved = normalizeFooterContact(confirmed.footerContact);
      if (JSON.stringify(saved) !== JSON.stringify(next)) throw new Error('El pie de página no coincide con la configuración guardada.');
      setFooterContact(saved);
      notify('Pie de página guardado y publicado.');
    } catch (error: any) {
      notify(error?.message || 'No se pudo guardar el pie de página.');
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
        id: `meta-${galleryId}`, title: galleryTitle.trim(), category: 'private', url: 'xph://gallery-meta', location: '', visibility: 'private', mediaType: 'gallery-meta', galleryId,
        gallerySlug: `${slugify(galleryClient)}-${Math.random().toString(36).slice(2, 7)}`, galleryTitle: galleryTitle.trim(), galleryClient: galleryClient.trim(), galleryToken: makeToken(), createdAt: new Date().toISOString(),
      };
      await persistGallery([meta, ...galleryImages], 'ADMIN_GALERIA_PRIVADA', `Galería privada creada para ${galleryClient.trim()}`);
      setSelectedGalleryId(galleryId);
      setGalleryClient(''); setGalleryTitle(''); notify('Galería privada creada.');
    } catch (error: any) { notify(error?.message || 'No se pudo crear la galería.'); }
    finally { setBusy(false); }
  };

  const uploadPrivateImages = async () => {
    if (!session || !selectedGallery || !privateFiles.length) return;
    setBusy(true);
    try {
      const added: GalleryImage[] = [];
      for (const file of privateFiles) {
        if (!file.type.startsWith('image/')) continue;
        const uploaded = await adminUploadMedia(session, file, { title: titleFromFilename(file.name), category: 'private', location: selectedGallery.clientName });
        added.push({ id: uploaded.fileId, title: titleFromFilename(file.name), category: 'private', url: uploaded.url, location: selectedGallery.clientName, visibility: 'private', mediaType: 'image', galleryId: selectedGallery.galleryId, gallerySlug: selectedGallery.slug, galleryTitle: selectedGallery.title, galleryClient: selectedGallery.clientName, downloadUrl: driveDownloadUrl(uploaded.fileId), previewUrl: uploaded.url, createdAt: new Date().toISOString() });
      }
      const ids = new Set(added.map((item) => item.id));
      await persistGallery([...added, ...galleryImages.filter((item) => !ids.has(item.id))], 'ADMIN_GALERIA_PRIVADA', `${added.length} fotografías agregadas a ${selectedGallery.title}`);
      setPrivateFiles([]); notify(`${added.length} fotografías agregadas.`);
    } catch (error: any) { notify(error?.message || 'No se pudieron agregar las fotografías.'); }
    finally { setBusy(false); }
  };

  const registerPrivateDriveFile = async () => {
    if (!session || !selectedGallery) return;
    const fileId = extractDriveFileId(driveMediaUrl);
    if (!fileId) return notify('No pude identificar el archivo de Google Drive.');
    setBusy(true);
    try {
      const preview = driveMediaType === 'video' ? drivePreviewUrl(fileId) : `https://lh3.googleusercontent.com/d/${fileId}`;
      const record: GalleryImage = { id: fileId, title: driveMediaTitle.trim() || (driveMediaType === 'video' ? 'Video del evento' : 'Fotografía'), category: 'private', url: preview, location: selectedGallery.clientName, visibility: 'private', mediaType: driveMediaType, galleryId: selectedGallery.galleryId, gallerySlug: selectedGallery.slug, galleryTitle: selectedGallery.title, galleryClient: selectedGallery.clientName, downloadUrl: driveDownloadUrl(fileId), previewUrl: preview, createdAt: new Date().toISOString() };
      await persistGallery([record, ...galleryImages.filter((item) => item.id !== fileId)], 'ADMIN_GALERIA_PRIVADA', `Archivo de Drive agregado a ${selectedGallery.title}`);
      setDriveMediaUrl(''); setDriveMediaTitle(''); notify('Archivo agregado a la galería privada.');
    } catch (error: any) { notify(error?.message || 'No se pudo registrar el archivo.'); }
    finally { setBusy(false); }
  };

  const privateLink = (gallery: PrivateGallerySummary) => `${window.location.origin}/?galeria=${encodeURIComponent(gallery.slug)}&k=${encodeURIComponent(gallery.token)}`;

  if (checkingSession) {
    return <main className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></main>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl bg-[#161C28] border border-white/10 p-7 space-y-5 shadow-2xl">
          <div><p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">XPH Fotografía & Video</p><h1 className="text-2xl font-bold mt-1">Administrador</h1><p className="text-xs text-gray-400 mt-1">Una sola sesión para paquetes, Drive, portadas y galerías privadas.</p></div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo de administrador" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white" required />
          {authError && <p className="text-sm text-rose-400">{authError}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-40">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}Entrar</button>
          <p className="text-center text-[11px] text-gray-500">El navegador recordará esta sesión hasta 30 días o hasta que cierres sesión.</p>
          <a href="/" className="block text-center text-xs text-gray-400">Volver al sitio</a>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F17] text-white py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div><p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">XPH Fotografía & Video</p><h1 className="text-3xl font-bold">Administrador</h1><p className="text-sm text-gray-400">Todo el contenido vive en este panel.</p></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => refresh().then(() => notify('Configuración y Drive actualizados.')).catch((e) => notify(e.message))} className="px-4 py-2.5 rounded-xl border border-white/15 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />Actualizar</button>
            <a href="/" className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm">Ver sitio</a>
            <button onClick={handleLogout} className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2"><LogOut className="w-4 h-4" />Cerrar sesión</button>
          </div>
        </header>

        {message && <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#F5D76E]">{message}</div>}

        <nav className="flex overflow-x-auto gap-2 p-1.5 rounded-2xl bg-[#161C28] border border-white/10">
          {[
            { id: 'business' as Tab, label: 'Clientes & negocio', icon: BriefcaseBusiness },
            { id: 'packages' as Tab, label: 'Paquetes & precios', icon: PackagePlus },
            { id: 'public' as Tab, label: 'Galería pública', icon: Camera },
            { id: 'covers' as Tab, label: 'Portadas', icon: ImageIcon },
            { id: 'promotions' as Tab, label: 'Promociones', icon: Megaphone },
            { id: 'analytics' as Tab, label: 'Tráfico y SEO', icon: BarChart3 },
            { id: 'footer' as Tab, label: 'Pie de página', icon: PanelBottom },
            { id: 'private' as Tab, label: 'Galerías privadas', icon: FolderLock },
          ].map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap flex items-center gap-2 ${tab === item.id ? 'bg-[#D4AF37] text-black' : 'text-gray-300 hover:bg-white/5'}`}><Icon className="w-4 h-4" />{item.label}</button>; })}
        </nav>

        {tab === 'business' && <BusinessAdminPanel notify={notify} />}

        {tab === 'packages' && (
          <section className="space-y-7">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex overflow-x-auto gap-2">{(Object.keys(CATEGORY_LABELS) as EventType[]).map((item) => <button key={item} onClick={() => setActiveCategory(item)} className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap ${activeCategory === item ? 'bg-white text-black' : 'bg-[#161C28] border border-white/10 text-gray-300'}`}>{CATEGORY_LABELS[item]}</button>)}</div>
              <div className="flex gap-2"><button onClick={addPackage} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo paquete</button><button onClick={saveCatalog} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center gap-2 disabled:opacity-40">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar y publicar</button></div>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              {packages[activeCategory].map((pkg) => (
                <article key={pkg.id} className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
                  <div className="flex gap-2"><input value={pkg.name} onChange={(e) => updatePackage(pkg.id, { name: e.target.value })} className="flex-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 font-semibold" /><button onClick={() => setPackages((prev) => ({ ...prev, [activeCategory]: prev[activeCategory].filter((item) => item.id !== pkg.id) }))} className="p-3 rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4" /></button></div>
                  <div className="grid sm:grid-cols-2 gap-3"><label className="text-[11px] text-gray-500">Precio MXN<input type="number" min="0" value={pkg.price} onChange={(e) => updatePackage(pkg.id, { price: Number(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /></label><label className="text-[11px] text-gray-500">Insignia<input value={pkg.badge || ''} onChange={(e) => updatePackage(pkg.id, { badge: e.target.value })} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /></label></div>
                  <label className="text-[11px] text-gray-500 block">Descripción<textarea value={pkg.description} onChange={(e) => updatePackage(pkg.id, { description: e.target.value })} rows={3} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 resize-y" /></label>

                  <div className="space-y-2 rounded-xl border border-white/10 bg-[#0B0F17]/60 p-3">
                    <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]">Servicios incluidos</span><button onClick={() => updatePackage(pkg.id, { features: [...pkg.features, ''] })} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px]">+ Agregar servicio</button></div>
                    {(pkg.features.length ? pkg.features : ['']).map((feature, index) => (
                      <div key={`${pkg.id}-${index}`} className="flex items-center gap-2">
                        <input data-feature={`${pkg.id}-${index}`} value={feature} onChange={(e) => updateFeature(pkg, index, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeatureAfter(pkg, index); } }} placeholder={`Servicio ${index + 1}`} className="min-w-0 flex-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white outline-none focus:border-[#D4AF37]" />
                        <button onClick={() => removeFeature(pkg, index)} className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xl flex items-center justify-center">×</button>
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-500">Enter crea otro recuadro. × elimina esa línea.</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Adicionales</h2><p className="text-xs text-gray-400">Se aplican al cotizador cuando tienen precio publicado.</p></div><button onClick={addAddon} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs"><Plus className="inline w-4 h-4 mr-1" />Nuevo adicional</button></div>
              <div className="space-y-3">{addons.map((addon, index) => <div key={addon.id} className="grid lg:grid-cols-[1.1fr_140px_1.5fr_120px_44px] gap-2"><input value={addon.name} onChange={(e) => setAddons((prev) => prev.map((a, i) => i === index ? { ...a, name: e.target.value } : a))} className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><input type="number" value={addon.price} onChange={(e) => setAddons((prev) => prev.map((a, i) => i === index ? { ...a, price: Number(e.target.value) || 0 } : a))} className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><input value={addon.description} onChange={(e) => setAddons((prev) => prev.map((a, i) => i === index ? { ...a, description: e.target.value } : a))} className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><select value={addon.type} onChange={(e) => setAddons((prev) => prev.map((a, i) => i === index ? { ...a, type: e.target.value as 'checkbox' | 'counter' } : a))} className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10"><option value="checkbox">Selección</option><option value="counter">Contador</option></select><button onClick={() => setAddons((prev) => prev.filter((_, i) => i !== index))} className="rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4 mx-auto" /></button></div>)}</div>
            </div>
          </section>
        )}

        {tab === 'public' && (
          <section className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4"><label className="text-xs text-gray-400">Sección<select value={publicCategory} onChange={(e) => setPublicCategory(e.target.value as Exclude<GalleryCategory, 'all'>)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#161C28] border border-white/10 text-white">{PUBLIC_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="text-xs text-gray-400">Ubicación / etiqueta<input value={publicLocation} onChange={(e) => setPublicLocation(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#161C28] border border-white/10" /></label></div>
            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4"><h2 className="text-xl font-bold">Carga masiva</h2><input type="file" accept="image/*" multiple onChange={(e) => setPublicFiles(Array.from(e.target.files || []))} /><button onClick={uploadPublicFiles} disabled={!publicFiles.length || busy} className="px-5 py-3 rounded-xl bg-[#D4AF37] text-black font-bold disabled:opacity-40"><Upload className="inline w-4 h-4 mr-2" />Subir {publicFiles.length || ''} imágenes</button></div>
            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Imágenes existentes en Google Drive</h2><p className="text-xs text-gray-400">Selecciona varias y asígnalas a la sección elegida.</p></div><button onClick={() => refresh()} className="px-4 py-2 rounded-xl border border-white/10 text-xs"><RefreshCw className="inline w-4 h-4 mr-1" />Recargar Drive</button></div><div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[560px] overflow-auto">{driveImages.map((item) => { const selected = selectedDriveIds.includes(item.id); return <button key={item.id} onClick={() => setSelectedDriveIds((prev) => selected ? prev.filter((id) => id !== item.id) : [...prev, item.id])} className={`relative rounded-xl overflow-hidden border ${selected ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-white/10'}`}><img src={item.url} alt={item.name} className="w-full aspect-square object-cover" /><div className="p-2 text-[10px] truncate">{item.name}</div>{selected && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#D4AF37] text-black flex items-center justify-center"><Check className="w-4 h-4" /></span>}</button>; })}</div><div className="flex gap-2"><button onClick={() => setSelectedDriveIds(driveImages.map((item) => item.id))} className="px-3 py-2 rounded-lg bg-white/5 text-xs">Seleccionar todas</button><button onClick={() => setSelectedDriveIds([])} className="px-3 py-2 rounded-lg bg-white/5 text-xs">Limpiar</button><button onClick={registerDriveSelection} disabled={!selectedDriveIds.length || busy} className="ml-auto px-5 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-bold disabled:opacity-40">Registrar {selectedDriveIds.length || ''}</button></div></div>
            <p className="text-xs text-gray-500">La galería pública no ofrece descargas. Actualmente hay {publicImages.length} imágenes publicadas.</p>
          </section>
        )}

        {tab === 'covers' && (
          <section className="space-y-6">
            <div className="flex overflow-x-auto gap-2">{(Object.keys(COVER_LABELS) as RoutePath[]).map((route) => <button key={route} onClick={() => setCoverRoute(route)} className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap ${coverRoute === route ? 'bg-white text-black' : 'bg-[#161C28] border border-white/10 text-gray-300'}`}>{COVER_LABELS[route]}</button>)}</div>
            <div className="grid lg:grid-cols-[1.1fr_.9fr] gap-6">
              <div className="space-y-4 rounded-2xl bg-[#161C28] border border-white/10 p-5"><h2 className="text-xl font-bold">Vista previa y recorte</h2><div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black h-[460px]">{currentCover.url ? <img src={currentCover.url} alt="Portada" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: `${currentCover.positionX}% ${currentCover.positionY}%`, transform: `scale(${currentCover.zoom / 100})` }} /> : <div className="absolute inset-0 flex items-center justify-center text-gray-500">Selecciona una imagen</div>}<div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-transparent opacity-80" /><div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[#0B0F17]/90 border border-white/10"><p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">{currentCover.label}</p><p className="text-xs text-gray-400 mt-1">{currentCover.description}</p></div></div><div className="grid sm:grid-cols-3 gap-4"><label className="text-xs text-gray-300">Horizontal {currentCover.positionX}%<input type="range" min="0" max="100" value={currentCover.positionX} onChange={(e) => updateCover({ positionX: Number(e.target.value) })} className="w-full" /></label><label className="text-xs text-gray-300">Vertical {currentCover.positionY}%<input type="range" min="0" max="100" value={currentCover.positionY} onChange={(e) => updateCover({ positionY: Number(e.target.value) })} className="w-full" /></label><label className="text-xs text-gray-300">Zoom {currentCover.zoom}%<input type="range" min="100" max="250" step="5" value={currentCover.zoom} onChange={(e) => updateCover({ zoom: Number(e.target.value) })} className="w-full" /></label></div></div>
              <div className="space-y-5"><div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4"><h2 className="text-xl font-bold">Texto de la portada</h2><label className="text-xs text-gray-400 block">Título<input value={currentCover.label} onChange={(e) => updateCover({ label: e.target.value })} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10" /></label><label className="text-xs text-gray-400 block">Descripción<textarea value={currentCover.description} onChange={(e) => updateCover({ description: e.target.value })} rows={3} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10 resize-y" /></label></div><div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-3"><h2 className="text-xl font-bold">Subir otra imagen</h2><input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} /><button onClick={uploadCover} disabled={!coverFile || busy} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-40"><Upload className="inline w-4 h-4 mr-2" />Subir portada</button></div><button onClick={saveCover} disabled={!currentCover.url || busy} className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold disabled:opacity-40"><Save className="inline w-4 h-4 mr-2" />Guardar portada</button></div>
            </div>
            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-3"><h2 className="text-xl font-bold">Elegir una imagen ya existente de Drive</h2><div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 max-h-[500px] overflow-auto">{driveImages.map((item) => <button key={item.id} onClick={() => updateCover({ url: item.url, positionX: 50, positionY: 50, zoom: 100 })} className="rounded-xl overflow-hidden border border-white/10 hover:border-[#D4AF37]"><img src={item.url} alt={item.name} className="w-full aspect-square object-cover" /><div className="p-2 text-[10px] truncate">{item.name}</div></button>)}</div></div>
          </section>
        )}

        {tab === 'promotions' && <PromotionAdminSettings adminSession={session} />}

        {tab === 'analytics' && <AnalyticsAdminPanel session={session} seoSettings={seoSettings} onSeoSettingsChange={setSeoSettings} />}

        {tab === 'footer' && (() => {
          const normalized = normalizeFooterContact(footerContact);
          const inputClass = 'mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10 text-white';
          const updateService = (index: number, patch: Partial<FooterServiceLink>) => patchFooter('services', normalized.services.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
          const updateQuickLink = (index: number, patch: Partial<FooterQuickLink>) => patchFooter('quickLinks', normalized.quickLinks.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
          const updateSocial = (index: number, patch: Partial<FooterSocialLink>) => patchFooter('socialLinks', normalized.socialLinks.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

          return (
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div><h2 className="text-2xl font-bold">Pie de página</h2><p className="text-sm text-gray-400">Edita textos, cobertura, contacto, servicios, accesos y redes sociales.</p></div>
                <button onClick={saveFooter} disabled={busy} className="px-5 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar y publicar</button>
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
                  <div><h3 className="text-lg font-bold">Marca y descripción</h3><p className="text-xs text-gray-400">Textos que aparecen junto al logotipo.</p></div>
                  <label className="text-xs text-gray-400 block">Nombre de la marca<input value={normalized.brandTitle} onChange={(e) => patchFooter('brandTitle', e.target.value)} className={inputClass} /></label>
                  <label className="text-xs text-gray-400 block">Subtítulo<input value={normalized.brandSubtitle} onChange={(e) => patchFooter('brandSubtitle', e.target.value)} className={inputClass} /></label>
                  <label className="text-xs text-gray-400 block">Descripción<textarea value={normalized.aboutText} onChange={(e) => patchFooter('aboutText', e.target.value)} rows={5} className={`${inputClass} resize-y`} /></label>
                </div>

                <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
                  <div><h3 className="text-lg font-bold">Contacto y cobertura</h3><p className="text-xs text-gray-400">La ubicación puede ser una lista de estados, ciudades o zonas de servicio.</p></div>
                  <label className="text-xs text-gray-400 block">Título de la sección<input value={normalized.contactTitle} onChange={(e) => patchFooter('contactTitle', e.target.value)} className={inputClass} /></label>
                  <label className="text-xs text-gray-400 block">Ubicaciones / cobertura<textarea value={normalized.address} onChange={(e) => patchFooter('address', e.target.value)} rows={3} className={`${inputClass} resize-y`} /></label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="text-xs text-gray-400">Teléfono<input value={normalized.phone} onChange={(e) => patchFooter('phone', e.target.value)} className={inputClass} /></label>
                    <label className="text-xs text-gray-400">WhatsApp<input value={normalized.whatsapp} onChange={(e) => patchFooter('whatsapp', e.target.value)} className={inputClass} /></label>
                    <label className="text-xs text-gray-400">Correo<input type="email" value={normalized.email} onChange={(e) => patchFooter('email', e.target.value)} className={inputClass} /></label>
                    <label className="text-xs text-gray-400">Horario / atención<input value={normalized.schedule} onChange={(e) => patchFooter('schedule', e.target.value)} className={inputClass} /></label>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Servicios</h3><p className="text-xs text-gray-400">Cada elemento abre la sección correspondiente de la página.</p></div><button onClick={() => patchFooter('services', [...normalized.services, { id: `service-${Date.now()}`, label: 'Nuevo servicio', route: 'bodas' }])} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs"><Plus className="inline w-4 h-4 mr-1" />Agregar servicio</button></div>
                <label className="text-xs text-gray-400 block">Título de la sección<input value={normalized.specialtiesTitle} onChange={(e) => patchFooter('specialtiesTitle', e.target.value)} className={inputClass} /></label>
                <div className="space-y-3">{normalized.services.map((service, index) => <div key={service.id} className="grid sm:grid-cols-[1fr_220px_44px] gap-2"><input value={service.label} onChange={(e) => updateService(index, { label: e.target.value })} className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><select value={service.route} onChange={(e) => updateService(index, { route: e.target.value as RoutePath })} className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10">{(Object.keys(COVER_LABELS) as RoutePath[]).map((route) => <option key={route} value={route}>{COVER_LABELS[route]}</option>)}</select><button onClick={() => patchFooter('services', normalized.services.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4 mx-auto" /></button></div>)}</div>
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Accesos rápidos</h3><p className="text-xs text-gray-400">Ejemplo: #cotizador, #solicitud o una liga completa.</p></div><button onClick={() => patchFooter('quickLinks', [...normalized.quickLinks, { id: `quick-${Date.now()}`, label: 'Nuevo acceso', href: '#' }])} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs"><Plus className="inline w-4 h-4 mr-1" />Agregar</button></div>
                  <label className="text-xs text-gray-400 block">Título de la sección<input value={normalized.quickLinksTitle} onChange={(e) => patchFooter('quickLinksTitle', e.target.value)} className={inputClass} /></label>
                  <div className="space-y-3">{normalized.quickLinks.map((link, index) => <div key={link.id} className="grid sm:grid-cols-[1fr_1fr_44px] gap-2"><input value={link.label} onChange={(e) => updateQuickLink(index, { label: e.target.value })} placeholder="Texto" className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><input value={link.href} onChange={(e) => updateQuickLink(index, { href: e.target.value })} placeholder="#seccion" className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><button onClick={() => patchFooter('quickLinks', normalized.quickLinks.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4 mx-auto" /></button></div>)}</div>
                </div>

                <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Redes sociales</h3><p className="text-xs text-gray-400">Agrega Instagram, Facebook, TikTok, YouTube u otra red.</p></div><button onClick={() => patchFooter('socialLinks', [...normalized.socialLinks, { id: `social-${Date.now()}`, label: 'Nueva red', url: 'https://' }])} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs"><Plus className="inline w-4 h-4 mr-1" />Agregar</button></div>
                  <label className="text-xs text-gray-400 block">Título de la sección<input value={normalized.socialTitle} onChange={(e) => patchFooter('socialTitle', e.target.value)} className={inputClass} /></label>
                  <div className="space-y-3">{normalized.socialLinks.map((social, index) => <div key={social.id} className="grid sm:grid-cols-[.7fr_1.3fr_44px] gap-2"><input value={social.label} onChange={(e) => updateSocial(index, { label: e.target.value })} placeholder="Red social" className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><input value={social.url} onChange={(e) => updateSocial(index, { url: e.target.value })} placeholder="https://..." className="px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><button onClick={() => patchFooter('socialLinks', normalized.socialLinks.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4 mx-auto" /></button></div>)}</div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5"><label className="text-xs text-gray-400 block">Texto legal / derechos reservados<input value={normalized.copyrightText} onChange={(e) => patchFooter('copyrightText', e.target.value)} className={inputClass} /></label></div>
            </section>
          );
        })()}

        {tab === 'private' && (
          <section className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-5"><div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-3"><h2 className="text-xl font-bold">Crear galería privada</h2><input value={galleryClient} onChange={(e) => setGalleryClient(e.target.value)} placeholder="Nombre del cliente" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10" /><input value={galleryTitle} onChange={(e) => setGalleryTitle(e.target.value)} placeholder="Nombre de la galería" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10" /><button onClick={createPrivateGallery} disabled={!galleryClient.trim() || !galleryTitle.trim() || busy} className="px-5 py-3 rounded-xl bg-[#D4AF37] text-black font-bold disabled:opacity-40"><FolderLock className="inline w-4 h-4 mr-2" />Crear galería</button></div><div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-3"><h2 className="text-xl font-bold">Galerías creadas</h2><div className="space-y-2 max-h-72 overflow-auto">{privateGalleries.map((gallery) => <button key={gallery.galleryId} onClick={() => setSelectedGalleryId(gallery.galleryId)} className={`w-full text-left p-3 rounded-xl border ${selectedGalleryId === gallery.galleryId ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/10 bg-[#0B0F17]'}`}><div className="font-semibold">{gallery.title}</div><div className="text-xs text-gray-400">{gallery.clientName} · {gallery.mediaCount} archivos</div></button>)}</div></div></div>
            {selectedGallery && <div className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-5"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{selectedGallery.title}</h2><p className="text-xs text-gray-400">{selectedGallery.clientName} · fotos y videos descargables</p></div><button onClick={() => navigator.clipboard.writeText(privateLink(selectedGallery)).then(() => notify('Liga privada copiada.'))} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm"><Clipboard className="inline w-4 h-4 mr-2" />Copiar liga privada</button></div><div className="grid lg:grid-cols-2 gap-5"><div className="space-y-3"><h3 className="font-semibold">Subir fotografías</h3><input type="file" accept="image/*" multiple onChange={(e) => setPrivateFiles(Array.from(e.target.files || []))} /><button onClick={uploadPrivateImages} disabled={!privateFiles.length || busy} className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm disabled:opacity-40"><Upload className="inline w-4 h-4 mr-2" />Agregar {privateFiles.length || ''} fotos</button></div><div className="space-y-3"><h3 className="font-semibold">Agregar foto o video desde Drive</h3><select value={driveMediaType} onChange={(e) => setDriveMediaType(e.target.value as 'image' | 'video')} className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10"><option value="video">Video</option><option value="image">Fotografía</option></select><input value={driveMediaUrl} onChange={(e) => setDriveMediaUrl(e.target.value)} placeholder="Liga del archivo de Google Drive" className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><input value={driveMediaTitle} onChange={(e) => setDriveMediaTitle(e.target.value)} placeholder="Título del archivo" className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10" /><button onClick={registerPrivateDriveFile} disabled={!driveMediaUrl || busy} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm"><FileVideo2 className="inline w-4 h-4 mr-2" />Agregar desde Drive</button></div></div><div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">{selectedGalleryMedia.map((item) => <div key={`${item.id}-${item.mediaType}`} className="rounded-xl overflow-hidden border border-white/10 bg-[#0B0F17]">{item.mediaType === 'video' ? <div className="aspect-square flex items-center justify-center"><FileVideo2 className="w-10 h-10 text-[#D4AF37]" /></div> : <img src={item.url} alt={item.title} className="w-full aspect-square object-cover" />}<div className="p-2 text-[10px] truncate">{item.title}</div></div>)}</div></div>}
          </section>
        )}
      </div>

      {successModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSuccessModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#161C28] border border-[#D4AF37]/40 p-7 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-emerald-400" /></div>
            <h2 className="text-2xl font-bold mt-4">Paquetes actualizados</h2>
            <p className="text-sm text-gray-400 mt-2">Los cambios fueron guardados y verificados en la configuración de producción.</p>
            <button onClick={() => setSuccessModal(false)} className="mt-6 w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold">Aceptar</button>
          </div>
        </div>
      )}
    </main>
  );
};
