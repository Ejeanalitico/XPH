export type RoutePath = 'inicio' | 'bodas' | 'xv-anos' | 'bautizos' | 'retratos' | 'empresarial';

export type BuiltInEventType = 'bodas' | 'xv-anos' | 'bautizos' | 'retratos' | 'empresarial';
export type EventType = BuiltInEventType | (string & {});

export interface SeoPageSetting {
  title: string;
  description: string;
  indexed: boolean;
}

export type SeoSettings = Partial<Record<RoutePath, SeoPageSetting>>;

export type GalleryCategory = 'all' | EventType | 'previa';

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
  category: Exclude<GalleryCategory, 'all'> | 'private';
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
  clientId?: string;
  eventId?: string;
  driveFolderId?: string;
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
  categoryId?: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  active: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
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
  brandTitle?: string;
  brandSubtitle?: string;
  specialtiesTitle?: string;
  quickLinksTitle?: string;
  contactTitle?: string;
  socialTitle?: string;
  copyrightText?: string;
  services?: FooterServiceLink[];
  quickLinks?: FooterQuickLink[];
  socialLinks?: FooterSocialLink[];
}

export interface FooterServiceLink {
  id: string;
  label: string;
  route: RoutePath;
}

export interface FooterQuickLink {
  id: string;
  label: string;
  href: string;
}

export interface FooterSocialLink {
  id: string;
  label: string;
  url: string;
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
