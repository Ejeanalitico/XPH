/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BookingState,
  ToastMessage,
  RoutePath,
  EventType,
  PackageOption,
  AddOnOption,
  QuoteRecord,
  AdminCredentials,
  GalleryImage,
  FooterContact,
  Testimonial,
} from './types';
import { GALLERY_IMAGES } from './data/gallery';
import { PACKAGES_BY_EVENT, ADDONS_CATALOG } from './data/packages';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { GallerySection } from './components/GallerySection';
import { PricingQuoteEngine } from './components/PricingQuoteEngine';
import { InPersonConsultation } from './components/InPersonConsultation';
import { BookingWizard } from './components/BookingWizard';
import { TestimonialsSection } from './components/TestimonialsSection';
import { ClientPortalModal } from './components/ClientPortalModal';
import { AdminPortalModal } from './components/AdminPortalModal';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import { ToastContainer } from './components/Toast';
import { Footer } from './components/Footer';

export default function App() {
  // Current active route for SPA multi-page simulation
  const [currentRoute, setCurrentRoute] = useState<RoutePath>('inicio');

  // Admin Credentials State (Default: Xavier.garcia.vp@gmail.com / 1234)
  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>({
    email: 'Xavier.garcia.vp@gmail.com',
    pass: '1234',
  });

  // Dynamic Packages & Addons State (Editable via Admin Panel)
  const [packagesState, setPackagesState] = useState<Record<EventType, PackageOption[]>>(PACKAGES_BY_EVENT);
  const [addonsState, setAddonsState] = useState<AddOnOption[]>(ADDONS_CATALOG);

  // Gallery Images State (Editable by Admin)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(GALLERY_IMAGES);

  // Footer Contact State (Editable by Admin)
  const [footerContact, setFooterContact] = useState<FooterContact>({
    phone: '+52 55 1234 5678',
    whatsapp: '+52 55 1234 5678',
    email: 'contacto@xavi.ph',
    address: 'CDMX, Estado de México, Morelos, Puebla, Querétaro, Tlaxcala & Pachuca',
    schedule: 'Lunes a Sábado: 09:00 - 19:00 hrs',
    aboutText: 'Estudio especializado en fotografía editorial, cine documental y fotografía empresarial con cobertura en CDMX, Estado de México, Morelos, Tlaxcala, Puebla, Pachuca, Querétaro y toda la República.',
  });

  // Testimonials State (Editable by Admin & submitable by clients)
  const [testimonials, setTestimonials] = useState<Testimonial[]>([
    {
      id: 't-1',
      clientName: 'Renata & Mateo',
      eventType: 'bodas',
      date: '2026-07-15',
      rating: 5,
      comment: 'Xavi capturó la esencia pura de nuestra boda en Polanco. La luz, el profesionalismo y la calidez en la cita presencial nos dieron absoluta confianza.',
      verified: true,
    },
    {
      id: 't-2',
      clientName: 'Familia Gómez Suárez',
      eventType: 'bautizos',
      date: '2026-06-20',
      rating: 5,
      comment: 'Impresionante atención y sensibilidad con nuestro bebé. La entrega del álbum físico con pasta en lino es una joya que conservaremos siempre.',
      verified: true,
    },
    {
      id: 't-3',
      clientName: 'Grupo Financiero Lomas',
      eventType: 'empresarial',
      date: '2026-08-01',
      rating: 5,
      comment: 'Excelente fotografía ejecutiva y de branding para nuestra directiva en CDMX. Entregas puntuales y de nivel internacional.',
      verified: true,
    },
  ]);

  // Quotes & Contracts List (Recorded in real-time)
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
      depositAmount: 9900,
      eventDate: '2026-10-14',
      eventCity: 'Oaxaca, Oax.',
      status: 'Contratado',
      createdAt: '2026-08-10',
      notes: 'Cita presencial realizada. Muestras de lino aprobadas.',
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
      depositAmount: 7200,
      eventDate: '2026-11-28',
      eventCity: 'CDMX',
      status: 'Cita Presencial Agendada',
      createdAt: '2026-08-11',
      notes: 'Agendó cita presencial en San Ángel para ver álbumes físicos.',
    },
    {
      id: 'quote-103',
      clientName: 'Mariana Ríos',
      clientEmail: 'mariana.rios@editorial.com',
      clientPhone: '+52 55 3344 5566',
      eventType: 'retratos',
      selectedPackageId: 'pareja',
      packageName: 'SESIÓN PAREJA / EDITORIAL',
      packagePrice: 6800,
      addons: ['Entrega Prioritaria Express 48 Horas'],
      extraHours: 0,
      total: 9800,
      depositAmount: 2940,
      eventDate: '2026-09-05',
      eventCity: 'San Miguel de Allende',
      status: 'Pendiente',
      createdAt: '2026-08-11',
      notes: 'Cotización generada desde la web.',
    },
  ]);

  // Global Booking State Object
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
    depositAmount: 7350,
  });

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>(['img-1', 'img-4']);

  // Modals state
  const [clientPortalOpen, setClientPortalOpen] = useState<boolean>(false);
  const [adminPortalOpen, setAdminPortalOpen] = useState<boolean>(false);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Hash / URL routing synchronization
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

  // Apply dark / light class on HTML document root
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

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleNavigateRoute = (route: RoutePath) => {
    setCurrentRoute(route);
    window.history.pushState({}, '', `#/${route}`);

    // Update default booking state for the navigated route
    if (route !== 'inicio') {
      const eventTypeKey = route as EventType;
      const availablePackages = packagesState[eventTypeKey] || packagesState.bodas;
      const defaultPackage = availablePackages.find((p) => p.popular) || availablePackages[0];

      setBookingState((prev) => {
        let addonsSum = 0;
        prev.selectedAddons.forEach((addonId) => {
          const item = addonsState.find((a) => a.id === addonId);
          if (item && item.type === 'checkbox') addonsSum += item.price;
        });
        const extraHoursAddon = addonsState.find((a) => a.id === 'extra_hours');
        const extraHoursRate = extraHoursAddon ? extraHoursAddon.price : 2000;
        const extraHoursPrice = prev.extraHours * extraHoursRate;
        const total = defaultPackage.price + addonsSum + extraHoursPrice;

        return {
          ...prev,
          eventType: eventTypeKey,
          selectedPackageId: defaultPackage.id,
          total,
          depositAmount: Math.round(total * 0.3),
        };
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Navegando a ${route.toUpperCase()}`, 'Cargando paquetes y contenidos específicos.');
  };

  const handleToggleFavorite = (imageId: string) => {
    setFavorites((prev) => {
      const exists = prev.includes(imageId);
      const next = exists ? prev.filter((id) => id !== imageId) : [...prev, imageId];
      if (exists) {
        showToast('Removida de Favoritas', 'La imagen fue removida de tu lista personal.');
      } else {
        showToast('¡Agregada a Favoritas!', 'La imagen fue guardada en tu colección personal.', 'success');
      }
      return next;
    });
  };

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
    showToast(
      isDarkMode ? 'Modo Claro Activado' : 'Modo Oscuro Activado',
      'Cambiando el tema visual de la interfaz.'
    );
  };

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSendWhatsApp = () => {
    const phoneNumber = '525512345678';

    const categoryNames: Record<string, string> = {
      bodas: 'BODAS DESTINATION',
      'xv-anos': 'QUINCEAÑERAS (XV AÑOS)',
      bautizos: 'BAUTIZOS Y EVENTOS FAMILIARES',
      retratos: 'RETRATOS Y EDITORIAL',
    };

    const categoryLabel = categoryNames[bookingState.eventType] || bookingState.eventType.toUpperCase();

    const activePackages = packagesState[bookingState.eventType] || packagesState.bodas;
    const selectedPkg = activePackages.find((p) => p.id === bookingState.selectedPackageId) || activePackages[0];

    const activeAddonsNames = bookingState.selectedAddons
      .map((id) => {
        const addon = addonsState.find((a) => a.id === id);
        return addon ? addon.name : '';
      })
      .filter(Boolean);

    if (bookingState.extraHours > 0) {
      activeAddonsNames.push(`${bookingState.extraHours} Horas Extra de Cobertura`);
    }

    // Save Quote to Admin State
    const newQuoteRecord: QuoteRecord = {
      id: `quote-${Date.now()}`,
      clientName: bookingState.clientName || 'Cliente Cita Presencial',
      clientEmail: bookingState.clientEmail || 'contacto@whatsapp.com',
      clientPhone: bookingState.clientPhone || '+52 55 1234 5678',
      eventType: bookingState.eventType,
      selectedPackageId: bookingState.selectedPackageId,
      packageName: selectedPkg.name,
      packagePrice: selectedPkg.price,
      addons: activeAddonsNames,
      extraHours: bookingState.extraHours,
      total: bookingState.total,
      depositAmount: bookingState.depositAmount,
      eventDate: bookingState.date || 'Por definir',
      eventCity: bookingState.eventCity || 'CDMX',
      status: 'Cita Presencial Agendada',
      createdAt: new Date().toISOString().split('T')[0],
      notes: bookingState.notes || 'Solicitud de Cita Presencial iniciada vía WhatsApp.',
      signatureDataUrl: bookingState.signatureDataUrl,
    };

    setQuotesState((prev) => [newQuoteRecord, ...prev]);

    const messageText = `Hola Xavi.Ph! 👋 Quisiera agendar una cita presencial y reservar mi fecha:

📸 Categoría de Evento: ${categoryLabel}
📦 Paquete Seleccionado: ${selectedPkg.name} ($${selectedPkg.price.toLocaleString('es-MX')} MXN)
🗓️ Fecha Estimada: ${bookingState.date || 'Por definir'}
✨ Add-ons Activos: ${activeAddonsNames.length > 0 ? activeAddonsNames.join(', ') : 'Ninguno'}
💰 Total Cotizado: $${bookingState.total.toLocaleString('es-MX')} MXN (Anticipo 30%: $${bookingState.depositAmount.toLocaleString('es-MX')} MXN)

🤝 Solicito agendar una Visita Presencial / Cita Personalizada para conocer el equipo, ver muestras de álbumes físicos y coordinar la logística. ¡Gracias!`;

    const encodedUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(messageText)}`;
    window.open(encodedUrl, '_blank');
    showToast('Cita Registrada', 'La solicitud de cita fue guardada en el sistema de administración.');
  };

  // Handlers for Gallery Images Admin
  const handleAddGalleryImage = (image: GalleryImage) => {
    setGalleryImages((prev) => [image, ...prev]);
  };

  const handleDeleteGalleryImage = (id: string) => {
    setGalleryImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Handlers for Testimonials
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
      {/* Toast Notifications Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Header & Navbar */}
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

      {/* Dynamic Hero Section */}
      <Hero
        currentRoute={currentRoute}
        onQuoteClick={() => handleScrollTo('cotizador')}
        onGalleryClick={() => handleScrollTo('galerias')}
        onCitaClick={() => handleScrollTo('cierre-presencial')}
      />

      {/* Gallery Section with Masonry & Lightbox */}
      <GallerySection
        currentRoute={currentRoute}
        images={galleryImages}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onShowToast={showToast}
      />

      {/* Package Matrix & Real-time Quote Engine */}
      <PricingQuoteEngine
        currentRoute={currentRoute}
        bookingState={bookingState}
        onUpdateBookingState={setBookingState}
        onProceedToBooking={() => handleScrollTo('contratacion')}
        onSendWhatsApp={handleSendWhatsApp}
        packages={packagesState}
        addons={addonsState}
      />

      {/* VIP Human Service & In-Person Appointment Section */}
      <InPersonConsultation
        bookingState={bookingState}
        onSendWhatsApp={handleSendWhatsApp}
        onNavigateToQuote={() => handleScrollTo('cotizador')}
        onShowToast={showToast}
      />

      {/* 4-Step Booking & Contract Signature Wizard */}
      <BookingWizard
        bookingState={bookingState}
        onUpdateBookingState={setBookingState}
        onShowToast={showToast}
        onSendWhatsApp={handleSendWhatsApp}
        packages={packagesState}
        addons={addonsState}
      />

      {/* Client Testimonials Section */}
      <TestimonialsSection
        testimonials={testimonials}
        onAddTestimonial={handleAddTestimonial}
        onShowToast={showToast}
      />

      {/* Footer */}
      <Footer
        onNavigateRoute={handleNavigateRoute}
        onOpenClientPortal={() => setClientPortalOpen(true)}
        onOpenAdminPortal={() => setAdminPortalOpen(true)}
        footerContact={footerContact}
      />

      {/* WhatsApp Floating CTA */}
      <WhatsAppFloatingButton bookingState={bookingState} />

      {/* Client Access Portal Modal (PIN '1234' Demo) */}
      <ClientPortalModal
        isOpen={clientPortalOpen}
        onClose={() => setClientPortalOpen(false)}
        onShowToast={showToast}
      />

      {/* Admin / Photographer Portal Modal */}
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
