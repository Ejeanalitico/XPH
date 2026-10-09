/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AddOnOption,
  BookingState,
  CatalogCategory,
  EventType,
  FooterContact,
  GalleryImage,
  HeroCoverSetting,
  PackageOption,
  RoutePath,
  SeoSettings,
  ToastMessage,
} from './types';
import { PACKAGES_BY_EVENT, ADDONS_CATALOG } from './data/packages';
import { resolvePublishedAddons, resolvePublishedPackages } from './utils/catalogMerge';
import {
  categoryForRoute,
  categoryRouteFromSlug,
  DEFAULT_CATALOG_CATEGORIES,
  resolvePublishedCategories,
} from './utils/catalogCategories';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { GallerySection } from './components/GallerySection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { PricingQuoteEngineV2 } from './components/PricingQuoteEngineV2';
import { InPersonConsultation } from './components/InPersonConsultation';
import { BookingWizardV2 } from './components/BookingWizardV2';
import { WhatsAppFloatingButtonV2 } from './components/WhatsAppFloatingButtonV2';
import { StickyQuoteBar } from './components/StickyQuoteBar';
import { PromotionPopup } from './components/PromotionPopup';
import { PromotionPopupConfig } from './promotion';
import { ToastContainer } from './components/Toast';
import { Footer } from './components/Footer';
import { ServiceSeoSection } from './components/ServiceSeoSection';
import { loadSiteDataFromCloud } from './utils/googleDrive';
import {
  filterPublicGalleryImages,
  readPublicMediaCache,
  writePublicMediaCache,
} from './utils/publicMediaCache';
import { DEFAULT_FOOTER_CONTACT, normalizeFooterContact } from './footerConfig';
import { normalizeSeoSettings, routePath, updateRouteMetadata } from './utils/seo';

const DEFAULT_WHATSAPP = '5615567863';
const BUILT_IN_ROUTES: RoutePath[] = ['inicio', 'bodas', 'xv-anos', 'bautizos', 'retratos', 'empresarial'];

