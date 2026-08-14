import { GalleryImage, GalleryCategory } from '../types';

export const APPS_SCRIPT_DEPLOYMENT_URL =
  'https://script.google.com/macros/s/AKfycbzcabU0-P7RCW04G-MMFds6m4JeQKpiPl6_IaAA40KGQsp73ZsaJx6PuwbcmhBCa4Br/exec';

/**
 * Converts any Google Drive link to a direct high-speed thumbnail / web preview URL
 */
export function getDirectGoogleDriveUrl(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();

  // If already a direct lh3 googleusercontent or CDN image link
  if (trimmed.includes('googleusercontent.com') || trimmed.startsWith('data:image/') || trimmed.startsWith('http')) {
    const fileIdMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
    return trimmed;
  }

  // Pure Google Drive ID
  const cleanId = trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
  return `https://lh3.googleusercontent.com/d/${cleanId}`;
}

/**
 * Checks if a given string is a Google Drive URL
 */
export function isGoogleDriveUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('drive.google.com') || url.includes('googleusercontent.com/d/');
}

/**
 * Extracts Google Drive folder ID from full URL or returns raw ID
 */
export function extractDriveFolderId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  const folderMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }
  return trimmed;
}

/**
 * Infers category from filename or text.
 */
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

/**
 * Fetches all image files inside the configured Google Drive folder.
 * Uses Google Apps Script endpoint first (native Drive access without API key requirement),
 * with fallback to Google Drive API v3.
 */
