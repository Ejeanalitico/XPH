import React from 'react';
import { ArrowRight, Calculator } from 'lucide-react';
import { AddOnOption, BookingState, EventType, PackageOption } from '../types';

interface StickyQuoteBarProps {
  bookingState: BookingState;
  packages: Record<EventType, PackageOption[]>;
  addons: AddOnOption[];
  onProceed: () => void;
}

export const StickyQuoteBar: React.FC<StickyQuoteBarProps> = ({ bookingState, packages, addons, onProceed }) => {
  const selectedPackage = (packages[bookingState.eventType] || []).find((pkg) => pkg.id === bookingState.selectedPackageId);
  const selectedAddons = bookingState.selectedAddons
    .map((id) => addons.find((addon) => addon.id === id))
    .filter((addon): addon is AddOnOption => Boolean(addon));
  const total = selectedPackage ? Math.max(0, bookingState.total || 0) : 0;
  const deposit = Math.round(total * 0.4);
  const extraCount = selectedAddons.length + (bookingState.extraHours > 0 ? 1 : 0);

  return (
    <aside className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#D4AF37]/30 bg-[#0B0F17]/95 backdrop-blur-xl shadow-[0_-12px_40px_rgba(0,0,0,.45)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-6">
        <div className="hidden sm:flex w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/25 items-center justify-center shrink-0">
          <Calculator className="w-5 h-5 text-[#D4AF37]" />
        </div>

        <div className="min-w-0 flex-1 grid grid-cols-2 sm:flex sm:items-center sm:gap-8">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-gray-500 font-mono">Total</p>
            <p className="text-lg sm:text-2xl font-black text-white font-mono leading-tight">${total.toLocaleString('es-MX')} <span className="text-[10px] sm:text-xs text-gray-500 font-sans">MXN</span></p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-gray-500 font-mono">Anticipo 40%</p>
            <p className="text-lg sm:text-2xl font-black text-[#D4AF37] font-mono leading-tight">${deposit.toLocaleString('es-MX')} <span className="text-[10px] sm:text-xs text-gray-500 font-sans">MXN</span></p>
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-xs font-semibold text-gray-200 truncate">{selectedPackage?.name || 'Selecciona un paquete'}</p>
            <p className="text-[10px] text-gray-500">{selectedPackage ? `${extraCount} complemento${extraCount === 1 ? '' : 's'} seleccionado${extraCount === 1 ? '' : 's'}` : 'El total comenzará en $0'}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onProceed}
          disabled={!selectedPackage}
          className="shrink-0 px-3.5 sm:px-6 py-3 rounded-xl gold-gradient-bg text-black font-extrabold text-[11px] sm:text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline">Solicita tu cotización</span>
          <span className="sm:hidden">Cotizar</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
