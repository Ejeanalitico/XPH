import { GalleryImage, GalleryCategory } from '../types';

export const APPS_SCRIPT_DEPLOYMENT_URL =
  'https://script.google.com/macros/s/AKfycbzcabU0-P7RCW04G-MMFds6m4JeQKpiPl6_IaAA40KGQsp73ZsaJx6PuwbcmhBCa4Br/exec';

/**
 * Returns the proxy endpoint URL.
 * In production (Vercel) → /api/proxy  (same-origin, no CORS)
 * In local dev → calls Apps Script directly (the dev server doesn't have /api/)
 */
function getProxyUrl(): string {
  // In a Vercel deployment, window.location.hostname won't be localhost
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return '/api/proxy';
  }
  // Local dev: call Apps Script directly (still may hit CORS, but for dev only)
  return (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL || APPS_SCRIPT_DEPLOYMENT_URL;
}

// ─────────────────────────────────────────────────────────────────────────────
// URL Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getDirectGoogleDriveUrl(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  if (trimmed.includes('googleusercontent.com') || trimmed.startsWith('data:image/') || trimmed.startsWith('http')) {
    const fileIdMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
    return trimmed;
  }
  const cleanId = trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
  return `https://lh3.googleusercontent.com/d/${cleanId}`;
}

export function isGoogleDriveUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('drive.google.com') || url.includes('googleusercontent.com/d/');
}

export function extractDriveFolderId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  const folderMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];
  return trimmed;
}

export function inferCategoryFromFilename(filename: string): GalleryCategory {
  const lower = filename.toLowerCase();
  if (lower.includes('boda') || lower.includes('wedding')) return 'bodas';
  if (lower.includes('xv') || lower.includes('quince') || lower.includes('15')) return 'xv-anos';
  if (lower.includes('bautizo') || lower.includes('family') || lower.includes('familia')) return 'bautizos';
  if (lower.includes('retrato') || lower.includes('portrait') || lower.includes('moda') || lower.includes('graduacion')) return 'retratos';
  if (lower.includes('empresarial') || lower.includes('corporate') || lower.includes('branding') || lower.includes('headshot')) return 'empresarial';
  if (lower.includes('previa') || lower.includes('engagement')) return 'previa';
  return 'bodas';
}

// ─────────────────────────────────────────────────────────────────────────────
// Core helper: call the proxy (server-side) or Apps Script directly (local dev)
// ─────────────────────────────────────────────────────────────────────────────

