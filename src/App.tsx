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

import { saveSiteDataToCloud, loadSiteDataFromCloud } from './utils/googleDrive';

export default function App() {
  // Current active route for SPA multi-page simulation
  const [currentRoute, setCurrentRoute] = useState<RoutePath>('inicio');

  // Admin Credentials State (Default: Xavier.garcia.vp@gmail.com / 1234)
  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>(() => {
    try {
      const saved = localStorage.getItem('xph_admin_credentials');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      email: 'Xavier.garcia.vp@gmail.com',
      pass: '1234',
    };
  });

  // Dynamic Packages & Addons State (Editable via Admin Panel)
  const [packagesState, setPackagesState] = useState<Record<EventType, PackageOption[]>>(() => {
    try {
      const saved = localStorage.getItem('xph_packages');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return PACKAGES_BY_EVENT;
  });

  const [addonsState, setAddonsState] = useState<AddOnOption[]>(() => {
    try {
      const saved = localStorage.getItem('xph_addons');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return ADDONS_CATALOG;
  });

  // Gallery Images State — persisted in localStorage and synced with Cloud
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(() => {
    try {
      const saved = localStorage.getItem('xph_gallery_images');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return GALLERY_IMAGES;
  });

  // Footer Contact State (Editable by Admin)
  const [footerContact, setFooterContact] = useState<FooterContact>(() => {
    try {
      const saved = localStorage.getItem('xph_footer_contact');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      phone: '+52 55 1234 5678',
      whatsapp: '5615567863',
      email: 'contacto@xavi.ph',
      address: 'CDMX, Estado de México, Morelos, Puebla, Querétaro, Tlaxcala & Pachuca',
      schedule: 'Lunes a Sábado: 09:00 - 19:00 hrs',
      aboutText: 'Estudio especializado en fotografía editorial, cine documental y fotografía empresarial con cobertura en CDMX, Estado de México, Morelos, Tlaxcala, Puebla, Pachuca, Querétaro y toda la República.',
    };
  });

  // Testimonials State (Editable by Admin & submitable by clients)
  const [testimonials, setTestimonials] = useState<Testimonial[]>(() => {
    try {
      const saved = localStorage.getItem('xph_testimonials');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [
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
    ];
  });

  // Quotes & Contracts List (Recorded in real-time)
  const [quotesState, setQuotesState] = useState<QuoteRecord[]>(() => {
    try {
      const saved = localStorage.getItem('xph_quotes');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [
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
        status: 'Pendiente',
        createdAt: '2026-08-11',
        notes: 'Cotización generada desde la web.',
      },
    ];
  });

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
    depositAmount: 9800,
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

  // Load shared configuration from Cloud (Google Apps Script) on mount
  useEffect(() => {
    loadSiteDataFromCloud().then((cloudData) => {
      if (cloudData) {
        if (cloudData.packages && typeof cloudData.packages === 'object') {
          const mergedPackages: Record<EventType, PackageOption[]> = { ...PACKAGES_BY_EVENT };
          (Object.keys(cloudData.packages) as EventType[]).forEach((cat) => {
            if (Array.isArray(cloudData.packages[cat]) && cloudData.packages[cat].length > 0) {
              mergedPackages[cat] = cloudData.packages[cat].map((p: any) => ({
                ...p,
                features: Array.isArray(p.features) ? p.features : (Array.isArray(p.includes) ? p.includes : []),
                notIncludes: Array.isArray(p.notIncludes) ? p.notIncludes : []
              }));
            }
          });
          setPackagesState(mergedPackages);
          try { localStorage.setItem('xph_packages', JSON.stringify(mergedPackages)); } catch (_) {}
        }
        if (cloudData.addons && Array.isArray(cloudData.addons) && cloudData.addons.length > 0) {
          setAddonsState(cloudData.addons);
          try { localStorage.setItem('xph_addons', JSON.stringify(cloudData.addons)); } catch (_) {}
        }
        if (cloudData.footerContact && Object.keys(cloudData.footerContact).length > 0) {
          setFooterContact(cloudData.footerContact);
          try { localStorage.setItem('xph_footer_contact', JSON.stringify(cloudData.footerContact)); } catch (_) {}
        }
        if (cloudData.testimonials && Array.isArray(cloudData.testimonials) && cloudData.testimonials.length > 0) {
          setTestimonials(cloudData.testimonials);
          try { localStorage.setItem('xph_testimonials', JSON.stringify(cloudData.testimonials)); } catch (_) {}
        }
        if (cloudData.galleryImages && Array.isArray(cloudData.galleryImages) && cloudData.galleryImages.length > 0) {
          setGalleryImages(cloudData.galleryImages);
          try { localStorage.setItem('xph_gallery_images', JSON.stringify(cloudData.galleryImages)); } catch (_) {}
        }
        if (cloudData.quotes && Array.isArray(cloudData.quotes) && cloudData.quotes.length > 0) {
          setQuotesState(cloudData.quotes);
          try { localStorage.setItem('xph_quotes', JSON.stringify(cloudData.quotes)); } catch (_) {}
        }
        if (cloudData.adminCredentials && Object.keys(cloudData.adminCredentials).length > 0) {
          setAdminCredentials(cloudData.adminCredentials);
          try { localStorage.setItem('xph_admin_credentials', JSON.stringify(cloudData.adminCredentials)); } catch (_) {}
        }
      }
    });
  }, []);

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

  // Persist gallery images to localStorage whenever they change
  // We skip base64 images to avoid exceeding localStorage quota (~5MB)
  useEffect(() => {
    try {
      const toSave = galleryImages.filter(
        (img) => !img.url.startsWith('data:image/')
      );
      localStorage.setItem('xph_gallery_images', JSON.stringify(toSave));
    } catch (e) {
      console.warn('localStorage quota exceeded — gallery not persisted', e);
    }
  }, [galleryImages]);

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
          depositAmount: Math.round(total * 0.4),
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

  const getCleanWhatsAppNumber = (contact: FooterContact) => {
    const raw = contact.whatsapp || contact.phone || '5215615567863';
    const digits = raw.replace(/[^0-9]/g, '');
    // Ensure full international format: if starts with 52 use as is, otherwise prefix
    if (digits.length === 10) return '52' + digits;
    if (digits.length === 12 && digits.startsWith('52')) return digits;
    return digits || '5215615567863';
  };

  const handleSendWhatsApp = () => {
    const phoneNumber = getCleanWhatsAppNumber(footerContact);

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

    const updatedQuotes = [newQuoteRecord, ...quotesState];
    setQuotesState(updatedQuotes);
    try { localStorage.setItem('xph_quotes', JSON.stringify(updatedQuotes)); } catch (_) {}
    syncToCloud(
      { quotes: updatedQuotes },
      'NUEVA_COTIZACION_WHATSAPP',
      `Cotización registrada para ${bookingState.clientName || 'Cliente'} (${categoryLabel} - ${selectedPkg.name})`
    );

    const messageText = `Hola Xavi.Ph! 👋 Quisiera agendar una cita presencial y reservar mi fecha:

📸 Categoría de Evento: ${categoryLabel}
📦 Paquete Seleccionado: ${selectedPkg.name} ($${selectedPkg.price.toLocaleString('es-MX')} MXN)
🗓️ Fecha Estimada: ${bookingState.date || 'Por definir'}
✨ Add-ons Activos: ${activeAddonsNames.length > 0 ? activeAddonsNames.join(', ') : 'Ninguno'}
💰 Total Cotizado: $${bookingState.total.toLocaleString('es-MX')} MXN (Anticipo 40%: $${bookingState.depositAmount.toLocaleString('es-MX')} MXN)

🤝 Solicito agendar una Visita Presencial / Cita Personalizada para conocer el equipo, ver muestras de álbumes físicos y coordinar la logística. ¡Gracias!`;

    const encodedUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(messageText)}`;
    window.open(encodedUrl, '_blank');
    showToast('Cita Registrada', 'La solicitud de cita fue guardada y registrada en el sistema de administración.');
  };

  // Helper to sync cloud config
  const syncToCloud = async (
    overrides?: Record<string, any>,
    auditType = 'ACTUALIZACION_GENERAL',
    auditDetails = 'Modificación guardada desde panel Admin'
  ): Promise<boolean> => {
    const dataToSync = {
      packages: packagesState,
      addons: addonsState,
      footerContact,
      testimonials,
      quotes: quotesState,
      adminCredentials,
      galleryImages: galleryImages.filter((img) => !img.url.startsWith('data:image/')),
      ...overrides,
    };
    return await saveSiteDataToCloud(dataToSync, auditType, auditDetails);
  };

  const handleSavePrices = async (newPackages: Record<EventType, PackageOption[]>, newAddons: AddOnOption[]) => {
    setPackagesState(newPackages);
    setAddonsState(newAddons);
    try {
      localStorage.setItem('xph_packages', JSON.stringify(newPackages));
      localStorage.setItem('xph_addons', JSON.stringify(newAddons));
    } catch (_) {}
    const ok = await syncToCloud(
      { packages: newPackages, addons: newAddons },
      'ACTUALIZACION_PAQUETES_PRECIOS',
      'Catálogo de paquetes, precios y adicionales actualizado en Google Sheets'
    );
    if (!ok) {
      throw new Error('La sincronización con Google Sheets no pudo completarse. Revisa la conexión.');
    }
    return ok;
  };

  const handleUpdatePackages = async (newPackages: Record<EventType, PackageOption[]>) => {
    setPackagesState(newPackages);
    try { localStorage.setItem('xph_packages', JSON.stringify(newPackages)); } catch (_) {}
    return await syncToCloud({ packages: newPackages }, 'ACTUALIZACION_PAQUETES', 'Catálogo de paquetes y precios actualizado');
  };

  const handleUpdateAddons = async (newAddons: AddOnOption[]) => {
    setAddonsState(newAddons);
    try { localStorage.setItem('xph_addons', JSON.stringify(newAddons)); } catch (_) {}
    return await syncToCloud({ addons: newAddons }, 'ACTUALIZACION_ADDONS', 'Catálogo de servicios adicionales actualizado');
  };

  const handleUpdateFooterContact = async (newFooter: FooterContact) => {
    setFooterContact(newFooter);
    try { localStorage.setItem('xph_footer_contact', JSON.stringify(newFooter)); } catch (_) {}
    return await syncToCloud({ footerContact: newFooter }, 'ACTUALIZACION_CONTACTO', `Teléfono: ${newFooter.phone} | Email: ${newFooter.email}`);
  };

  const handleUpdateTestimonials = async (newTestimonials: Testimonial[]) => {
    setTestimonials(newTestimonials);
    try { localStorage.setItem('xph_testimonials', JSON.stringify(newTestimonials)); } catch (_) {}
    return await syncToCloud({ testimonials: newTestimonials }, 'ACTUALIZACION_TESTIMONIOS', `Total testimonios activos: ${newTestimonials.length}`);
  };

  const handleUpdateQuotes = async (newQuotes: QuoteRecord[]) => {
    setQuotesState(newQuotes);
    try { localStorage.setItem('xph_quotes', JSON.stringify(newQuotes)); } catch (_) {}
    return await syncToCloud({ quotes: newQuotes }, 'ACTUALIZACION_COTIZACIONES', `Total cotizaciones registradas: ${newQuotes.length}`);
  };

  const handleUpdateAdminCredentials = async (newCreds: AdminCredentials) => {
    setAdminCredentials(newCreds);
    try { localStorage.setItem('xph_admin_credentials', JSON.stringify(newCreds)); } catch (_) {}
    return await syncToCloud({ adminCredentials: newCreds }, 'ACTUALIZACION_CREDENCIALES', `Email administrador actualizado a: ${newCreds.email}`);
  };

  // Handlers for Gallery Images Admin
  const handleAddGalleryImage = async (image: GalleryImage) => {
    const next = [image, ...galleryImages.filter((img) => img.id !== image.id)];
    const toSave = next.filter((img) => !img.url.startsWith('data:image/'));
    setGalleryImages(next);
    try { localStorage.setItem('xph_gallery_images', JSON.stringify(toSave)); } catch (_) {}
    return await syncToCloud(
      { galleryImages: toSave },
      'FOTO_AGREGADA',
      `Foto "${image.title}" (${image.category}) agregada al portafolio`
    );
  };

  const handleDeleteGalleryImage = async (id: string) => {
    const deletedItem = galleryImages.find((img) => img.id === id);
    const next = galleryImages.filter((img) => img.id !== id);
    const toSave = next.filter((img) => !img.url.startsWith('data:image/'));
    setGalleryImages(next);
    try { localStorage.setItem('xph_gallery_images', JSON.stringify(toSave)); } catch (_) {}
    return await syncToCloud(
      { galleryImages: toSave },
      'FOTO_ELIMINADA',
      `Foto "${deletedItem?.title || id}" eliminada de la galería`
    );
  };

  // Handlers for Testimonials
  const handleAddTestimonial = (newTestimonial: Omit<Testimonial, 'id' | 'verified'>) => {
    const created: Testimonial = {
      id: `t-${Date.now()}`,
      verified: false,
      ...newTestimonial,
    };
    setTestimonials((prev) => {
      const next = [created, ...prev];
      try { localStorage.setItem('xph_testimonials', JSON.stringify(next)); } catch (_) {}
      syncToCloud({ testimonials: next });
      return next;
    });
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
        onNavigateRoute={handleNavigateRoute}
        images={galleryImages}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onShowToast={showToast}
      />

      {/* Package Matrix & Real-time Quote Engine */}
      <PricingQuoteEngine
        currentRoute={currentRoute}
        onNavigateRoute={handleNavigateRoute}
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
      <WhatsAppFloatingButton
        bookingState={bookingState}
        phoneNumber={getCleanWhatsAppNumber(footerContact)}
      />

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
        onUpdateAdminCredentials={handleUpdateAdminCredentials}
        packages={packagesState}
        onUpdatePackages={handleUpdatePackages}
        addons={addonsState}
        onUpdateAddons={handleUpdateAddons}
        onSavePrices={handleSavePrices}
        quotes={quotesState}
        onUpdateQuotes={handleUpdateQuotes}
        galleryImages={galleryImages}
        onAddGalleryImage={handleAddGalleryImage}
        onDeleteGalleryImage={handleDeleteGalleryImage}
        footerContact={footerContact}
        onUpdateFooterContact={handleUpdateFooterContact}
        testimonials={testimonials}
        onUpdateTestimonials={handleUpdateTestimonials}
      />
    </div>
  );
}
