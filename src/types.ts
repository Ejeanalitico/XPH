export type RoutePath = 'inicio' | 'bodas' | 'xv-anos' | 'bautizos' | 'retratos' | 'empresarial';

export type EventType = 'bodas' | 'xv-anos' | 'bautizos' | 'retratos' | 'empresarial';

export type GalleryCategory = 'all' | 'bodas' | 'xv-anos' | 'bautizos' | 'retratos' | 'empresarial' | 'previa';

export type GalleryVisibility = 'public' | 'private' | 'cover';
export type GalleryMediaType = 'image' | 'video' | 'gallery-meta' | 'cover-meta';

export interface HeroCoverSetting {
  url: string;
  label: string;
  description: string;
  positionX: number;
  positionY: number;
  zoom: number;
}

export interface GalleryImage {
  id: string;
  title: string;
  category: 'bodas' | 'xv-anos' | 'bautizos' | 'retratos' | 'empresarial' | 'previa' | 'private';
  url: string;
  location: string;
  camera?: string;
  lens?: string;
  likes?: number;
  visibility?: GalleryVisibility;
  mediaType?: GalleryMediaType;
  galleryId?: string;
  gallerySlug?: string;
  galleryTitle?: string;
  galleryClient?: string;
  galleryToken?: string;
  galleryAllowDownloads?: boolean;
  downloadUrl?: string;
  previewUrl?: string;
  createdAt?: string;
  heroFor?: RoutePath;
}

export interface PrivateGallerySummary {
  galleryId: string;
  slug: string;
  title: string;
  clientName: string;
  token: string;
  createdAt: string;
  mediaCount: number;
  allowDownloads: boolean;
}

export interface PackageOption {
  id: string;
  name: string;
  price: number;
  badge?: string;
  description: string;
  features: string[];
  notIncludes?: string[];
  popular?: boolean;
  managedByAdmin?: boolean;
}

export interface AddOnOption {
  id: string;
  name: string;
  price: number;
  description: string;
  type: 'checkbox' | 'counter';
  includes?: string[];
  managedByAdmin?: boolean;
}

export interface FooterContact {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  schedule: string;
  aboutText: string;
}

export interface Testimonial {
  id: string;
  clientName: string;
  eventType: EventType;
  date: string;
  rating: number;
  comment: string;
  photoUrl?: string;
  verified: boolean;
}

export interface BookingState {
  eventType: EventType;
  selectedPackageId: string;
  extraHours: number;
  selectedAddons: string[];
  date: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  eventCity: string;
  notes: string;
  total: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'info' | 'warning';
}
