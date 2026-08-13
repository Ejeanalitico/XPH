import React from 'react';
import { BookingState } from '../types';
import { PACKAGES_BY_EVENT, ADDONS_CATALOG } from '../data/packages';

interface WhatsAppFloatingButtonProps {
  bookingState: BookingState;
  phoneNumber?: string;
}

export const WhatsAppFloatingButton: React.FC<WhatsAppFloatingButtonProps> = ({
  bookingState,
  phoneNumber = '525512345678',
}) => {
  const currentPackages = PACKAGES_BY_EVENT[bookingState.eventType] || PACKAGES_BY_EVENT.bodas;
  const selectedPackage = currentPackages.find((p) => p.id === bookingState.selectedPackageId) || currentPackages[0];

  const activeAddonsNames = bookingState.selectedAddons.map((id) => {
    const addon = ADDONS_CATALOG.find((a) => a.id === id);
    return addon ? addon.name : '';
  }).filter(Boolean);

  if (bookingState.extraHours > 0) {
    activeAddonsNames.push(`${bookingState.extraHours} Horas Extra de Cobertura`);
  }

  const categoryNames: Record<string, string> = {
    bodas: 'BODAS DESTINATION',
    'xv-anos': 'QUINCEAÑERAS (XV AÑOS)',
    bautizos: 'BAUTIZOS Y EVENTOS FAMILIARES',
    retratos: 'RETRATOS Y EDITORIAL',
    empresarial: 'EMPRESARIAL Y BRANDING',
  };

  const categoryLabel = categoryNames[bookingState.eventType] || bookingState.eventType.toUpperCase();

  const messageText = `Hola Xavi.Ph! 👋 Quisiera agendar una cita presencial y reservar mi fecha:

📸 Categoría de Evento: ${categoryLabel}
📦 Paquete Seleccionado: ${selectedPackage.name} ($${selectedPackage.price.toLocaleString('es-MX')} MXN)
🗓️ Fecha Estimada: ${bookingState.date || 'Por definir'}
✨ Add-ons Activos: ${activeAddonsNames.length > 0 ? activeAddonsNames.join(', ') : 'Ninguno'}
💰 Total Cotizado: $${bookingState.total.toLocaleString('es-MX')} MXN (Anticipo 30%: $${bookingState.depositAmount.toLocaleString('es-MX')} MXN)

🤝 Solicito agendar una Visita Presencial / Cita Personalizada para conocer el equipo, ver muestras de álbumes físicos y coordinar la logística. ¡Gracias!`;

  const encodedUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(messageText)}`;

  return (
    <a
      href={encodedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-24 sm:bottom-28 right-3.5 sm:right-6 z-40 p-3 sm:p-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-2xl shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group cursor-pointer"
      title="Agendar Cita Presencial vía WhatsApp"
    >
      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.285-.143-1.687-.833-1.947-.928-.26-.095-.45-.143-.639.143-.19.286-.736.928-.903 1.118-.166.19-.333.214-.618.071-.285-.143-1.205-.444-2.296-1.416-.848-.757-1.421-1.692-1.587-1.978-.166-.285-.018-.439.125-.581.129-.128.285-.333.428-.5.143-.166.19-.285.285-.476.095-.19.048-.357-.024-.5-.071-.143-.639-1.538-.876-2.108-.23-.555-.464-.48-.638-.488-.164-.008-.354-.01-.544-.01s-.5.071-.762.357c-.261.286-1 1-.976 2.438.024 1.438 1.023 2.828 1.166 3.018.143.19 2.012 3.073 4.876 4.31.681.294 1.213.47 1.626.601.684.218 1.307.187 1.8.114.549-.082 1.687-.69 1.925-1.357.238-.667.238-1.238.166-1.357-.071-.119-.261-.19-.546-.333z"/>
      </svg>

      {/* Hover Tooltip */}
      <span className="absolute right-16 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-[#0B0F17] text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 shadow-xl pointer-events-none">
        Agendar Cita Presencial
      </span>
    </a>
  );
};
