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
import { resolvePublishedAddons, resolvePublishedPackages } from './utils/catalogMerge';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { GallerySection } from './components/GallerySection';
import { PricingQuoteEngineV2 } from './components/PricingQuoteEngineV2';
import { InPersonConsultation } from './components/InPersonConsultation';
import { BookingWizardV2 } from './components/BookingWizardV2';
import { WhatsAppFloatingButtonV2 } from './components/WhatsAppFloatingButtonV2';
import { StickyQuoteBar } from './components/StickyQuoteBar';
import { PromotionPopup } from './components/PromotionPopup';
import { PromotionPopupConfig } from './promotion';
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

export default function AppV2() {
  const [currentRoute, setCurrentRoute] = useState<RoutePath>('inicio');
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [heroCovers, setHeroCovers] = useState<Partial<Record<RoutePath, string>>>({});
  const [heroCoverSettings, setHeroCoverSettings] = useState<Partial<Record<RoutePath, HeroCoverSetting>>>({});
  const [footerContact, setFooterContact] = useState<FooterContact>(defaultContact);
  const [packagesState, setPackagesState] = useState<Record<EventType, PackageOption[]>>(PACKAGES_BY_EVENT);
  const [addonsState, setAddonsState] = useState<AddOnOption[]>(ADDONS_CATALOG);
  const [promotionPopup, setPromotionPopup] = useState<PromotionPopupConfig | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [bookingState, setBookingState] = useState<BookingState>({
    eventType: 'bodas',
    selectedPackageId: '',
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
    total: 0,
    depositAmount: 0,
  });

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  useEffect(() => {
    loadSiteDataFromCloud().then((cloudData) => {
      const data = cloudData || {};

      if (Array.isArray(data.galleryImages)) {
        const realGallery = data.galleryImages.filter((image: GalleryImage) =>
          Boolean(
            image?.id && image?.url && image?.category &&
            image.visibility !== 'private' && image.visibility !== 'cover' &&
            image.mediaType !== 'gallery-meta' && image.mediaType !== 'cover-meta' &&
            image.mediaType !== 'video' && image.category !== 'private'
          )
        );
        setGalleryImages(realGallery);
      }

      if (data.heroCovers && typeof data.heroCovers === 'object') setHeroCovers(data.heroCovers);
      if (data.heroCoverSettings && typeof data.heroCoverSettings === 'object') setHeroCoverSettings(data.heroCoverSettings);
      if (data.promotionPopup && typeof data.promotionPopup === 'object') setPromotionPopup(data.promotionPopup as PromotionPopupConfig);
      else setPromotionPopup(null);

      setPackagesState(resolvePublishedPackages(data));
      setAddonsState(resolvePublishedAddons(data));
      if (data.footerContact) setFooterContact(sanitizePublicContact(data.footerContact));
    });
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      const validRoutes: RoutePath[] = ['inicio', 'bodas', 'xv-anos', 'bautizos', 'retratos', 'empresarial'];
      if (!validRoutes.includes(hash as RoutePath)) return;
      const route = hash as RoutePath;
      setCurrentRoute(route);
      if (route !== 'inicio') {
        setBookingState((prev) => ({
          ...prev,
          eventType: route as EventType,
          selectedPackageId: '',
          selectedAddons: [],
          extraHours: 0,
          total: 0,
          depositAmount: 0,
        }));
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const showToast = (title: string, description?: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const toast: ToastMessage = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, description, type };
    setToasts((prev) => [...prev, toast]);
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== toast.id)), 4000);
  };

  const handleNavigateRoute = (route: RoutePath, preserveScroll = false) => {
    const previousScrollY = window.scrollY;
    setCurrentRoute(route);
    window.history.pushState({}, '', route === 'inicio' ? '#/inicio' : `#/${route}`);

    if (route !== 'inicio') {
      setBookingState((prev) => ({
        ...prev,
        eventType: route as EventType,
        selectedPackageId: '',
        selectedAddons: [],
        extraHours: 0,
        total: 0,
        depositAmount: 0,
      }));
    }

    if (preserveScroll) {
      window.requestAnimationFrame(() => window.scrollTo({ top: previousScrollY, behavior: 'auto' }));
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleScrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const whatsappNumber = cleanWhatsApp(footerContact.whatsapp || footerContact.phone);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F9FAFB] font-sans antialiased pb-24 sm:pb-20">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
      <PromotionPopup config={promotionPopup} />

      <Navbar currentRoute={currentRoute} onNavigateRoute={(route) => handleNavigateRoute(route, false)} />
      <Hero currentRoute={currentRoute} onQuoteClick={() => handleScrollTo('cotizador')} onGalleryClick={() => handleScrollTo('galerias')} onCitaClick={() => handleScrollTo('solicitud')} heroCovers={heroCovers} heroCoverSettings={heroCoverSettings} />
      <GallerySection currentRoute={currentRoute} onNavigateRoute={(route) => handleNavigateRoute(route, true)} images={galleryImages} onShowToast={showToast} />

      <PricingQuoteEngineV2
        currentRoute={currentRoute}
        onNavigateRoute={(route) => handleNavigateRoute(route, true)}
        bookingState={bookingState}
        onUpdateBookingState={setBookingState}
        onProceedToBooking={() => handleScrollTo('solicitud')}
        packages={packagesState}
        addons={addonsState}
      />

      <InPersonConsultation bookingState={bookingState} onNavigateToQuote={() => handleScrollTo('cotizador')} onShowToast={showToast} />
      <BookingWizardV2 bookingState={bookingState} onUpdateBookingState={setBookingState} onShowToast={showToast} packages={packagesState} addons={addonsState} />
      <Footer onNavigateRoute={(route) => handleNavigateRoute(route, false)} footerContact={footerContact} />

      <WhatsAppFloatingButtonV2 bookingState={bookingState} phoneNumber={`52${whatsappNumber}`} packages={packagesState} addons={addonsState} />
      <StickyQuoteBar bookingState={bookingState} packages={packagesState} addons={addonsState} onProceed={() => handleScrollTo('solicitud')} />
    </div>
  );
}
