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
  PackageOption,
  RoutePath,
  ToastMessage,
} from './types';
import { GALLERY_IMAGES } from './data/gallery';
import { ADDONS_CATALOG, PACKAGES_BY_EVENT } from './data/packages';
import { BookingWizard } from './components/BookingWizard';
import { Footer } from './components/Footer';
import { GallerySection } from './components/GallerySection';
import { Hero } from './components/Hero';
import { InPersonConsultation } from './components/InPersonConsultation';
import { Navbar } from './components/Navbar';
import { PricingQuoteEngine } from './components/PricingQuoteEngine';
import { ToastContainer } from './components/Toast';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';

const COMMERCIAL_WHATSAPP = '525516342663';

const FOOTER_CONTACT: FooterContact = {
  phone: '+52 55 1634 2663',
  whatsapp: '+52 55 1634 2663',
  email: 'contacto@xavi.ph',
  address: 'CDMX, Estado de México, Morelos, Puebla, Querétaro, Tlaxcala y Pachuca',
  schedule: 'Atención por WhatsApp y citas previamente coordinadas',
  aboutText:
    'Fotografía y video para bodas, XV años, sesiones y eventos, con cobertura en CDMX, Estado de México y estados de la zona centro.',
};

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<RoutePath>('inicio');
  const [packagesState] = useState<Record<EventType, PackageOption[]>>(PACKAGES_BY_EVENT);
  const [addonsState] = useState<AddOnOption[]>(ADDONS_CATALOG);
  const [galleryImages] = useState<GalleryImage[]>(GALLERY_IMAGES);

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

  const [favorites, setFavorites] = useState<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      const validRoutes: RoutePath[] = [
        'inicio',
        'bodas',
        'xv-anos',
        'bautizos',
        'retratos',
        'empresarial',
      ];
      if (validRoutes.includes(hash as RoutePath)) {
        setCurrentRoute(hash as RoutePath);
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

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [isDarkMode]);

  const showToast = (
    title: string,
    description?: string,
    type: 'success' | 'info' | 'warning' = 'info'
  ) => {
    const newToast: ToastMessage = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      title,
      description,
      type,
    };

    setToasts((prev) => [...prev, newToast]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== newToast.id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const handleNavigateRoute = (route: RoutePath) => {
    setCurrentRoute(route);
    window.history.pushState({}, '', `#/${route}`);

    if (route !== 'inicio') {
      const eventTypeKey = route as EventType;
      const availablePackages = packagesState[eventTypeKey] || packagesState.bodas;
      const defaultPackage = availablePackages.find((pkg) => pkg.popular) || availablePackages[0];

      setBookingState((prev) => {
        const customQuote = defaultPackage.price === 0;
        const nextSelectedAddons = customQuote ? [] : prev.selectedAddons;
        const nextExtraHours = customQuote ? 0 : prev.extraHours;

        const addonsSum = nextSelectedAddons.reduce((sum, addonId) => {
          const item = addonsState.find((addon) => addon.id === addonId);
          return item && item.type === 'checkbox' ? sum + item.price : sum;
        }, 0);

        const extraHoursAddon = addonsState.find((addon) => addon.id === 'extra_hours');
        const extraHoursRate = extraHoursAddon?.price || 0;
        const total = customQuote
          ? 0
          : defaultPackage.price + addonsSum + nextExtraHours * extraHoursRate;

        return {
          ...prev,
          eventType: eventTypeKey,
          selectedPackageId: defaultPackage.id,
          selectedAddons: nextSelectedAddons,
          extraHours: nextExtraHours,
          total,
          depositAmount: 0,
        };
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleFavorite = (imageId: string) => {
    setFavorites((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  const handleScrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendWhatsApp = () => {
    const categoryNames: Record<string, string> = {
      bodas: 'BODAS',
      'xv-anos': 'XV AÑOS',
      bautizos: 'BAUTIZOS Y EVENTOS FAMILIARES',
      retratos: 'RETRATOS Y EDITORIAL',
      empresarial: 'EMPRESARIAL',
    };

    const categoryLabel = categoryNames[bookingState.eventType] || bookingState.eventType.toUpperCase();
    const activePackages = packagesState[bookingState.eventType] || packagesState.bodas;
    const selectedPkg =
      activePackages.find((pkg) => pkg.id === bookingState.selectedPackageId) || activePackages[0];

    const activeAddonsNames = bookingState.selectedAddons
      .map((id) => addonsState.find((addon) => addon.id === id)?.name || '')
      .filter(Boolean);

    if (bookingState.extraHours > 0) {
      activeAddonsNames.push(`${bookingState.extraHours} Horas Extra de Cobertura`);
    }

    const packagePriceText =
      selectedPkg.price > 0
        ? `${selectedPkg.name} ($${selectedPkg.price.toLocaleString('es-MX')} MXN)`
        : `${selectedPkg.name} (cotización personalizada)`;

    const totalText =
      bookingState.total > 0
        ? `$${bookingState.total.toLocaleString('es-MX')} MXN`
        : 'Por cotizar';

    const messageText = `Hola Xavi.Ph. Quisiera solicitar disponibilidad e información para mi evento.\n\n📸 Tipo de evento: ${categoryLabel}\n📦 Paquete de interés: ${packagePriceText}\n🗓️ Fecha tentativa: ${bookingState.date || 'Por definir'}\n📍 Lugar: ${bookingState.eventCity || 'Por definir'}\n✨ Adicionales: ${activeAddonsNames.length > 0 ? activeAddonsNames.join(', ') : 'Ninguno'}\n💰 Total estimado: ${totalText}${bookingState.clientName ? `\n👤 Nombre: ${bookingState.clientName}` : ''}${bookingState.clientEmail ? `\n✉️ Correo: ${bookingState.clientEmail}` : ''}\n\nQuedo pendiente de que me confirmen disponibilidad y los siguientes pasos.`;

    window.open(
      `https://wa.me/${COMMERCIAL_WHATSAPP}?text=${encodeURIComponent(messageText)}`,
      '_blank',
      'noopener,noreferrer'
    );

    showToast(
      'Solicitud preparada',
      'Se abrió WhatsApp con tu información. La fecha queda pendiente de confirmación.',
      'success'
    );
  };

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? 'bg-[#0B0F17] text-[#F9FAFB]' : 'bg-[#F8FAFC] text-[#0F172A]'
      } font-sans antialiased transition-colors duration-300`}
    >
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      <Navbar
        currentRoute={currentRoute}
        onNavigateRoute={handleNavigateRoute}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode((prev) => !prev)}
      />

      <Hero
        currentRoute={currentRoute}
        onQuoteClick={() => handleScrollTo('cotizador')}
        onGalleryClick={() => handleScrollTo('galerias')}
        onCitaClick={() => handleScrollTo('solicitud')}
      />

      <GallerySection
        currentRoute={currentRoute}
        images={galleryImages}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onShowToast={showToast}
      />

      <PricingQuoteEngine
        currentRoute={currentRoute}
        bookingState={bookingState}
        onUpdateBookingState={setBookingState}
        onProceedToBooking={() => handleScrollTo('solicitud')}
        packages={packagesState}
        addons={addonsState}
        onNavigateRoute={handleNavigateRoute}
      />

      <InPersonConsultation
        bookingState={bookingState}
        onSendWhatsApp={handleSendWhatsApp}
        onNavigateToQuote={() => handleScrollTo('cotizador')}
        onShowToast={showToast}
      />

      <BookingWizard
        bookingState={bookingState}
        onUpdateBookingState={setBookingState}
        onShowToast={showToast}
        onSendWhatsApp={handleSendWhatsApp}
        packages={packagesState}
        addons={addonsState}
      />

      <Footer onNavigateRoute={handleNavigateRoute} footerContact={FOOTER_CONTACT} />

      <WhatsAppFloatingButton
        bookingState={bookingState}
        phoneNumber={COMMERCIAL_WHATSAPP}
      />
    </div>
  );
}