async function callProxy(
  action: string,
  extraParams: Record<string, string> = {},
  body?: string
): Promise<any> {
  const proxyUrl = getProxyUrl();
  const isProxy = proxyUrl === '/api/proxy';

  if (isProxy) {
    // Production: use Vercel serverless proxy (no CORS restriction)
    if (body) {
      // POST through proxy
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });
      if (!res.ok) throw new Error(`Proxy POST failed: ${res.status}`);
      return await res.json();
    } else {
      // GET through proxy
      const params = new URLSearchParams({ action, ...extraParams, _t: Date.now().toString() });
      const res = await fetch(`/api/proxy?${params}`, { method: 'GET' });
      if (!res.ok) throw new Error(`Proxy GET failed: ${res.status}`);
      return await res.json();
    }
  } else {
    // Local dev: direct fetch with no-cors for POST, normal fetch for GET
    if (body) {
      await fetch(proxyUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });
      return { status: 'optimistic' };
    } else {
      const params = new URLSearchParams({ action, ...extraParams, _t: Date.now().toString() });
      const res = await fetch(`${proxyUrl}?${params}`, { method: 'GET', redirect: 'follow' });
      if (!res.ok) throw new Error(`Direct GET failed: ${res.status}`);
      return await res.json();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// loadSiteDataFromCloud — reads current config from Google Sheets
// ─────────────────────────────────────────────────────────────────────────────

export async function loadSiteDataFromCloud(_scriptUrl?: string): Promise<Record<string, any> | null> {
  try {
    const data = await callProxy('loadConfig');
    if (data && data.status === 'success') {
      if (data.spreadsheetUrl) {
        try { localStorage.setItem('xph_spreadsheet_url', data.spreadsheetUrl); } catch (_) {}
      }
      if (data.config) {
        const parsed = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          console.log('[XPH Cloud] ✅ Loaded config from Google Sheets via proxy');
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[XPH Cloud] loadSiteDataFromCloud failed:', err);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// saveSiteDataToCloud — writes config to Google Sheets
// ─────────────────────────────────────────────────────────────────────────────

export async function saveSiteDataToCloud(
  siteData: Record<string, any>,
  auditType: string = 'ACTUALIZACION_GENERAL',
  auditDetails: string = 'Cambios guardados desde el panel Admin',
  _scriptUrl?: string
): Promise<boolean> {
  // Strip base64 images — keep payload lightweight
  const sanitizedData = { ...siteData };
  if (Array.isArray(sanitizedData.galleryImages)) {
    sanitizedData.galleryImages = sanitizedData.galleryImages.filter(
      (img: any) => img && img.url && !img.url.startsWith('data:image/')
    );
  }

  const payload = JSON.stringify({
    action: 'saveConfig',
    configData: JSON.stringify(sanitizedData),
    auditType,
    auditDetails,
  });

  try {
    const result = await callProxy('saveConfig', {}, payload);
    if (result && (result.status === 'success' || result.status === 'optimistic')) {
      if (result.spreadsheetUrl) {
        try { localStorage.setItem('xph_spreadsheet_url', result.spreadsheetUrl); } catch (_) {}
      }
      console.log('[XPH Cloud] ✅ Saved to Google Sheets via proxy:', result.message || 'OK');
      return true;
    }
    console.warn('[XPH Cloud] saveSiteDataToCloud got unexpected response:', result);
    return false;
  } catch (err) {
    console.error('[XPH Cloud] saveSiteDataToCloud failed:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchDriveFolderImages — lists images from Google Drive folder
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchDriveFolderImages(
  folderUrlOrId?: string,
  apiKey?: string,
  targetCategory?: GalleryCategory | 'auto',
  _scriptUrl?: string
): Promise<GalleryImage[]> {
  // Try via proxy first
  try {
    const data = await callProxy('listDriveFolder');
    if (data && data.status === 'success' && Array.isArray(data.images) && data.images.length > 0) {
      return data.images.map((file: any) => {
        const titleWithoutExt = (file.name || 'Fotografía').replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const category: GalleryCategory =
          targetCategory && targetCategory !== 'auto'
            ? targetCategory
            : inferCategoryFromFilename(file.name || '');
        return {
          id: `drive-${file.id}`,
          title: titleWithoutExt,
          category,
          url: file.url || `https://lh3.googleusercontent.com/d/${file.id}`,
          location: 'Google Drive CDMX',
          camera: 'Sony Alpha 1',
          lens: 'FE 85mm f/1.4 GM',
        };
      });
    }
  } catch (err) {
    console.warn('[XPH Drive Sync] Proxy listing failed, trying Drive v3...', err);
  }

  // Fallback: Google Drive v3 API
  const folderId = folderUrlOrId ? extractDriveFolderId(folderUrlOrId) : '1UyN3m72kG4liDumQYxlO03cKtJJpYG62';
  const effectiveApiKey = apiKey || (import.meta as any).env?.VITE_GOOGLE_DRIVE_API_KEY;
  if (!effectiveApiKey) return [];

  try {
    const query = `'${folderId}'+in+parents+and+mimeType+contains+'image/'+and+trashed=false`;
    const fields = 'files(id,name,mimeType,createdTime)';
    const endpoint = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&key=${effectiveApiKey}&pageSize=100`;
    const response = await fetch(endpoint);
    if (!response.ok) return [];
    const data = await response.json();
    const files: Array<{ id: string; name: string }> = data.files || [];
    return files.map((file) => {
      const titleWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const category: GalleryCategory =
        targetCategory && targetCategory !== 'auto' ? targetCategory : inferCategoryFromFilename(file.name);
      return {
        id: `drive-${file.id}`,
        title: titleWithoutExt || 'Fotografía de Google Drive',
        category,
        url: `https://lh3.googleusercontent.com/d/${file.id}`,
        location: 'Google Drive Auto-Sync',
        camera: 'Sony Alpha 1',
        lens: 'FE 85mm f/1.4 GM',
      };
    });
  } catch (_) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// uploadImageToGoogleDrive — uploads to Drive and writes to Galeria_Fotos
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadImageToGoogleDrive(
  file: File | string,
  filename: string,
  options?: {
    title?: string;
    category?: string;
    location?: string;
    scriptUrl?: string;
  }
): Promise<{ fileId: string; url: string; isDrive: boolean }> {
  let base64String = '';
  let mimeType = 'image/jpeg';

  if (typeof file === 'string') {
    base64String = file;
    const mimeMatch = file.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];
  } else {
    mimeType = file.type || 'image/jpeg';
    base64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Compress image for fast upload (< 200 KB)
  if (base64String.startsWith('data:image/') && typeof window !== 'undefined') {
    try {
      base64String = await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxWidth = 1400;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.80));
          } else {
            resolve(base64String);
          }
        };
        img.onerror = () => resolve(base64String);
        img.src = base64String;
      });
      mimeType = 'image/jpeg';
    } catch (_) {}
  }

  const cleanFilename = filename || `foto_xph_${Date.now()}.jpg`;
  const photoTitle = options?.title || cleanFilename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const photoCategory = options?.category || 'bodas';
  const photoLocation = options?.location || 'Polanco, CDMX';

  const uploadPayload = JSON.stringify({
    action: 'uploadPhoto',
    filename: cleanFilename,
    title: photoTitle,
    category: photoCategory,
    location: photoLocation,
    mimeType,
    base64: base64String,
  });

  try {
    const result = await callProxy('uploadPhoto', {}, uploadPayload);
    if (result && result.status === 'success' && result.fileId) {
      return { fileId: result.fileId, url: result.url, isDrive: true };
    }
  } catch (err) {
    console.error('[XPH Drive Upload] Proxy upload failed:', err);
  }

  // Fallback: store base64 locally if upload fails
  return {
    fileId: `local-${Date.now()}`,
    url: base64String,
    isDrive: false,
  };
}
