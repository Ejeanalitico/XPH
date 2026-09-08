from pathlib import Path

# Central Drive URL resolver with several browser-compatible fallbacks.
Path('src/utils/googleDrive.ts').write_text(r'''/** Extrae un ID únicamente de referencias válidas de Google Drive. */
export function extractGoogleDriveFileId(urlOrId: string): string {
  const trimmed = String(urlOrId || '').trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  let host = '';
  try { host = new URL(trimmed).hostname.toLowerCase(); } catch (_) { return ''; }
  if (!host.endsWith('google.com') && !host.endsWith('googleusercontent.com')) return '';

  const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    || trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || '';
}

/** URLs alternativas para una imagen de Drive. */
export function getGoogleDriveImageCandidates(urlOrId: string): string[] {
  const trimmed = String(urlOrId || '').trim();
  if (!trimmed) return [];
  const fileId = extractGoogleDriveFileId(trimmed);
  if (!fileId) return [trimmed];
  const encoded = encodeURIComponent(fileId);
  return Array.from(new Set([
    `https://drive.google.com/thumbnail?id=${encoded}&sz=w1600`,
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=view&id=${encoded}`,
    `https://drive.usercontent.google.com/download?id=${encoded}&export=download&confirm=t`,
  ]));
}

/** Convierte IDs y enlaces de Drive en una URL pública de vista previa. */
export function getDirectGoogleDriveUrl(urlOrId: string): string {
  return getGoogleDriveImageCandidates(urlOrId)[0] || '';
}

/** Carga únicamente la configuración pública sanitizada por el proxy de Vercel. */
export async function loadSiteDataFromCloud(): Promise<Record<string, any> | null> {
  try {
    const params = new URLSearchParams({ action: 'loadConfig', _t: Date.now().toString() });
    const response = await fetch(`/api/proxy?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.status !== 'success') throw new Error(data?.message || 'No se pudo cargar la configuración.');
    const parsed = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('[XPH Cloud] No se pudo cargar la configuración pública:', error);
    return null;
  }
}
''', encoding='utf-8')

# SafeImage retries Drive thumbnail/direct/view/download URLs before failing.
Path('src/components/SafeImage.tsx').write_text(r'''import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { extractGoogleDriveFileId, getGoogleDriveImageCandidates } from '../utils/googleDrive';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  preventDownload?: boolean;
}

export function extractDriveFileId(url: string): string | null {
  return extractGoogleDriveFileId(url) || null;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  onClick,
  preventDownload = false,
}) => {
  const candidates = useMemo(() => getGoogleDriveImageCandidates(src), [src]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((current) => current + 1);
      return;
    }
    setHasError(true);
  };

  const fileId = extractDriveFileId(src);
  const currentSrc = candidates[candidateIndex] || src;

  if (hasError) {
    return (
      <div
        onClick={onClick}
        onContextMenu={preventDownload ? (event) => event.preventDefault() : undefined}
        className={`bg-[#0B0F17] border border-amber-500/30 rounded-2xl p-4 text-center flex flex-col items-center justify-center space-y-2 text-xs text-amber-300 min-h-[160px] w-full ${className}`}
      >
        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <span className="font-bold text-amber-200">Imagen no disponible</span>
        <p className="text-[10px] text-gray-400 max-w-[240px] leading-relaxed">
          Google Drive devolvió el archivo, pero no permitió mostrar una vista previa pública.
        </p>
        {!preventDownload && fileId && (
          <a
            href={`https://drive.google.com/file/d/${fileId}/view`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] text-[#D4AF37] hover:underline font-mono mt-1 bg-[#D4AF37]/10 px-2.5 py-1 rounded-md border border-[#D4AF37]/30"
          >
            <span>Ver en Google Drive</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={handleError}
      onClick={onClick}
      onContextMenu={preventDownload ? (event) => event.preventDefault() : undefined}
      onDragStart={preventDownload ? (event) => event.preventDefault() : undefined}
      draggable={preventDownload ? false : undefined}
      className={`${preventDownload ? 'select-none' : ''} ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={preventDownload ? ({ WebkitUserDrag: 'none', userSelect: 'none' } as React.CSSProperties) : undefined}
    />
  );
};
''', encoding='utf-8')

# Normalize Drive-list thumbnails and provide a safe way to publish an existing root-folder file.
p = Path('src/utils/adminApi.ts')
s = p.read_text(encoding='utf-8')
marker = "import { CURRENT_CATALOG_VERSION, resolvePublishedAddons, resolvePublishedPackages } from './catalogMerge';\n"
assert marker in s
if "from './googleDrive';" not in s:
    s = s.replace(marker, marker + "import { getDirectGoogleDriveUrl } from './googleDrive';\n", 1)
