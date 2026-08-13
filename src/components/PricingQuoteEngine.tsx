import React, { useState } from 'react';
import { EventType, BookingState, RoutePath, PackageOption, AddOnOption } from '../types';
import { PACKAGES_BY_EVENT, ADDONS_CATALOG } from '../data/packages';
import { Check, Sparkles, Plus, Minus, ShieldCheck, ArrowRight, Clock, MapPin, Calendar, PhoneCall, X, Eye } from 'lucide-react';

interface PricingQuoteEngineProps {
  currentRoute: RoutePath;
  onNavigateRoute: (route: RoutePath) => void;
  bookingState: BookingState;
  onUpdateBookingState: (updater: (prev: BookingState) => BookingState) => void;
  onProceedToBooking: () => void;
  onSendWhatsApp: () => void;
  packages?: Record<EventType, PackageOption[]>;
  addons?: AddOnOption[];
}

export const PricingQuoteEngine: React.FC<PricingQuoteEngineProps> = ({
  currentRoute,
  onNavigateRoute,
  bookingState,
  onUpdateBookingState,
  onProceedToBooking,
  onSendWhatsApp,
  packages = PACKAGES_BY_EVENT,
  addons = ADDONS_CATALOG,
}) => {
  const currentPackages = packages[bookingState.eventType] || packages.bodas;
  const selectedPackage = currentPackages.find((p) => p.id === bookingState.selectedPackageId) || currentPackages[0];

  const categoryLabels: Record<EventType, string> = {
    bodas: 'Bodas CDMX',
    'xv-anos': 'Quinceañeras (XV)',
    bautizos: 'Bautizos & Familia',
    retratos: 'Retratos & Moda',
    empresarial: 'Empresarial & Branding',
  };

  const extraHoursAddon = addons.find((a) => a.id === 'extra_hours');
  const extraHoursPriceRate = extraHoursAddon ? extraHoursAddon.price : 2000;

  const handleSelectEventType = (type: EventType) => {
    onNavigateRoute(type as RoutePath);
    onUpdateBookingState((prev) => {
      const newPackages = packages[type] || packages.bodas;
      const newPackage = newPackages.find((p) => p.id === prev.selectedPackageId) || newPackages[0];
      
      // Calculate new total
      let addonsSum = 0;
      prev.selectedAddons.forEach((addonId) => {
        const item = addons.find((a) => a.id === addonId);
        if (item && item.type === 'checkbox') addonsSum += item.price;
      });
      const extraHoursPrice = prev.extraHours * extraHoursPriceRate;
      const total = newPackage.price + addonsSum + extraHoursPrice;

      return {
        ...prev,
        eventType: type,
        selectedPackageId: newPackage.id,
        total,
        depositAmount: Math.round(total * 0.3),
      };
    });
  };

  const handleSelectPackage = (packageId: string) => {
    onUpdateBookingState((prev) => {
      const pkg = currentPackages.find((p) => p.id === packageId) || currentPackages[0];
      let addonsSum = 0;
      prev.selectedAddons.forEach((addonId) => {
        const item = addons.find((a) => a.id === addonId);
        if (item && item.type === 'checkbox') addonsSum += item.price;
      });
      const extraHoursPrice = prev.extraHours * extraHoursPriceRate;
      const total = pkg.price + addonsSum + extraHoursPrice;

      return {
        ...prev,
        selectedPackageId: packageId,
        total,
        depositAmount: Math.round(total * 0.3),
      };
    });
  };

  const handleToggleAddon = (addonId: string) => {
    onUpdateBookingState((prev) => {
      const exists = prev.selectedAddons.includes(addonId);
      const nextAddons = exists
        ? prev.selectedAddons.filter((id) => id !== addonId)
        : [...prev.selectedAddons, addonId];

      const pkg = currentPackages.find((p) => p.id === prev.selectedPackageId) || currentPackages[0];
      let addonsSum = 0;
      nextAddons.forEach((id) => {
        const item = addons.find((a) => a.id === id);
        if (item && item.type === 'checkbox') addonsSum += item.price;
      });
      const extraHoursPrice = prev.extraHours * extraHoursPriceRate;
      const total = pkg.price + addonsSum + extraHoursPrice;

      return {
        ...prev,
        selectedAddons: nextAddons,
        total,
        depositAmount: Math.round(total * 0.3),
      };
    });
  };

  const handleExtraHoursChange = (delta: number) => {
    onUpdateBookingState((prev) => {
      const nextHours = Math.max(0, prev.extraHours + delta);
      const pkg = currentPackages.find((p) => p.id === prev.selectedPackageId) || currentPackages[0];
      let addonsSum = 0;
      prev.selectedAddons.forEach((id) => {
        const item = addons.find((a) => a.id === id);
        if (item && item.type === 'checkbox') addonsSum += item.price;
      });
      const extraHoursPrice = nextHours * extraHoursPriceRate;
      const total = pkg.price + addonsSum + extraHoursPrice;

      return {
        ...prev,
        extraHours: nextHours,
        total,
        depositAmount: Math.round(total * 0.3),
      };
    });
  };


  const [showPrice, setShowPrice] = useState<boolean>(true);

  return (
    <section id="cotizador" className="py-20 bg-[#0B0F17] relative border-b border-white/5">
      
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div id="paquetes" className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161C28] border border-[#D4AF37]/30 text-xs font-semibold text-[#D4AF37]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>COTIZADOR DINÁMICO EN TIEMPO REAL</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold font-serif-luxury text-white">
            Diseña tu Cobertura Fotográfica a la Medida
          </h2>

          <p className="text-gray-300 text-sm sm:text-base">
            Selecciona la categoría activa, elige tu paquete base y personaliza con add-ons. El total se recalcula al instante en MXN.
          </p>
        </div>

        {/* Category Tabs Selector */}
        <div className="flex justify-center">
          <div className="p-1.5 rounded-2xl bg-[#161C28] border border-white/10 inline-flex flex-wrap justify-center gap-1.5 sm:gap-2 shadow-xl">
            {(['bodas', 'xv-anos', 'bautizos', 'retratos', 'empresarial'] as EventType[]).map((cat) => {
              const isActive = bookingState.eventType === cat;
              return (
                <button
                  key={cat}
                  onClick={() => handleSelectEventType(cat)}
                  className={`px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'gold-gradient-bg text-black font-bold shadow-lg shadow-[#D4AF37]/20 sm:scale-105'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {categoryLabels[cat]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Base Packages Matrix */}
        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {currentPackages.map((pkg) => {
            const isSelected = bookingState.selectedPackageId === pkg.id;
            const isHighlight = pkg.popular;

            return (
              <div
                key={pkg.id}
                onClick={() => handleSelectPackage(pkg.id)}
                className={`relative rounded-2xl p-6 sm:p-8 transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                  isHighlight
                    ? 'bg-[#161C28] border-2 border-[#D4AF37] gold-border-glow sm:scale-105 z-20'
                    : isSelected
                    ? 'bg-[#161C28] border-2 border-[#D4AF37] shadow-xl'
                    : 'bg-[#161C28]/80 border border-white/10 hover:border-white/30 hover:bg-[#161C28]'
                }`}
              >
                {/* Badge if present */}
                {pkg.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gold-gradient-bg text-black font-bold text-[10px] tracking-widest uppercase shadow-md">
                    {pkg.badge}
                  </div>
                )}

                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold font-serif-luxury text-white flex items-center justify-between">
                      <span>{pkg.name}</span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black flex items-center justify-center text-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{pkg.description}</p>
                  </div>

                  {/* Price */}
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white font-mono">
                        ${pkg.price.toLocaleString('es-MX')}
                      </span>
                      <span className="text-xs text-gray-400">MXN</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 block mt-1">
                      Anticipo 30%: ${(pkg.price * 0.3).toLocaleString('es-MX')} MXN
                    </span>
                  </div>

                  {/* Feature List (Incluye) */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#D4AF37] block">
                      ✓ Incluye:
                    </span>
                    <ul className="space-y-2 text-xs text-gray-300">
                      {pkg.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Exclusions List (No Incluye) */}
                  {pkg.notIncludes && pkg.notIncludes.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-white/10">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-rose-400 block">
                        ✕ No Incluye:
                      </span>
                      <ul className="space-y-2 text-xs text-gray-400">
                        {pkg.notIncludes.map((noFeat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-gray-400">
                            <X className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span className="line-through decoration-rose-500/50">{noFeat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Selection Action Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPackage(pkg.id);
                  }}
                  className={`w-full py-3 mt-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'gold-gradient-bg text-black shadow-lg shadow-[#D4AF37]/20'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isSelected ? '✓ Paquete Seleccionado' : 'Seleccionar Paquete'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Dynamic Customizer / Add-On Engine */}
        <div className="p-8 rounded-2xl bg-[#161C28] border border-white/10 space-y-8">
          <div className="border-b border-white/10 pb-4">
            <h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              <span>Añade Servicios Adicionales (Add-Ons Exclusivos)</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Personaliza tu experiencia. Los servicios seleccionados se sincronizan en tu cotización y contrato.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Extra Hours Counter Item */}
            {extraHoursAddon && (
              <div className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#D4AF37]" />
                      <span className="text-sm font-semibold text-white">{extraHoursAddon.name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#D4AF37]">
                      +${extraHoursPriceRate.toLocaleString('es-MX')} MXN/h
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{extraHoursAddon.description}</p>

                  {extraHoursAddon.includes && extraHoursAddon.includes.length > 0 && (
                    <div className="pt-2 border-t border-white/5 space-y-1">
                      <span className="text-[10px] text-[#D4AF37] font-mono font-bold uppercase block">
                        Detalles / Qué Incluye:
                      </span>
                      <ul className="space-y-1 text-[11px] text-gray-300">
                        {extraHoursAddon.includes.map((inc, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-[#D4AF37] shrink-0" />
                            <span>{inc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-xs text-gray-400 font-mono">Horas añadidas:</span>
                  <div className="flex items-center gap-3 bg-[#0B0F17] p-1.5 rounded-xl border border-white/10">
                    <button
                      onClick={() => handleExtraHoursChange(-1)}
                      disabled={bookingState.extraHours === 0}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-mono font-bold text-sm text-[#D4AF37]">
                      {bookingState.extraHours}h
                    </span>
                    <button
                      onClick={() => handleExtraHoursChange(1)}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Checkbox Catalog Items */}
            {addons.filter((a) => a.type === 'checkbox').map((addon) => {
              const isChecked = bookingState.selectedAddons.includes(addon.id);
              return (
                <div
                  key={addon.id}
                  onClick={() => handleToggleAddon(addon.id)}
                  className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isChecked
                      ? 'bg-[#D4AF37]/10 border-[#D4AF37] shadow-lg shadow-[#D4AF37]/5'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? 'bg-[#D4AF37] border-[#D4AF37] text-black' : 'border-white/30 bg-transparent'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className="text-sm font-semibold text-white">{addon.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#D4AF37] whitespace-nowrap">
                        +${addon.price.toLocaleString('es-MX')} MXN
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 leading-relaxed pl-8">{addon.description}</p>

                    {addon.includes && addon.includes.length > 0 && (
                      <div className="pl-8 pt-2 border-t border-white/5 space-y-1">
                        <span className="text-[10px] text-[#D4AF37] font-mono font-bold uppercase block">
                          Qué Incluye este Adicional:
                        </span>
                        <ul className="space-y-1 text-[11px] text-gray-300">
                          {addon.includes.map((inc, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <Check className="w-3 h-3 text-[#D4AF37] shrink-0" />
                              <span>{inc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
        </div>

      </div>

      {/* Floating Sticky Bottom Bar for Live Total & Quote Conversion */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0B0F17]/95 backdrop-blur-xl border-t border-[#D4AF37]/40 p-2.5 sm:p-4 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
          
          {/* Summary Details */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-4 text-left">
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-mono truncate max-w-[200px] sm:max-w-none">
                {selectedPackage.name} — {categoryLabels[bookingState.eventType]}
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-white font-mono">
                  ${bookingState.total.toLocaleString('es-MX')}
                </span>
                <span className="text-[11px] text-emerald-400 font-mono hidden sm:inline">
                  (Anticipo 30%: ${bookingState.depositAmount.toLocaleString('es-MX')})
                </span>
              </div>
            </div>

            <div className="sm:hidden text-right">
              <span className="text-[9px] text-emerald-400 uppercase font-mono block">Anticipo 30%</span>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                ${bookingState.depositAmount.toLocaleString('es-MX')}
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={onSendWhatsApp}
              className="flex-1 sm:flex-none px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Agendar Cita</span>
            </button>

            <button
              onClick={onProceedToBooking}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl gold-gradient-bg text-black font-extrabold text-xs tracking-wide shadow-xl shadow-[#D4AF37]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Reservar Fecha</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    </section>
  );
};
