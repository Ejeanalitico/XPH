/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AddOnOption,
  BookingState,
  EventType,
  FooterContact,
  GalleryImage,
  HeroCoverSetting,
  PackageOption,
  RoutePath,
  ToastMessage,
} from './types';
import { PACKAGES_BY_EVENT, ADDONS_CATALOG } from './data/packages';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { GallerySection } from './components/GallerySection';
import { PricingQuoteEngine } from './components/PricingQuoteEngine';
import { InPersonConsultation } from './components/InPersonConsultation';
import { BookingWizard } from './components/BookingWizard';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import { ToastContainer } from './components/Toast';
import { Footer } from './components/Footer';
import { loadSiteDataFromCloud } from './utils/googleDrive';

const DEFAULT_WHATSAPP = '5615567863';

const defaultContact: FooterContact = {
  phone: '+52 56 1556 7863',
  whatsapp: DEFAULT_WHATSAPP,
  email: 'contacto@xavi.ph',
  address: 'CDMX, Estado de México, Morelos, Puebla, Querétaro, Tlaxcala y Pachuca',
  schedule: 'Atención por WhatsApp y citas previamente coordinadas',
  aboutText: 'XPH Fotografía & Video; Producción Audiovisual para bodas, XV años, sesiones, eventos y proyectos empresariales.',
};

const cleanWhatsApp = (value?: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2);
  return DEFAULT_WHATSAPP;
};