const routeFromLocation = (categories: CatalogCategory[] = DEFAULT_CATALOG_CATEGORIES): RoutePath => {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  const hashCategory = categoryRouteFromSlug(hash, categories);
  if (hashCategory) return hashCategory;
  if (BUILT_IN_ROUTES.includes(hash as RoutePath)) return hash as RoutePath;
  const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const categoryRoute = categoryRouteFromSlug(pathname, categories);
  if (categoryRoute) return categoryRoute;
  return BUILT_IN_ROUTES.includes(pathname as RoutePath) ? pathname as RoutePath : 'inicio';
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
  const [currentRoute, setCurrentRoute] = useState<RoutePath>(() => routeFromLocation());
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(() => initialMedia?.galleryImages || []);
  const [heroCovers, setHeroCovers] = useState<Partial<Record<RoutePath, string>>>(() => initialMedia?.heroCovers || {});
  const [heroCoverSettings, setHeroCoverSettings] = useState<Partial<Record<RoutePath, HeroCoverSetting>>>(() => initialMedia?.heroCoverSettings || {});
  const [mediaReady, setMediaReady] = useState(Boolean(initialMedia));
  const [footerContact, setFooterContact] = useState<FooterContact>(defaultContact);
  // Do not offer historical bundled prices before the current published catalog loads.
  const [packagesState, setPackagesState] = useState<Record<EventType, PackageOption[]>>({} as Record<EventType, PackageOption[]>);
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>(DEFAULT_CATALOG_CATEGORIES);
  const [addonsState, setAddonsState] = useState<AddOnOption[]>(ADDONS_CATALOG);
  const [promotionPopup, setPromotionPopup] = useState<PromotionPopupConfig | null>(null);
  const [seoSettings, setSeoSettings] = useState<SeoSettings>({});
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
    updateRouteMetadata(currentRoute, seoSettings, categoryForRoute(currentRoute, catalogCategories));
  }, [currentRoute, seoSettings, catalogCategories]);

  useEffect(() => {
    let cancelled = false;

    loadSiteDataFromCloud().then((cloudData) => {
      if (cancelled) return;
      const data = cloudData || {};

      if (!cloudData) {
        setMediaReady(true);
        setCatalogStatus('unavailable');
        return;
      }

      const publicMedia = {
        galleryImages: filterPublicGalleryImages(data.galleryImages),
        heroCovers: data.heroCovers && typeof data.heroCovers === 'object' ? data.heroCovers : {},
        heroCoverSettings: data.heroCoverSettings && typeof data.heroCoverSettings === 'object' ? data.heroCoverSettings : {},
      };

      if (data.promotionPopup && typeof data.promotionPopup === 'object') setPromotionPopup(data.promotionPopup as PromotionPopupConfig);
      else setPromotionPopup(null);

      writePublicMediaCache(publicMedia);
      setGalleryImages(publicMedia.galleryImages);
      setHeroCovers(publicMedia.heroCovers);
      setHeroCoverSettings(publicMedia.heroCoverSettings);
      setMediaReady(true);

      const publishedPackages = resolvePublishedPackages(data);
      const publishedCategories = resolvePublishedCategories(data, publishedPackages);
      const requestedRoute = routeFromLocation(publishedCategories);
      setPackagesState(publishedPackages);
      setCatalogCategories(publishedCategories);
      setCurrentRoute(requestedRoute);
      if (requestedRoute !== 'inicio') {
        setBookingState((prev) => ({
          ...prev,
          eventType: requestedRoute,
          selectedPackageId: '',
          selectedAddons: [],
          extraHours: 0,
          total: 0,
        }));
      }
      setAddonsState(resolvePublishedAddons(data));
      if (data.footerContact) setFooterContact(sanitizePublicContact(data.footerContact));
      setSeoSettings(normalizeSeoSettings(data.seoSettings, publishedCategories));
      setCatalogStatus('ready');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      const route = routeFromLocation(catalogCategories);
      setCurrentRoute((previous) => previous === route ? previous : route);
      if (window.location.hash) window.history.replaceState({}, '', routePath(route, catalogCategories));
      if (route !== 'inicio') {
        setBookingState((prev) => prev.eventType === route ? prev : ({
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
  }, [catalogCategories]);


  // Refresh prices when the administrator publishes or a visitor returns to a tab.
  useEffect(() => {
    let disposed = false;
    let refreshing = false;
    const refreshPublishedPrices = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const config = await loadSiteDataFromCloud();
        if (disposed) return;
        if (!config) {
          setCatalogStatus('unavailable');
          return;
        }
        const currentPackages = resolvePublishedPackages(config);
        const currentAddons = resolvePublishedAddons(config);
        setPackagesState(currentPackages);
        setAddonsState(currentAddons);
        setCatalogStatus('ready');
        setBookingState((previous) => {
          const selected = (currentPackages[previous.eventType] || []).find((pkg) => pkg.id === previous.selectedPackageId);
          if (!selected) {
            if (!previous.selectedPackageId && previous.total === 0) return previous;
            return { ...previous, selectedPackageId: '', selectedAddons: [], extraHours: 0, total: 0 };
          }
          const selectedAddons = previous.selectedAddons.filter((id) => currentAddons.some((addon) => addon.id === id));
          const addonCost = selectedAddons.reduce((sum, id) => {
            const addon = currentAddons.find((item) => item.id === id);
            return sum + (addon?.type === 'checkbox' ? addon.price : 0);
          }, 0);
          const hourRate = currentAddons.find((item) => item.id === 'extra_hours')?.price || 0;
          return { ...previous, selectedAddons, total: selected.price === 0 ? 0 : selected.price + addonCost + previous.extraHours * hourRate };
        });
      } finally {
        refreshing = false;
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshPublishedPrices(); };
    const onPublish = (event: StorageEvent) => { if (event.key === 'xph:catalog-updated') void refreshPublishedPrices(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onPublish);
    return () => {
      disposed = true;
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onPublish);
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
    window.history.pushState({}, '', routePath(route, catalogCategories));

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

      <Navbar currentRoute={currentRoute} categories={catalogCategories} onNavigateRoute={(route) => handleNavigateRoute(route, false)} />
      <Hero currentRoute={currentRoute} categories={catalogCategories} onQuoteClick={() => handleScrollTo('cotizador')} onGalleryClick={() => handleScrollTo('galerias')} onCitaClick={() => handleScrollTo('solicitud')} heroCovers={heroCovers} heroCoverSettings={heroCoverSettings} mediaReady={mediaReady} />
      <GallerySection currentRoute={currentRoute} onNavigateRoute={(route) => handleNavigateRoute(route, true)} images={galleryImages} categories={catalogCategories} onShowToast={showToast} loading={!mediaReady} />
      <ServiceSeoSection currentRoute={currentRoute} categories={catalogCategories} packages={packagesState[currentRoute] || []} onNavigateRoute={(route) => handleNavigateRoute(route, false)} onQuoteClick={() => handleScrollTo('cotizador')} />

      {catalogStatus === 'ready' ? (
      <PricingQuoteEngineV2
        currentRoute={currentRoute}
        onNavigateRoute={(route) => handleNavigateRoute(route, true)}
        bookingState={bookingState}
        onUpdateBookingState={setBookingState}
        onProceedToBooking={() => handleScrollTo('solicitud')}
        packages={packagesState}
        addons={addonsState}
        categories={catalogCategories}
      />
      ) : (
        <section id="cotizador" aria-live="polite" className="mx-auto max-w-4xl px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-white">{catalogStatus === 'loading' ? 'Cargando precios actualizados...' : 'Precios temporalmente no disponibles'}</h2>
          <p className="mt-3 text-sm text-gray-300">{catalogStatus === 'loading' ? 'Consultando el catálogo publicado.' : 'No fue posible verificar los precios vigentes. Consulta directamente con XPH antes de contratar.'}</p>
        </section>
      )}

      <InPersonConsultation bookingState={bookingState} onNavigateToQuote={() => handleScrollTo('cotizador')} onShowToast={showToast} />
      {catalogStatus === 'ready' && <BookingWizardV2 bookingState={bookingState} onUpdateBookingState={setBookingState} onShowToast={showToast} packages={packagesState} addons={addonsState} categories={catalogCategories} />}
      {currentRoute === 'inicio' ? <TestimonialsSection /> : null}
      <Footer onNavigateRoute={(route) => handleNavigateRoute(route, false)} footerContact={footerContact} categories={catalogCategories} />

      <WhatsAppFloatingButtonV2 bookingState={bookingState} phoneNumber={`52${whatsappNumber}`} packages={packagesState} addons={addonsState} />
      {catalogStatus === 'ready' && <StickyQuoteBar bookingState={bookingState} packages={packagesState} addons={addonsState} onProceed={() => handleScrollTo('solicitud')} />}
    </div>
  );
}
