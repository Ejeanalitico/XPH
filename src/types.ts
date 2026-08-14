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
  signatureDataUrl: string;
  paymentMethod: 'stripe' | 'mercadopago' | 'spei';
  total: number;
  depositAmount: number;
}

export interface QuoteRecord {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  eventType: EventType;
  selectedPackageId: string;
  packageName: string;
  packagePrice: number;
  addons: string[];
  extraHours: number;
  total: number;
  depositAmount: number;
  eventDate: string;
  eventCity: string;
  status: 'Pendiente' | 'Cita Presencial Agendada' | 'Contratado';
  createdAt: string;
  notes?: string;
  signatureDataUrl?: string;
}

export interface AdminCredentials {
  email: string;
  pass: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'info' | 'warning';
}