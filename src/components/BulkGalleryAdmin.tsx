import React, { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, FolderOpen, Loader2, LogIn, RefreshCw, Upload, XCircle } from 'lucide-react';
import { GalleryCategory, GalleryImage } from '../types';
import {
  getDirectGoogleDriveUrl,
  loadSiteDataFromCloud,
  saveSiteDataToCloud,
  uploadImageToGoogleDrive,
} from '../utils/googleDrive';

type PublishCategory = Exclude<GalleryCategory, 'all'>;
type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';
type UploadRow = { id: string; name: string; status: UploadStatus; message?: string };
type DriveFile = { id: string; name: string; url: string; driveUrl?: string; createdTime?: string };

const CATEGORIES: Array<{ value: PublishCategory; label: string }> = [
  { value: 'bodas', label: 'Bodas' },
  { value: 'xv-anos', label: 'XV Años' },
  { value: 'bautizos', label: 'Bautizos & Familia' },
  { value: 'retratos', label: 'Retratos & Editorial' },
  { value: 'empresarial', label: 'Empresarial & Branding' },
  { value: 'previa', label: 'Sesión previa / Save the date' },
];

const normalizeTitle = (filename: string) =>
  filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Fotografía';

export const BulkGalleryAdmin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(false);

  const [category, setCategory] = useState<PublishCategory>('bodas');
  const [location, setLocation] = useState('CDMX');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [selectedDriveIds, setSelectedDriveIds] = useState<string[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [savingDriveSelection, setSavingDriveSelection] = useState(false);
  const [driveMessage, setDriveMessage] = useState('');

  const successfulUploads = useMemo(
    () => uploadRows.filter((row) => row.status === 'success').length,
    [uploadRows]
  );

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setCheckingAuth(true);
    setAuthError('');
    try {
      const response = await fetch('/api/proxy?action=adminLogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok && data?.authenticated) {
        setIsAuthenticated(true);
      } else {
        setAuthError('Credenciales incorrectas.');
      }
    } catch (_) {
      setAuthError('No se pudo validar el acceso.');
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    setFiles(selected);
    setUploadRows(selected.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      status: 'pending',
    })));
  };

  const updateUploadRow = (index: number, patch: Partial<UploadRow>) => {
    setUploadRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleBulkUpload = async () => {
    if (!files.length || isUploading) return;
    setIsUploading(true);
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      updateUploadRow(index, { status: 'uploading', message: 'Subiendo a Google Drive…' });
      try {
        const result = await uploadImageToGoogleDrive(file, file.name, {
          title: normalizeTitle(file.name),
          category,
          location: location.trim() || 'CDMX',
        });
        if (!result.isDrive) throw new Error('Apps Script no confirmó la carga en Google Drive.');
        updateUploadRow(index, { status: 'success', message: 'Drive + Galeria_Fotos + Config_Activa' });
      } catch (error: any) {
        updateUploadRow(index, { status: 'error', message: error?.message || 'Error de carga' });
      }
    }
    setIsUploading(false);
  };

  const loadDriveFolder = async () => {
    setLoadingDrive(true);
    setDriveMessage('');
    try {
      const response = await fetch(`/api/proxy?action=listDriveFolder&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || data?.status !== 'success' || !Array.isArray(data.images)) {
        throw new Error(data?.message || 'No se pudo leer la carpeta de Google Drive.');
      }
      setDriveFiles(data.images);
      setSelectedDriveIds([]);
      setDriveMessage(`${data.images.length} imágenes encontradas en la carpeta conectada.`);
    } catch (error: any) {
      setDriveMessage(error?.message || 'Error al consultar Google Drive.');
    } finally {
      setLoadingDrive(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadDriveFolder();
  }, [isAuthenticated]);

  const toggleDriveFile = (id: string) => {
    setSelectedDriveIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const registerSelectedDriveFiles = async () => {
    if (!selectedDriveIds.length || savingDriveSelection) return;
    setSavingDriveSelection(true);
    setDriveMessage('');
    try {
      const config = (await loadSiteDataFromCloud()) || {};
      const existing: GalleryImage[] = Array.isArray(config.galleryImages) ? config.galleryImages : [];
      const selected = driveFiles.filter((file) => selectedDriveIds.includes(file.id));
      const selectedIdSet = new Set(selectedDriveIds);
      const byId = new Map(existing.map((image) => [String(image.id).replace(/^drive-/, ''), image]));

      selected.forEach((file) => {
        const prior = byId.get(file.id);
        byId.set(file.id, {
          id: file.id,
          title: prior?.title || normalizeTitle(file.name),
          category,
          url: prior?.url || getDirectGoogleDriveUrl(file.url || file.id),
          location: location.trim() || prior?.location || 'CDMX',
        });
      });

      const merged = Array.from(byId.entries()).map(([id, image]) =>
        selectedIdSet.has(id) ? { ...image, category, location: location.trim() || image.location || 'CDMX' } : image
      );

      const success = await saveSiteDataToCloud(
        { galleryImages: merged },
        'CLASIFICACION_MASIVA_GALERIA',
        `${selectedDriveIds.length} imágenes clasificadas como ${category}`
      );
      if (!success) throw new Error('Apps Script no confirmó la sincronización.');

      setDriveMessage(`${selectedDriveIds.length} imágenes registradas en ${CATEGORIES.find((item) => item.value === category)?.label}.`);
      setSelectedDriveIds([]);
    } catch (error: any) {
      setDriveMessage(error?.message || 'No se pudieron registrar las imágenes seleccionadas.');
    } finally {
      setSavingDriveSelection(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl bg-[#161C28] border border-white/10 p-7 space-y-5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center"><Camera className="w-5 h-5 text-[#D4AF37]" /></div>
            <div><h1 className="text-xl font-bold">XPH · Gestión de Galería</h1><p className="text-xs text-gray-400">Carga masiva y clasificación desde Google Drive</p></div>
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo de administrador" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white outline-none focus:border-[#D4AF37]" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white outline-none focus:border-[#D4AF37]" required />
          {authError && <p className="text-sm text-rose-400">{authError}</p>}
          <button type="submit" disabled={checkingAuth} className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {checkingAuth ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Entrar
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F17] text-white py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">XPH Fotografía & Video</p><h1 className="text-3xl font-bold font-serif-luxury">Galería · Carga masiva</h1><p className="text-sm text-gray-400 mt-1">Google Drive → Apps Script → Google Sheets → secciones del sitio.</p></div>
          <a href="/" className="px-4 py-2 rounded-xl border border-white/15 text-sm text-gray-300 hover:text-white">Volver al sitio</a>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-2"><span className="text-xs text-gray-400">Sección / categoría</span><select value={category} onChange={(e) => setCategory(e.target.value as PublishCategory)} className="w-full px-4 py-3 rounded-xl bg-[#161C28] border border-white/15 text-white">{CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="space-y-2"><span className="text-xs text-gray-400">Ubicación / etiqueta</span><input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#161C28] border border-white/15 text-white" placeholder="CDMX" /></label>
        </div>

        <section className="rounded-2xl bg-[#161C28] border border-white/10 p-6 space-y-5">
          <div className="flex items-center gap-3"><Upload className="w-5 h-5 text-[#D4AF37]" /><div><h2 className="text-xl font-bold">Subir imágenes nuevas</h2><p className="text-xs text-gray-400">Selecciona múltiples JPG, PNG o WEBP. Se procesan secuencialmente para cuidar Apps Script.</p></div></div>
          <input type="file" accept="image/*" multiple onChange={handleFilesSelected} className="block w-full text-sm text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-[#D4AF37] file:text-black file:font-bold" />
          {uploadRows.length > 0 && <div className="max-h-80 overflow-auto rounded-xl border border-white/10 divide-y divide-white/5">{uploadRows.map((row) => <div key={row.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm"><div className="min-w-0"><p className="truncate text-gray-200">{row.name}</p>{row.message && <p className="text-[11px] text-gray-500 truncate">{row.message}</p>}</div>{row.status === 'pending' && <span className="text-xs text-gray-500">Pendiente</span>}{row.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />}{row.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}{row.status === 'error' && <XCircle className="w-4 h-4 text-rose-400" />}</div>)}</div>}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><p className="text-xs text-gray-400">{files.length ? `${files.length} archivos seleccionados · ${successfulUploads} completados` : 'Sin archivos seleccionados'}</p><button type="button" onClick={handleBulkUpload} disabled={!files.length || isUploading} className="px-6 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">{isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir lote a Drive</button></div>
        </section>

        <section className="rounded-2xl bg-[#161C28] border border-white/10 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="flex items-center gap-3"><FolderOpen className="w-5 h-5 text-[#D4AF37]" /><div><h2 className="text-xl font-bold">Imágenes existentes en Google Drive</h2><p className="text-xs text-gray-400">Selecciona varias y asígnalas a la sección elegida.</p></div></div><button type="button" onClick={loadDriveFolder} disabled={loadingDrive} className="px-4 py-2.5 rounded-xl border border-white/15 text-sm flex items-center justify-center gap-2"><RefreshCw className={`w-4 h-4 ${loadingDrive ? 'animate-spin' : ''}`} /> Actualizar carpeta</button></div>
          {driveMessage && <p className="text-sm text-gray-300">{driveMessage}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[560px] overflow-auto">{driveFiles.map((file) => { const selected = selectedDriveIds.includes(file.id); return <button type="button" key={file.id} onClick={() => toggleDriveFile(file.id)} className={`relative rounded-xl overflow-hidden border text-left ${selected ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-white/10'}`}><img src={getDirectGoogleDriveUrl(file.url || file.id)} alt={file.name} className="w-full aspect-square object-cover bg-black" loading="lazy" /><div className="p-2 bg-[#0B0F17]"><p className="text-[11px] text-gray-300 truncate">{file.name}</p></div>{selected && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#D4AF37] text-black flex items-center justify-center"><CheckCircle2 className="w-4 h-4" /></span>}</button>; })}</div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/10"><div className="flex gap-2"><button type="button" onClick={() => setSelectedDriveIds(driveFiles.map((file) => file.id))} className="px-3 py-2 rounded-lg bg-white/5 text-xs">Seleccionar todas</button><button type="button" onClick={() => setSelectedDriveIds([])} className="px-3 py-2 rounded-lg bg-white/5 text-xs">Limpiar</button></div><button type="button" onClick={registerSelectedDriveFiles} disabled={!selectedDriveIds.length || savingDriveSelection} className="px-6 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">{savingDriveSelection ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />} Registrar {selectedDriveIds.length || ''} en la sección</button></div>
        </section>
      </div>
    </main>
  );
};