old = '''export async function loadDriveImages(_session?: AdminSession | null): Promise<DriveImageRecord[]> {
  const res = await fetch('/api/proxy?action=adminDriveList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: '{}',
  });
  const data = await parseResponse(res);
  return Array.isArray(data.images) ? data.images : [];
}
'''
new = '''export async function loadDriveImages(_session?: AdminSession | null): Promise<DriveImageRecord[]> {
  const res = await fetch('/api/proxy?action=adminDriveList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: '{}',
  });
  const data = await parseResponse(res);
  return (Array.isArray(data.images) ? data.images : []).map((item: DriveImageRecord) => ({
    ...item,
    url: getDirectGoogleDriveUrl(item.id || item.url),
  }));
}

export async function registerExistingDriveImage(
  fileId: string,
  options: { title: string; category: string; location: string },
): Promise<{ fileId: string; url: string; driveUrl?: string }> {
  const res = await fetch('/api/proxy?action=adminUploadFinalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ fileId, ...options, visibility: 'public' }),
  });
  const data = await parseResponse(res);
  return { fileId: data.fileId || fileId, url: getDirectGoogleDriveUrl(data.fileId || fileId), driveUrl: data.driveUrl || '' };
}
'''
assert old in s
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Admin gallery picker uses SafeImage; registering an existing Drive file runs the backend finalizer.
p = Path('src/components/UnifiedAdminDashboard.tsx')
s = p.read_text(encoding='utf-8')
import_anchor = "import { PromotionAdminSettings } from './PromotionAdminSettings';\n"
assert import_anchor in s
if "import { SafeImage } from './SafeImage';" not in s:
    s = s.replace(import_anchor, import_anchor + "import { SafeImage } from './SafeImage';\n", 1)
api_anchor = "  importPrivateDriveFolder,\n  loadAdminConfig,\n"
assert api_anchor in s
s = s.replace(api_anchor, "  importPrivateDriveFolder,\n  registerExistingDriveImage,\n  loadAdminConfig,\n", 1)
old_reg = '''  const registerDriveSelection = async () => {
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
'''
new_reg = '''  const registerDriveSelection = async () => {
    if (!session || !selectedDriveIds.length) return;
    setBusy(true);
    try {
      const selected = driveImages.filter((item) => selectedDriveIds.includes(item.id));
      for (const item of selected) {
        await registerExistingDriveImage(item.id, {
          title: titleFromFilename(item.name),
          category: publicCategory,
          location: publicLocation || 'CDMX',
        });
      }
      const confirmed = await loadAdminConfig(session);
      applyConfig(confirmed);
      setSelectedDriveIds([]);
      notify(`${selected.length} imágenes de Drive registradas y habilitadas para vista previa.`);
    } catch (error: any) { notify(error?.message || 'No se pudieron registrar las imágenes de Drive.'); }
    finally { setBusy(false); }
  };
'''
assert old_reg in s
s = s.replace(old_reg, new_reg, 1)
for a, b in {
    '<img src={item.url} alt={item.name} className="w-full aspect-square object-cover" />': '<SafeImage src={item.url} alt={item.name} className="w-full aspect-square object-cover" />',
    '<img src={item.url} alt={item.title} className="w-full aspect-square object-cover" />': '<SafeImage src={item.url} alt={item.title} className="w-full aspect-square object-cover" />',
}.items():
    assert a in s, a
    s = s.replace(a, b)
p.write_text(s, encoding='utf-8')

# Private client galleries get the same Drive fallback chain.
p = Path('src/components/ClientGalleryPage.tsx')
s = p.read_text(encoding='utf-8')
anchor = "import { GalleryImage } from '../types';\n"
assert anchor in s
if "import { SafeImage } from './SafeImage';" not in s:
    s = s.replace(anchor, anchor + "import { SafeImage } from './SafeImage';\n", 1)
a = '<img src={item.url} alt={`Fotografía ${index + 1}`} className="w-full object-cover" loading="lazy" />'
b = '<SafeImage src={item.url} alt={`Fotografía ${index + 1}`} className="w-full object-cover" />'
assert a in s
s = s.replace(a, b, 1)
a = '<img src={activePhoto.url} alt={`Fotografía ${activePhotoIndex + 1}`} className="max-w-full max-h-[82vh] object-contain mx-auto" />'
b = '<SafeImage src={activePhoto.url} alt={`Fotografía ${activePhotoIndex + 1}`} className="max-w-full max-h-[82vh] object-contain mx-auto" />'
assert a in s
s = s.replace(a, b, 1)
p.write_text(s, encoding='utf-8')

# Managed hero covers also normalize old lh3/Drive URLs.
p = Path('src/components/Hero.tsx')
s = p.read_text(encoding='utf-8')
anchor = "import { DEFAULT_CATALOG_CATEGORIES } from '../utils/catalogCategories';\n"
assert anchor in s
if "getDirectGoogleDriveUrl" not in s:
    s = s.replace(anchor, anchor + "import { getDirectGoogleDriveUrl } from '../utils/googleDrive';\n", 1)
old = "  const imageUrl = setting?.url || heroCovers[currentRoute] || category?.imageUrl || current.imageUrl;\n"
new = "  const sourceImageUrl = setting?.url || heroCovers[currentRoute] || category?.imageUrl || current.imageUrl;\n  const imageUrl = getDirectGoogleDriveUrl(sourceImageUrl);\n"
assert old in s
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
