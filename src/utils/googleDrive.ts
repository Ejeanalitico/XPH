import { GalleryImage, GalleryCategory } from '../types';

/**
 * Utility to detect and convert Google Drive share links into direct image URLs.
 */
export function getDirectGoogleDriveUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();

  // If it's already an lh3.googleusercontent.com link, return as is
  if (trimmed.includes('lh3.googleusercontent.com/d/')) {
    return trimmed;
  }

  // Match /file/d/FILE_ID/
  const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
  }

  // Match ?id=FILE_ID or &id=FILE_ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }

  return trimmed;
}

export function isGoogleDriveUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes('drive.google.com') ||
    url.includes('lh3.googleusercontent.com')
  );
}

/**
 * Extracts Google Drive Folder ID from a shared folder URL or returns the ID if already clean.
 */
export function extractDriveFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
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
  if (lower.includes('retrato') || lower.includes('portrait') || lower.includes('moda')) return 'retratos';
  if (lower.includes('empresarial') || lower.includes('corporate') || lower.includes('branding')) return 'empresarial';
  if (lower.includes('previa') || lower.includes('engagement')) return 'previa';
  return 'bodas';
}

/**
 * Fetches all image files inside a public Google Drive folder using Google Drive API v3.
 */
export async function fetchDriveFolderImages(
  folderUrlOrId: string,
  apiKey?: string,
  targetCategory?: GalleryCategory | 'auto'
): Promise<GalleryImage[]> {
  const folderId = extractDriveFolderId(folderUrlOrId);
  if (!folderId) {
    throw new Error('ID de Carpeta de Google Drive inválido.');
  }

  const effectiveApiKey =
    apiKey ||
    (import.meta as any).env?.VITE_GOOGLE_DRIVE_API_KEY ||
    'AIzaSyAkYYkiVk8qRrKdA8V3a1kGxxeAWMlWLCc';

  if (!effectiveApiKey) {
    throw new Error('Se requiere una Clave de API de Google Drive (Google API Key).');
  }

  // Query image files inside parent folder
  const query = `'${folderId}'+in+parents+and+mimeType+contains+'image/'+and+trashed=false`;
  const fields = 'files(id,name,mimeType,createdTime)';
  const endpoint = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&key=${effectiveApiKey}&pageSize=100`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `Error HTTP ${response.status}`;
    throw new Error(`Google Drive API Error: ${message}`);
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
}

/**
 * Uploads an image file directly to Google Drive via Google Apps Script Web App.
 * Uses a GET request with params to avoid CORS preflight issues.
 */
export async function uploadImageToGoogleDrive(
  file: File | string,
  filename: string,
  scriptUrl?: string
): Promise<{ fileId: string; url: string; isDrive: boolean }> {
  const targetScriptUrl =
    scriptUrl ||
    (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
    localStorage.getItem('xph_apps_script_url') ||
    'https://script.google.com/macros/s/AKfycbzsubcFaMJWGZYoEal8TQ9cIxaZCHxroS5DcfcPacF9xWQqR6nbqkxpqaVuWMCVlq08/exec';

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

  if (targetScriptUrl) {
    try {
      // Use XMLHttpRequest to have full control over the request
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', targetScriptUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.timeout = 60000; // 60 seconds
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            reject(new Error('Respuesta inválida del servidor de Google'));
          }
        };
        xhr.onerror = () => reject(new Error('Error de red al conectar con Google Apps Script'));
        xhr.ontimeout = () => reject(new Error('Tiempo de espera agotado. Intenta con una imagen más pequeña.'));

        const body = new URLSearchParams({
          filename: filename || `foto_xph_${Date.now()}.jpg`,
          mimeType,
          base64: base64String,
        });
        xhr.send(body.toString());
      });

      console.log('[XPH Drive Upload] Response:', result);

      if (result.status === 'success' && result.fileId) {
        return { fileId: result.fileId, url: result.url, isDrive: true };
      } else {
        throw new Error(result.message || 'Google Drive rechazó el archivo');
      }
    } catch (err: any) {
      console.error('[XPH Drive Upload] Error:', err);
      throw new Error(`Error al subir a Google Drive: ${err.message}`);
    }
  }

  return {
    fileId: `local-${Date.now()}`,
    url: base64String,
    isDrive: false,
  };
}

/**
 * Saves all site configuration (packages, prices, footer, testimonials, quotes, gallery) to Cloud via Apps Script
 */
export async function saveSiteDataToCloud(siteData: Record<string, any>, scriptUrl?: string): Promise<boolean> {
  const targetScriptUrl =
    scriptUrl ||
    (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
    localStorage.getItem('xph_apps_script_url') ||
    'https://script.google.com/macros/s/AKfycbzsubcFaMJWGZYoEal8TQ9cIxaZCHxroS5DcfcPacF9xWQqR6nbqkxpqaVuWMCVlq08/exec';

  if (!targetScriptUrl) return false;

  try {
    const cleanData = JSON.stringify(siteData);
    const body = new URLSearchParams({
      action: 'saveConfig',
      configData: cleanData,
    });

    await fetch(targetScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return true;
  } catch (err) {
    console.warn('[XPH Cloud Sync] Background save failed, local cache preserved:', err);
    return false;
  }
}

/**
 * Loads shared site configuration from Cloud via Apps Script (real-time, cache-busted)
 */
export async function loadSiteDataFromCloud(scriptUrl?: string): Promise<Record<string, any> | null> {
  const targetScriptUrl =
    scriptUrl ||
    (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
    localStorage.getItem('xph_apps_script_url') ||
    'https://script.google.com/macros/s/AKfycbzsubcFaMJWGZYoEal8TQ9cIxaZCHxroS5DcfcPacF9xWQqR6nbqkxpqaVuWMCVlq08/exec';

  if (!targetScriptUrl) return null;

  try {
    const timestamp = Date.now();
    const response = await fetch(`${targetScriptUrl}?action=loadConfig&_t=${timestamp}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status === 'success' && data.config) {
      return typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
    }
  } catch (err) {
    console.log('[XPH Cloud Sync] Using local storage cache.');
  }
  return null;
}