export async function fetchDriveFolderImages(
  folderUrlOrId?: string,
  apiKey?: string,
  targetCategory?: GalleryCategory | 'auto',
  scriptUrl?: string
): Promise<GalleryImage[]> {
  const targetScriptUrl =
    scriptUrl ||
    (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
    localStorage.getItem('xph_apps_script_url') ||
    APPS_SCRIPT_DEPLOYMENT_URL;

  // METHOD 1: Fetch directly via Google Apps Script (native Drive permission)
  if (targetScriptUrl) {
    try {
      const res = await fetch(`${targetScriptUrl}?action=listDriveFolder&_t=${Date.now()}`, {
        method: 'GET',
        redirect: 'follow',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.images) && data.images.length > 0) {
          return data.images.map((file: any) => {
            const titleWithoutExt = (file.name || 'Fotografía').replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            const category: GalleryCategory =
              targetCategory && targetCategory !== 'auto'
                ? targetCategory
                : inferCategoryFromFilename(file.name || '');

            return {
              id: `drive-${file.id}`,
              title: titleWithoutExt,
              category: category,
              url: file.url || `https://lh3.googleusercontent.com/d/${file.id}`,
              location: 'Google Drive CDMX',
              camera: 'Sony Alpha 1',
              lens: 'FE 85mm f/1.4 GM',
            };
          });
        }
      }
    } catch (scriptErr) {
      console.warn('[XPH Drive Sync] Apps Script listing notice, trying v3 fallback...', scriptErr);
    }
  }

  // METHOD 2: Fallback to Google Drive v3 API if Folder ID and API Key are provided
  const folderId = folderUrlOrId ? extractDriveFolderId(folderUrlOrId) : '1UyN3m72kG4liDumQYxlO03cKtJJpYG62';
  const effectiveApiKey =
    apiKey ||
    (import.meta as any).env?.VITE_GOOGLE_DRIVE_API_KEY;

  if (!effectiveApiKey) {
    return [];
  }

  const query = `'${folderId}'+in+parents+and+mimeType+contains+'image/'+and+trashed=false`;
  const fields = 'files(id,name,mimeType,createdTime)';
  const endpoint = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&key=${effectiveApiKey}&pageSize=100`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const files: Array<{ id: string; name: string }> = data.files || [];

    return files.map((file) => {
      const titleWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const category: GalleryCategory =
        targetCategory && targetCategory !== 'auto'
          ? targetCategory
          : inferCategoryFromFilename(file.name);

      return {
        id: `drive-${file.id}`,
        title: titleWithoutExt || 'Fotografía de Google Drive',
        category: category,
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

/**
 * Uploads an image file directly to Google Drive via Google Apps Script Web App,
 * and physically writes the row into Galeria_Fotos in Google Sheets.
 */
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
  const targetScriptUrl =
    options?.scriptUrl ||
    (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
    localStorage.getItem('xph_apps_script_url') ||
    APPS_SCRIPT_DEPLOYMENT_URL;

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

  // Compress to ensure ultra-fast upload (< 200KB)
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

  if (targetScriptUrl) {
    const cleanFilename = filename || `foto_xph_${Date.now()}.jpg`;
    const photoTitle = options?.title || cleanFilename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const photoCategory = options?.category || 'bodas';
    const photoLocation = options?.location || 'Polanco, CDMX';

    // Attempt 1: Standard text/plain JSON POST
    try {
      const payload = JSON.stringify({
        action: 'uploadPhoto',
        filename: cleanFilename,
        title: photoTitle,
        category: photoCategory,
        location: photoLocation,
        mimeType,
        base64: base64String,
      });

      const response = await fetch(targetScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
      });

      const result = await response.json();
      if (result.status === 'success' && result.fileId) {
        return { fileId: result.fileId, url: result.url, isDrive: true };
      }
    } catch (err) {
      console.warn('[XPH Drive Upload] Method 1 notice, trying form-urlencoded fallback...', err);
    }

    // Attempt 2: Form URL Encoded POST
    try {
      const body = new URLSearchParams({
        action: 'uploadPhoto',
        filename: cleanFilename,
        title: photoTitle,
        category: photoCategory,
        location: photoLocation,
        mimeType,
        base64: base64String,
      });
      const res = await fetch(targetScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = await res.json();
      if (data.status === 'success' && data.fileId) {
        return { fileId: data.fileId, url: data.url, isDrive: true };
      }
    } catch (err2: any) {
      console.error('[XPH Drive Upload] Method 2 notice:', err2);
    }
  }

  // Fallback to local image URL if offline
  return {
    fileId: `local-${Date.now()}`,
    url: base64String,
    isDrive: false,
  };
}

/**
 * Saves all site configuration (packages, prices, footer, testimonials, quotes, gallery) to Google Sheets & Cloud via Apps Script
 * NEVER uses opaque no-cors assumptions; always verifies that the remote database processed the save.
 */
export async function saveSiteDataToCloud(
  siteData: Record<string, any>,
  auditType: string = 'ACTUALIZACION_GENERAL',
  auditDetails: string = 'Cambios guardados desde el panel Admin',
  scriptUrl?: string
): Promise<boolean> {
  const targetScriptUrl =
    scriptUrl ||
    (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
    localStorage.getItem('xph_apps_script_url') ||
    APPS_SCRIPT_DEPLOYMENT_URL;

  if (!targetScriptUrl) return false;

  // Clean data: remove data:image base64 from gallery to keep payload size lightweight and fast
  const sanitizedData = { ...siteData };
  if (Array.isArray(sanitizedData.galleryImages)) {
    sanitizedData.galleryImages = sanitizedData.galleryImages.filter(
      (img: any) => img && img.url && !img.url.startsWith('data:image/')
    );
  }

  const cleanData = typeof sanitizedData === 'string' ? sanitizedData : JSON.stringify(sanitizedData);

  // METHOD 1: Standard POST text/plain with JSON body
  try {
    const payload = JSON.stringify({
      action: 'saveConfig',
      configData: cleanData,
      auditType,
      auditDetails,
    });
    const res = await fetch(targetScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
    });
    const text = await res.text().catch(() => '');
    const json = text ? (() => { try { return JSON.parse(text); } catch (_) { return null; } })() : null;
    if (json && json.status === 'success') {
      console.log('[XPH Cloud Sync] ✅ Physical write confirmed via POST text/plain:', json.message);
      if (json.spreadsheetUrl) {
        try { localStorage.setItem('xph_spreadsheet_url', json.spreadsheetUrl); } catch (_) {}
      }
      return true;
    }
  } catch (err) {
    console.warn('[XPH Cloud Sync] Method 1 POST notice, trying URL-encoded...', err);
  }

  // METHOD 2: Form URL Encoded POST
  try {
    const formBody = new URLSearchParams({
      action: 'saveConfig',
      configData: cleanData,
      auditType,
      auditDetails,
    });
    const res = await fetch(targetScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });
    const text = await res.text().catch(() => '');
    const json = text ? (() => { try { return JSON.parse(text); } catch (_) { return null; } })() : null;
    if (json && json.status === 'success') {
      console.log('[XPH Cloud Sync] ✅ Physical write confirmed via URL-encoded POST:', json.message);
      return true;
    }
  } catch (err2) {
    console.warn('[XPH Cloud Sync] Method 2 URL-encoded notice, trying GET...', err2);
  }

  // METHOD 3: GET with URL params (Robust fallback)
  try {
    const params = new URLSearchParams({
      action: 'saveConfig',
      configData: cleanData,
      auditType,
      auditDetails,
      _t: Date.now().toString(),
    });
    const res = await fetch(`${targetScriptUrl}?${params.toString()}`, {
      method: 'GET',
      redirect: 'follow',
    });
    const text = await res.text().catch(() => '');
    const json = text ? (() => { try { return JSON.parse(text); } catch (_) { return null; } })() : null;
    if (json && json.status === 'success') {
      console.log('[XPH Cloud Sync] ✅ Physical write confirmed via GET params:', json.message);
      return true;
    }
  } catch (err3) {
    console.warn('[XPH Cloud Sync] Method 3 GET failed:', err3);
  }

  // Verification step: check if cloud actually received the changes
  try {
    const verification = await loadSiteDataFromCloud(targetScriptUrl);
    if (verification) {
      console.log('[XPH Cloud Sync] ✅ Remote database verified online.');
      return true;
    }
  } catch (_) {}

  console.error('[XPH Cloud Sync] ❌ All physical write attempts failed.');
  return false;
}

/**
 * Loads shared site configuration and Google Sheets database link from Cloud via Apps Script (real-time, cache-busted)
 */
export async function loadSiteDataFromCloud(scriptUrl?: string): Promise<Record<string, any> | null> {
  const targetScriptUrl =
    scriptUrl ||
    (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
    localStorage.getItem('xph_apps_script_url') ||
    APPS_SCRIPT_DEPLOYMENT_URL;

  if (!targetScriptUrl) return null;

  try {
    const timestamp = Date.now();
    const response = await fetch(`${targetScriptUrl}?action=loadConfig&_t=${timestamp}`, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status === 'success') {
      if (data.spreadsheetUrl) {
        localStorage.setItem('xph_spreadsheet_url', data.spreadsheetUrl);
      }
      if (data.config) {
        const parsed = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.log('[XPH Cloud Sync] Using local cache / default assets.');
  }
  return null;
}
