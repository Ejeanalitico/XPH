import React from 'react';
import { AddOnOption, BookingState, EventType, PackageOption } from '../types';

interface Props {
  bookingState: BookingState;
  phoneNumber: string;
  packages: Record<EventType, PackageOption[]>;
  addons: AddOnOption[];
}

export const WhatsAppFloatingButtonV2: React.FC<Props> = ({ bookingState, phoneNumber, packages, addons }) => {
  const selectedPackage = (packages[bookingState.eventType] || []).find((pkg) => pkg.id === bookingState.selectedPackageId);
  const activeAddons = bookingState.selectedAddons
    .map((id) => addons.find((addon) => addon.id === id)?.name)
    .filter(Boolean) as string[];
  if (bookingState.extraHours > 0) activeAddons.push(`${bookingState.extraHours} hora${bookingState.extraHours === 1 ? '' : 's'} extra`);

  const message = selectedPackage
    ? `Hola XPH Fotografía & Video. Quisiera información sobre ${selectedPackage.name}. Total estimado: $${Math.max(0, bookingState.total).toLocaleString('es-MX')} MXN. Anticipo 40%: $${Math.round(Math.max(0, bookingState.total) * 0.4).toLocaleString('es-MX')} MXN.${activeAddons.length ? ` Adicionales: ${activeAddons.join(', ')}.` : ''}`
    : 'Hola XPH Fotografía & Video. Quisiera información sobre sus servicios y disponibilidad.';

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-24 sm:bottom-24 right-4 sm:right-6 z-[65] p-3.5 sm:p-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-2xl shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center"
      title="Consultar por WhatsApp"
      aria-label="Consultar por WhatsApp"
    >
      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.285-.143-1.687-.833-1.947-.928-.26-.095-.45-.143-.639.143-.19.286-.736.928-.903 1.118-.166.19-.333.214-.618.071-.285-.143-1.205-.444-2.296-1.416-.848-.757-1.421-1.692-1.587-1.978-.166-.285-.018-.439.125-.581.129-.128.285-.333.428-.5.143-.166.19-.285.285-.476.095-.19.048-.357-.024-.5-.071-.143-.639-1.538-.876-2.108-.23-.555-.464-.48-.638-.488-.164-.008-.354-.01-.544-.01s-.5.071-.762.357c-.261.286-1 1-.976 2.438.024 1.438 1.023 2.828 1.166 3.018.143.19 2.012 3.073 4.876 4.31.681.294 1.213.47 1.626.601.684.218 1.307.187 1.8.114.549-.082 1.687-.69 1.925-1.357.238-.667.238-1.238.166-1.357-.071-.119-.261-.19-.546-.333z" /></svg>
    </a>
  );
};
