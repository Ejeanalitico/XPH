/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AddOnOption,
  AdminCredentials,
  BookingState,
  EventType,
  FooterContact,
  GalleryImage,
  PackageOption,
  QuoteRecord,
  RoutePath,
  Testimonial,
  ToastMessage,
} from './types';
import { GALLERY_IMAGES } from './data/gallery';
import { ADDONS_CATALOG, PACKAGES_BY_EVENT } from './data/packages';
import { AdminPortalModal } from './components/AdminPortalModal';
import { BookingWizard } from './components/BookingWizard';
import { ClientPortalModal } from './components/ClientPortalModal';
import { Footer } from './components/Footer';
import { GallerySection } from './components/GallerySection';
import { Hero } from './components/Hero';
import { InPersonConsultation } from './components/InPersonConsultation';
import { Navbar } from './components/Navbar';
import { PricingQuoteEngine } from './components/PricingQuoteEngine';
import { TestimonialsSection } from './components/TestimonialsSection';
import { ToastContainer } from './components/Toast';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<RoutePath>('inicio');

  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>({
    email: 'Xavier.garcia.vp@gmail.com',
    pass: '1234',
  });

  const [packagesState, setPackagesState] = useState<Record<EventType, PackageOption[]>>(PACKAGES_BY_EVENT);
  const [addonsState, setAddonsState] = useState<AddOnOption[]>(ADDONS_CATALOG);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(GALLERY_IMAGES);

  const [footerContact, setFooterContact] = useState<FooterContact>({
    phone: '+52 55 1234 5678',
    whatsapp: '+52 55 1234 5678',
    email: 'contacto@xavi.ph',
    address: 'CDMX, Estado de México, Morelos, Puebla, Querétaro, Tlaxcala & Pachuca',
    schedule: 'Lunes a Sábado: 09:00 - 19:00 hrs',
    aboutText:
      'Estudio especializado en fotografía editorial, cine documental y fotografía empresarial con cobertura en CDMX, Estado de México, Morelos, Tlaxcala, Puebla, Pachuca, Querétaro y toda la República.',
  });

  const [testimonials, setTestimonials] = useState<Testimonial[]>([
    {
      id: 't-1',
      clientName: 'Renata & Mateo',
      eventType: 'bodas',
      date: '2026-07-15',
      rating: 5,
      comment:
        'Xavi capturó la esencia pura de nuestra boda en Polanco. La luz, el profesionalismo y la calidez en la cita presencial nos dieron absoluta confianza.',
      verified: true,
    },
    {
      id: 't-2',
      clientName: 'Familia Gómez Suárez',
      eventType: 'bautizos',
      date: '2026-06-20',
      rating: 5,
      comment:
        'Impresionante atención y sensibilidad con nuestro bebé. La entrega del álbum físico con pasta en lino es una joya que conservaremos siempre.',
      verified: true,
    },
    {
      id: 't-3',
      clientName: 'Grupo Financiero Lomas',
      eventType: 'empresarial',
      date: '2026-08-01',
      rating: 5,
      comment:
        'Excelente fotografía ejecutiva y de branding para nuestra directiva en CDMX. Entregas puntuales y de nivel internacional.',
      verified: true,
    },
  ]);

  const [quotesState, setQuotesState] = useState<QuoteRecord[]>([
    {
      id: 'quote-101',
      clientName: 'Valeria & Carlos',
      clientEmail: 'valeria.carlos@gmail.com',
      clientPhone: '+52 55 9876 5432',
      eventType: 'bodas',
      selectedPackageId: 'pro',
      packageName: 'COBERTURA TOTAL (PRO)',
      packagePrice: 24500,
      addons: ['Photobook Impreso para Padres', 'Horas Extra (+2h)'],
      extraHours: 2,
      total: 33000,
      depositAmount: 0,
      eventDate: '2026-10-14',
      eventCity: 'Oaxaca, Oax.',
      status: 'Pendiente',
      createdAt: '2026-08-10',
      notes: 'Solicitud de información registrada.',
    },
    {
      id: 'quote-102',
      clientName: 'Sofía Martínez',
      clientEmail: 'sofia.xv@gmail.com',
      clientPhone: '+52 55 1234 9988',
      eventType: 'xv-anos',
      selectedPackageId: 'pro',
      packageName: 'PAQUETE XV PRO',
      packagePrice: 21500,
      addons: ['Cuadro Impreso 50x70cm'],
      extraHours: 0,
      total: 24000,
      depositAmount: 0,
      eventDate: '2026-11-28',
      eventCity: 'CDMX',
      status: 'Pendiente',
      createdAt: '2026-08-11',
      notes: 'Solicitud de disponibilidad pendiente de confirmación.',
    },
  ]);

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
    total: 24500,
    depositAmount: 0,
  });

  const [favorites, setFavorites] = useState<string[]>(['img-1', 'img-4']);
  const [clientPortalOpen, setClientPortalOpen] = useState(false);
  const [adminPortalOpen, setAdminPortalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      const validRoutes: RoutePath[] = ['inicio', 'bodas', 'xv-anos', 'bautizos', 'retratos'];
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
        let addonsSum = 0;
        prev.selectedAddons.forEach((addonId) => {
          const item = addonsState.find((addon) => addon.id === addonId);
          if (item && item.type === 'checkbox') addonsSum += item.price;
        });

        const extraHoursAddon = addonsState.find((addon) => addon.id === 'extra_hours');
        const extraHoursRate = extraHoursAddon ? extraHoursAddon.price : 0;
        const total = defaultPackage.price + addonsSum + prev.extraHours * extraHoursRate;

        return {
          ...prev,
          eventType: eventTypeKey,
          selectedPackageId: defaultPackage.id,
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

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleScrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendWhatsApp = () => {
    const phoneNumber = '525512345678';

    const categoryNames: Record<string, string> = {
      bodas: 'BODAS',
      'xv-anos': 'XV AÑOS',
      bautizos: 'BAUTIZOS Y EVENTOS FAMILIARES',
      retratos: 'RETRATOS Y EDITORIAL',
      empresarial: 'EMPRESARIAL',
    };

    const categoryLabel = categoryNames[bookingState.eventType] || bookingState.eventType.toUpperCase();
    const activePackages = packagesState[bookingState.eventType] || packagesState.bodas;
    const selectedPkg = activePackages.find((pkg) => pkg.id === bookingState.selectedPackageId) || activePackages[0];

    const activeAddonsNames = bookingState.selectedAddons
      .map((id) => addonsState.find((addon) => addon.id === id)?.name || '')
      .filter(Boolean);

    if (bookingState.extraHours > 0) {
      activeAddonsNames.push(`${bookingState.extraHours} Horas Extra de Cobertura`);
    }

    const newQuoteRecord: QuoteRecord = {
      id: `quote-${Date.now()}`,
      clientName: bookingState.clientName || 'Prospecto web',
      clientEmail: bookingState.clientEmail || 'Sin correo',
      clientPhone: bookingState.clientPhone || 'Sin teléfono',
      eventType: bookingState.eventType,
      selectedPackageId: bookingState.selectedPackageId,
      packageName: selectedPkg.name,
      packagePrice: selectedPkg.price,
      addons: activeAddonsNames,
      extraHours: bookingState.extraHours,
      total: bookingState.total,
      depositAmount: 0,
      eventDate: bookingState.date || 'Por definir',
      eventCity: bookingState.eventCity || 'Por definir',
      status: 'Pendiente',
      createdAt: new Date().toISOString().split('T')[0],
      notes: bookingState.notes || 'Solicitud de disponibilidad iniciada desde la web.',
    };

    setQuotesState((prev) => [newQuoteRecord, ...prev]);

    const messageText = `Hola Xavi.Ph. Quisiera solicitar disponibilidad e información para mi evento.\n\n📸 Tipo de evento: ${categoryLabel}\n📦 Paquete de interés: ${selectedPkg.name} ($${selectedPkg.price.toLocaleString('es-MX')} MXN)\n🗓️ Fecha tentativa: ${bookingState.date || 'Por definir'}\n📍 Lugar: ${bookingState.eventCity || 'Por definir'}\n✨ Adicionales: ${activeAddonsNames.length > 0 ? activeAddonsNames.join(', ') : 'Ninguno'}\n💰 Total estimado: $${bookingState.total.toLocaleString('es-MX')} MXN\n\nQuedo pendiente de que me confirmen disponibilidad y los siguientes pasos.`;

    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(messageText)}`, '_blank');
    showToast(
      'Solicitud preparada',
      'Se abrió WhatsApp con tu información. La fecha queda pendiente de confirmación.',
      'success'
    );
  };

  const handleAddGalleryImage = (image: GalleryImage) => {
    setGalleryImages((prev) => [image, ...prev]);
  };

  const handleDeleteGalleryImage = (id: string) => {
    setGalleryImages((prev) => prev.filter((image) => image.id !== id));
  };

  const handleAddTestimonial = (newTestimonial: Omit<Testimonial, 'id' | 'verified'>) => {
    const created: Testimonial = {
      id: `t-${Date.now()}`,
      verified: false,
      ...newTestimonial,
    };
    setTestimonials((prev) => [created, ...prev]);
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
        favoritesCount={favorites.length}
        onOpenFavorites={() => handleScrollTo('galerias')}
        onOpenClientPortal={() => setClientPortalOpen(true)}
        onOpenAdminPortal={() => setAdminPortalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
      />

      <Hero
        currentRoute={currentRoute}
        onQuoteClick={() => handleScrollTo('cotizador')}
        onGalleryClick={() => handleScrollTo('galerias')}
        onCitaClick={() => handleScrollTo('cierre-presencial')}
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
        onSendWhatsApp={handleSendWhatsApp}
        packages={packagesState}
        addons={addonsState}
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

      <TestimonialsSection
        testimonials={testimonials}
        onAddTestimonial={handleAddTestimonial}
        onShowToast={showToast}
      />

      <Footer
        onNavigateRoute={handleNavigateRoute}
        onOpenClientPortal={() => setClientPortalOpen(true)}
        onOpenAdminPortal={() => setAdminPortalOpen(true)}
        footerContact={footerContact}
      />

      <WhatsAppFloatingButton bookingState={bookingState} />

      <ClientPortalModal
        isOpen={clientPortalOpen}
        onClose={() => setClientPortalOpen(false)}
        onShowToast={showToast}
      />

      <AdminPortalModal
        isOpen={adminPortalOpen}
        onClose={() => setAdminPortalOpen(false)}
        onShowToast={showToast}
        adminCredentials={adminCredentials}
        onUpdateAdminCredentials={setAdminCredentials}
        packages={packagesState}
        onUpdatePackages={setPackagesState}
        addons={addonsState}
        onUpdateAddons={setAddonsState}
        quotes={quotesState}
        onUpdateQuotes={setQuotesState}
        galleryImages={galleryImages}
        onAddGalleryImage={handleAddGalleryImage}
        onDeleteGalleryImage={handleDeleteGalleryImage}
        footerContact={footerContact}
        onUpdateFooterContact={setFooterContact}
        testimonials={testimonials}
        onUpdateTestimonials={setTestimonials}
      />
    </div>
  );
}
