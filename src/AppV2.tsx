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
import {
  filterPublicGalleryImages,
  preloadCriticalPublicMedia,
  readPublicMediaCache,
  writePublicMediaCache,
} from './utils/publicMediaCache';
import { DEFAULT_FOOTER_CONTACT, normalizeFooterContact } from './footerConfig';
import { routePath, updateRouteMetadata } from './utils/seo';

const DEFAULT_WHATSAPP = '5615567863';
const VALID_ROUTES: RoutePath[] = ['inicio', 'bodas', 'xv-anos', 'bautizos', 'retratos', 'empresarial'];

const routeFromLocation = (): RoutePath => {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  if (VALID_ROUTES.includes(hash as RoutePath)) return hash as RoutePath;
  const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return VALID_ROUTES.includes(pathname as RoutePath) ? pathname as RoutePath : 'inicio';
};

const defaultContact: FooterContact = DEFAULT_FOOTER_CONTACT;

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
  const normalized = normalizeFooterContact(cloudContact);
  const whatsapp = cleanWhatsApp(cloudContact?.whatsapp || cloudContact?.phone || DEFAULT_WHATSAPP);
  const cloudPhone = String(cloudContact?.phone || '');
  const looksLikePlaceholder = /1234\s*5678/.test(cloudPhone) || !cloudPhone.trim();
  return {
    ...normalized,
    phone: looksLikePlaceholder ? displayPhoneFromWhatsApp(whatsapp) : normalized.phone,
    whatsapp,
  };
};

export default function AppV2() {
  const [initialMedia] = useState(readPublicMediaCache);
  const [currentRoute, setCurrentRoute] = useState<RoutePath>(routeFromLocation);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(() => initialMedia?.galleryImages || []);
  const [heroCovers, setHeroCovers] = useState<Partial<Record<RoutePath, string>>>(() => initialMedia?.heroCovers || {});
  const [heroCoverSettings, setHeroCoverSettings] = useState<Partial<Record<RoutePath, HeroCoverSetting>>>(() => initialMedia?.heroCoverSettings || {});
  const [mediaReady, setMediaReady] = useState(Boolean(initialMedia));
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
    total: 0,
  });

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  useEffect(() => {
    updateRouteMetadata(currentRoute);
  }, [currentRoute]);

  useEffect(() => {
    let cancelled = false;

    loadSiteDataFromCloud().then(async (cloudData) => {
      if (cancelled) return;
      const data = cloudData || {};

      if (!cloudData) {
        setMediaReady(true);
        return;
      }

      const publicMedia = {
        galleryImages: filterPublicGalleryImages(data.galleryImages),
        heroCovers: data.heroCovers && typeof data.heroCovers === 'object' ? data.heroCovers : {},
        heroCoverSettings: data.heroCoverSettings && typeof data.heroCoverSettings === 'object' ? data.heroCoverSettings : {},
      };

      writePublicMediaCache(publicMedia);
      await preloadCriticalPublicMedia(publicMedia, currentRoute);
      if (cancelled) return;

      setGalleryImages(publicMedia.galleryImages);
      setHeroCovers(publicMedia.heroCovers);
      setHeroCoverSettings(publicMedia.heroCoverSettings);
      setMediaReady(true);
      if (data.promotionPopup && typeof data.promotionPopup === 'object') setPromotionPopup(data.promotionPopup as PromotionPopupConfig);
      else setPromotionPopup(null);

      setPackagesState(resolvePublishedPackages(data));
      setAddonsState(resolvePublishedAddons(data));
      if (data.footerContact) setFooterContact(sanitizePublicContact(data.footerContact));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      const route = routeFromLocation();
      setCurrentRoute(route);
      if (window.location.hash) window.history.replaceState({}, '', routePath(route));
      if (route !== 'inicio') {
        setBookingState((prev) => ({
          ...prev,
          eventType: route as EventType,
          selectedPackageId: '',
          selectedAddons: [],
          extraHours: 0,
          total: 0,
        }));
      }
    };
    handleLocationChange();
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
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
    window.history.pushState({}, '', routePath(route));

    if (route !== 'inicio') {
      setBookingState((prev) => ({
        ...prev,
        eventType: route as EventType,
        selectedPackageId: '',
        selectedAddons: [],
        extraHours: 0,
        total: 0,
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
      <Hero currentRoute={currentRoute} onQuoteClick={() => handleScrollTo('cotizador')} onGalleryClick={() => handleScrollTo('galerias')} onCitaClick={() => handleScrollTo('solicitud')} heroCovers={heroCovers} heroCoverSettings={heroCoverSettings} mediaReady={mediaReady} />
      <GallerySection currentRoute={currentRoute} onNavigateRoute={(route) => handleNavigateRoute(route, true)} images={galleryImages} onShowToast={showToast} loading={!mediaReady} />

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