const displayPhoneFromWhatsApp = (value: string) => {
  const digits = cleanWhatsApp(value);
  return `+52 ${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
};

const sanitizePublicContact = (cloudContact?: Partial<FooterContact>): FooterContact => {
  const whatsapp = cleanWhatsApp(cloudContact?.whatsapp || cloudContact?.phone || DEFAULT_WHATSAPP);
  const cloudPhone = String(cloudContact?.phone || '');
  const looksLikePlaceholder = /1234\s*5678/.test(cloudPhone) || !cloudPhone.trim();
  return {
    phone: looksLikePlaceholder ? displayPhoneFromWhatsApp(whatsapp) : cloudPhone,
    whatsapp,
    email: cloudContact?.email || defaultContact.email,
    address: cloudContact?.address || defaultContact.address,
    schedule: cloudContact?.schedule || defaultContact.schedule,
    aboutText: defaultContact.aboutText,
  };
};

const hasManagedPackages = (value: any): value is Record<EventType, PackageOption[]> =>
  Boolean(value && typeof value === 'object' && Object.values(value).flat().some((pkg: any) => pkg?.managedByAdmin));

const loadPackagesFromSheet = async (): Promise<Record<EventType, PackageOption[]> | null> => {
  try {
    const response = await fetch(`/api/packages-sheet?_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok || data?.status !== 'success' || !hasManagedPackages(data.packages)) return null;
    return data.packages;
  } catch (error) {
    console.warn('[XPH Packages] No se pudo leer el catálogo publicado:', error);
    return null;
  }
};

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<RoutePath>('inicio');
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [heroCovers, setHeroCovers] = useState<Partial<Record<RoutePath, string>>>({});
  const [heroCoverSettings, setHeroCoverSettings] = useState<Partial<Record<RoutePath, HeroCoverSetting>>>({});
  const [footerContact, setFooterContact] = useState<FooterContact>(defaultContact);
  const [packagesState, setPackagesState] = useState<Record<EventType, PackageOption[]>>(PACKAGES_BY_EVENT);
  const [addonsState] = useState<AddOnOption[]>(ADDONS_CATALOG);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [bookingState, setBookingState] = useState<BookingState>({
    eventType: 'bodas',
    selectedPackageId: 'pro',
    extraHours: 0,
    selectedAddons: [],
    date: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    eventCity: '',
    notes: '',
    signatureDataUrl: '',
    paymentMethod: 'stripe',
    total: 9990,
    depositAmount: 0,
  });

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  useEffect(() => {
    Promise.all([loadSiteDataFromCloud(), loadPackagesFromSheet()]).then(([cloudData, publishedPackages]) => {
      const data = cloudData || {};

      if (Array.isArray(data.galleryImages)) {
        const realGallery = data.galleryImages.filter((image: GalleryImage) =>
          Boolean(
            image?.id &&
            image?.url &&
            image?.category &&
            image.visibility !== 'private' &&
            image.visibility !== 'cover' &&
            image.mediaType !== 'gallery-meta' &&
            image.mediaType !== 'cover-meta' &&
            image.mediaType !== 'video' &&
            image.category !== 'private'
          )
        );
        setGalleryImages(realGallery);
      }

      if (data.heroCovers && typeof data.heroCovers === 'object') {
        setHeroCovers(data.heroCovers as Partial<Record<RoutePath, string>>);
      }

      if (data.heroCoverSettings && typeof data.heroCoverSettings === 'object') {
        setHeroCoverSettings(data.heroCoverSettings as Partial<Record<RoutePath, HeroCoverSetting>>);
      }

      const effectivePackages = hasManagedPackages(publishedPackages)
        ? publishedPackages
        : PACKAGES_BY_EVENT;

      setPackagesState(effectivePackages);
      const available = effectivePackages.bodas || [];
      const selected = available.find((pkg) => pkg.popular) || available[0];
      if (selected) {
        setBookingState((prev) => ({
          ...prev,
          eventType: 'bodas',
          selectedPackageId: selected.id,
          selectedAddons: [],
          extraHours: 0,
          total: selected.price,
          depositAmount: 0,
        }));
      }

      if (data.footerContact) setFooterContact(sanitizePublicContact(data.footerContact));
    });
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      const validRoutes: RoutePath[] = ['inicio', 'bodas', 'xv-anos', 'bautizos', 'retratos', 'empresarial'];
      if (validRoutes.includes(hash as RoutePath)) setCurrentRoute(hash as RoutePath);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const showToast = (
    title: string,
    description?: string,
    type: 'success' | 'info' | 'warning' = 'info'
  ) => {
    const toast: ToastMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      description,
      type,
    };
    setToasts((prev) => [...prev, toast]);
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== toast.id)), 4000);
  };

  const handleNavigateRoute = (route: RoutePath) => {
    setCurrentRoute(route);
    window.history.pushState({}, '', `#/${route}`);

    if (route !== 'inicio') {
      const eventType = route as EventType;
      const available = packagesState[eventType] || packagesState.bodas || [];
      const selected = available.find((pkg) => pkg.popular) || available[0];
      if (selected) {
        setBookingState((prev) => ({
          ...prev,
          eventType,
          selectedPackageId: selected.id,
          selectedAddons: selected.price === 0 ? [] : prev.selectedAddons.filter((id) => addonsState.some((addon) => addon.id === id)),
          extraHours: selected.price === 0 ? 0 : prev.extraHours,
          total: selected.price,
          depositAmount: 0,
        }));
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const whatsappNumber = cleanWhatsApp(footerContact.whatsapp || footerContact.phone);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F9FAFB] font-sans antialiased">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />

      <Navbar currentRoute={currentRoute} onNavigateRoute={handleNavigateRoute} />

      <Hero
        currentRoute={currentRoute}
        onQuoteClick={() => handleScrollTo('cotizador')}
        onGalleryClick={() => handleScrollTo('galerias')}
        onCitaClick={() => handleScrollTo('solicitud')}
        heroCovers={heroCovers}
        heroCoverSettings={heroCoverSettings}
      />

      <GallerySection
        currentRoute={currentRoute}
        onNavigateRoute={handleNavigateRoute}
        images={galleryImages}
        onShowToast={showToast}
      />

      <PricingQuoteEngine
        currentRoute={currentRoute}
        onNavigateRoute={handleNavigateRoute}
        bookingState={bookingState}
        onUpdateBookingState={setBookingState}
        onProceedToBooking={() => handleScrollTo('solicitud')}
        packages={packagesState}
        addons={addonsState}
      />

      <InPersonConsultation bookingState={bookingState} onNavigateToQuote={() => handleScrollTo('cotizador')} onShowToast={showToast} />

      <BookingWizard
        bookingState={bookingState}
        onUpdateBookingState={setBookingState}
        onShowToast={showToast}
        packages={packagesState}
        addons={addonsState}
      />

      <Footer onNavigateRoute={handleNavigateRoute} footerContact={footerContact} />
      <WhatsAppFloatingButton bookingState={bookingState} phoneNumber={`52${whatsappNumber}`} />
    </div>
  );
}
