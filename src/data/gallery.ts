import { GalleryImage } from '../types';

// La galería pública se alimenta desde Google Drive / Apps Script.
// Si la nube no responde, preferimos mostrar la galería vacía antes que material de demostración.
export const GALLERY_IMAGES: GalleryImage[] = [];
