import React from 'react';
import { Check, Minus, Plus, Sparkles, X } from 'lucide-react';
import { AddOnOption, BookingState, EventType, PackageOption, RoutePath } from '../types';
import { ADDONS_CATALOG, PACKAGES_BY_EVENT } from '../data/packages';

interface Props {
  currentRoute: RoutePath;
  onNavigateRoute?: (route: RoutePath) => void;
  bookingState: BookingState;
  onUpdateBookingState: (updater: (prev: BookingState) => BookingState) => void;
  onProceedToBooking: () => void;
  packages?: Record<EventType, PackageOption[]>;
  addons?: AddOnOption[];
}

export const PricingQuoteEngineV2: React.FC<Props> = ({
  bookingState,
  onUpdateBookingState,
  onProceedToBooking,
  onNavigateRoute,
  packages: providedPackages = PACKAGES_BY_EVENT,
  addons: providedAddons = ADDONS_CATALOG,
}) => {
  const packages = providedPackages;
  const addons = providedAddons;
  const configured = packages[bookingState.eventType];
  const currentPackages = [...(configured?.length ? configured : PACKAGES_BY_EVENT[bookingState.eventType])].sort((a, b) => a.price - b.price);
  const selectedPackage = currentPackages.find((pkg) => pkg.id === bookingState.selectedPackageId);
  const extraHoursAddon = addons.find((addon) => addon.id === 'extra_hours');
  const extraHoursRate = extraHoursAddon?.price || 0;
  const validAddonIds = new Set(addons.map((addon) => addon.id));
  const selectedAddonIds = bookingState.selectedAddons.filter((id) => validAddonIds.has(id));

  const calculateTotal = (pkg: PackageOption | undefined, selectedAddons: string[], extraHours: number) => {
    if (!pkg || pkg.price === 0) return 0;
    const addonsTotal = selectedAddons.reduce((sum, addonId) => {
      const addon = addons.find((item) => item.id === addonId);
      return addon && addon.type === 'checkbox' ? sum + addon.price : sum;
    }, 0);
    return pkg.price + addonsTotal + extraHours * extraHoursRate;
  };

  const quotedTotal = calculateTotal(selectedPackage, selectedAddonIds, bookingState.extraHours);
  const isCustomQuote = selectedPackage?.price === 0;

  const categoryLabels: Record<EventType, string> = {
    bodas: 'Bodas',
    'xv-anos': 'XV Años',
    bautizos: 'Bautizos',
    retratos: 'Retratos',
    empresarial: 'Empresarial',
  };

  const commitState = (next: Partial<BookingState>, nextTotal?: number) => {
    onUpdateBookingState((prev) => {
      const total = nextTotal ?? (typeof next.total === 'number' ? next.total : prev.total);
      return { ...prev, ...next, total, depositAmount: Math.round(Math.max(0, total) * 0.4) };
    });
  };

  const handleSelectEventType = (eventType: EventType) => {
    commitState({
      eventType,
      selectedPackageId: '',
      selectedAddons: [],
      extraHours: 0,
      total: 0,
    }, 0);
    onNavigateRoute?.(eventType as RoutePath);
  };

  const handleSelectPackage = (packageId: string) => {
    const pkg = currentPackages.find((item) => item.id === packageId);
    if (!pkg) return;
    const nextAddons: string[] = [];
    const nextHours = 0;
    const nextTotal = calculateTotal(pkg, nextAddons, nextHours);
    commitState({ selectedPackageId: pkg.id, selectedAddons: nextAddons, extraHours: nextHours, total: nextTotal }, nextTotal);
  };

  const handleToggleAddon = (addonId: string) => {
    if (!selectedPackage || isCustomQuote) return;
    const nextAddons = selectedAddonIds.includes(addonId)
      ? selectedAddonIds.filter((id) => id !== addonId)
      : [...selectedAddonIds, addonId];
    const nextTotal = calculateTotal(selectedPackage, nextAddons, bookingState.extraHours);
    commitState({ selectedAddons: nextAddons, total: nextTotal }, nextTotal);
  };

  const handleExtraHoursChange = (delta: number) => {
    if (!selectedPackage || isCustomQuote) return;
    const nextHours = Math.max(0, bookingState.extraHours + delta);
    const nextTotal = calculateTotal(selectedPackage, selectedAddonIds, nextHours);
    commitState({ extraHours: nextHours, total: nextTotal }, nextTotal);
  };

  const handleProceed = () => {
    if (!selectedPackage) return;
    const nextTotal = calculateTotal(selectedPackage, selectedAddonIds, bookingState.extraHours);
    commitState({ selectedPackageId: selectedPackage.id, selectedAddons: selectedAddonIds, total: nextTotal }, nextTotal);
    onProceedToBooking();
  };

  const packageGridClass = currentPackages.length === 1
    ? 'max-w-2xl mx-auto'
    : currentPackages.length === 2
      ? 'md:grid-cols-2'
      : 'lg:grid-cols-3';

  return (
    <section id="cotizador" className="py-20 bg-[#0B0F17] relative border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        <header className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161C28] border border-[#D4AF37]/30 text-xs font-semibold text-[#D4AF37]"><Sparkles className="w-3.5 h-3.5" /><span>COTIZADOR XPH</span></div>
          <h2 className="text-3xl sm:text-5xl font-bold font-serif-luxury text-white">Encuentra la cobertura adecuada para tu evento</h2>
          <p className="text-gray-300 text-sm sm:text-base">Selecciona un paquete y añade los complementos que necesites. El total y el anticipo se actualizan automáticamente.</p>
        </header>

        <div className="flex justify-center"><div className="p-1.5 rounded-2xl bg-[#161C28] border border-white/10 inline-flex flex-wrap justify-center gap-2">{(Object.keys(categoryLabels) as EventType[]).map((category) => <button key={category} type="button" onClick={() => handleSelectEventType(category)} className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${bookingState.eventType === category ? 'gold-gradient-bg text-black font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>{categoryLabels[category]}</button>)}</div></div>

        <div className={`grid gap-6 xl:gap-8 items-stretch ${packageGridClass}`}>
          {currentPackages.map((pkg) => {
            const selected = selectedPackage?.id === pkg.id;
            return <button key={pkg.id} type="button" onClick={() => handleSelectPackage(pkg.id)} className={`relative text-left rounded-2xl p-5 sm:p-6 xl:p-7 transition-all ${selected ? 'bg-[#161C28] border-2 border-[#D4AF37] shadow-xl' : 'bg-[#161C28]/80 border border-white/10 hover:border-white/30'}`}>
              {pkg.badge && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gold-gradient-bg text-black font-bold text-[10px] tracking-wider whitespace-nowrap">{pkg.badge}</span>}
              <div className="flex justify-between gap-3"><h3 className="text-lg xl:text-xl font-bold font-serif-luxury text-white">{pkg.name}</h3>{selected && <Check className="w-5 h-5 text-[#D4AF37] shrink-0" />}</div>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">{pkg.description}</p>
              <div className="pt-4 mt-4 border-t border-white/10">{pkg.price > 0 ? <><span className="text-3xl font-extrabold text-white font-mono">${pkg.price.toLocaleString('es-MX')}</span><span className="text-xs text-gray-400 ml-1">MXN</span></> : <span className="text-2xl font-extrabold text-[#D4AF37]">Cotización personalizada</span>}</div>
              <ul className="space-y-2 text-xs text-gray-300 mt-5">{pkg.features.map((feature) => <li key={feature} className="flex items-start gap-2"><Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" /><span>{feature}</span></li>)}</ul>
              {pkg.notIncludes?.length ? <ul className="space-y-2 text-xs text-gray-400 mt-5 pt-4 border-t border-white/10">{pkg.notIncludes.map((feature) => <li key={feature} className="flex items-start gap-2"><X className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" /><span>{feature}</span></li>)}</ul> : null}
            </button>;
          })}
        </div>

        {!selectedPackage && <div className="max-w-2xl mx-auto rounded-2xl bg-[#161C28] border border-white/10 px-6 py-5 text-center"><p className="text-sm text-gray-300">Selecciona uno de los paquetes para comenzar tu cotización.</p></div>}

        {selectedPackage && !isCustomQuote ? <div className="max-w-5xl mx-auto rounded-2xl bg-[#161C28] border border-white/10 p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-2xl sm:text-3xl font-bold font-serif-luxury text-white">Personaliza tu paquete</h3>
            <p className="text-sm sm:text-base text-gray-400 mt-2">Añade tus complementos a tu paquete</p>
          </div>

          <div className="space-y-3">{addons.filter((addon) => addon.type === 'checkbox').map((addon) => { const active = selectedAddonIds.includes(addon.id); return <button key={addon.id} type="button" onClick={() => handleToggleAddon(addon.id)} className={`w-full p-4 rounded-xl border text-left flex items-start justify-between gap-4 ${active ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/10 bg-[#0B0F17]'}`}><div><p className="text-sm font-semibold text-white">{addon.name}</p><p className="text-xs text-gray-400 mt-1">{addon.description}</p></div><span className="text-sm font-bold text-[#D4AF37] font-mono whitespace-nowrap">+${addon.price.toLocaleString('es-MX')}</span></button>; })}</div>

          {extraHoursAddon && <div className="p-4 rounded-xl bg-[#0B0F17] border border-white/10 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-white">Horas extra</p><p className="text-xs text-gray-400">${extraHoursRate.toLocaleString('es-MX')} MXN por hora completa</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => handleExtraHoursChange(-1)} className="p-2 rounded-lg bg-white/10"><Minus className="w-4 h-4" /></button><span className="w-6 text-center font-mono">{bookingState.extraHours}</span><button type="button" onClick={() => handleExtraHoursChange(1)} className="p-2 rounded-lg bg-white/10"><Plus className="w-4 h-4" /></button></div></div>}

          <div className="pt-6 border-t border-white/10">
            <div className="rounded-xl bg-[#0B0F17] border border-[#D4AF37]/30 p-5 sm:p-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-mono">Total estimado</span>
                <div className="mt-1"><span className="text-4xl sm:text-5xl font-black text-[#D4AF37] font-mono">${quotedTotal.toLocaleString('es-MX')}</span><span className="text-sm text-gray-400 ml-2">MXN</span></div>
                <p className="text-xs text-gray-400 mt-2">Anticipo 40%: <strong className="text-white">${Math.round(quotedTotal * 0.4).toLocaleString('es-MX')} MXN</strong></p>
              </div>
              <button type="button" onClick={handleProceed} className="w-full md:w-auto md:min-w-[240px] px-7 py-4 rounded-xl gold-gradient-bg text-black font-extrabold text-sm whitespace-nowrap">Solicitar disponibilidad</button>
            </div>
          </div>
        </div> : null}

        {selectedPackage && isCustomQuote ? <div className="max-w-2xl mx-auto rounded-2xl bg-[#161C28] border border-[#D4AF37]/30 p-6 sm:p-8 text-center space-y-4"><h3 className="text-2xl font-bold text-white">Cuéntanos qué necesitas</h3><p className="text-sm text-gray-400">Para este servicio no mostramos un precio genérico.</p><button type="button" onClick={handleProceed} className="px-8 py-4 rounded-xl gold-gradient-bg text-black font-extrabold text-sm">Solicitar cotización y disponibilidad</button></div> : null}
      </div>
    </section>
  );
};
