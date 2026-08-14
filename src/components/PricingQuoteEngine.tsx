import React from 'react';
import { Check, Minus, Plus, Sparkles, X } from 'lucide-react';
import { AddOnOption, BookingState, EventType, PackageOption, RoutePath } from '../types';
import { ADDONS_CATALOG, PACKAGES_BY_EVENT } from '../data/packages';

interface PricingQuoteEngineProps {
  currentRoute: RoutePath;
  onNavigateRoute?: (route: RoutePath) => void;
  bookingState: BookingState;
  onUpdateBookingState: (updater: (prev: BookingState) => BookingState) => void;
  onProceedToBooking: () => void;
  packages?: Record<EventType, PackageOption[]>;
  addons?: AddOnOption[];
}

export const PricingQuoteEngine: React.FC<PricingQuoteEngineProps> = ({
  bookingState,
  onUpdateBookingState,
  onProceedToBooking,
  packages = PACKAGES_BY_EVENT,
  addons = ADDONS_CATALOG,
  onNavigateRoute,
}) => {
  const currentPackages = packages[bookingState.eventType] || packages.bodas;
  const selectedPackage =
    currentPackages.find((pkg) => pkg.id === bookingState.selectedPackageId) || currentPackages[0];
  const isCustomQuote = selectedPackage.price === 0;
  const extraHoursAddon = addons.find((addon) => addon.id === 'extra_hours');
  const extraHoursRate = extraHoursAddon?.price || 0;

  const categoryLabels: Record<EventType, string> = {
    bodas: 'Bodas',
    'xv-anos': 'XV Años',
    bautizos: 'Bautizos',
    retratos: 'Retratos',
    empresarial: 'Empresarial',
  };

  const calculateTotal = (
    pkg: PackageOption,
    selectedAddons: string[],
    extraHours: number
  ) => {
    if (pkg.price === 0) return 0;

    const addonsTotal = selectedAddons.reduce((sum, addonId) => {
      const addon = addons.find((item) => item.id === addonId);
      return addon && addon.type === 'checkbox' ? sum + addon.price : sum;
    }, 0);

    return pkg.price + addonsTotal + extraHours * extraHoursRate;
  };

  const handleSelectEventType = (eventType: EventType) => {
    const eventPackages = packages[eventType] || packages.bodas;
    const defaultPackage = eventPackages.find((pkg) => pkg.popular) || eventPackages[0];
    const customQuote = defaultPackage.price === 0;

    onUpdateBookingState((prev) => ({
      ...prev,
      eventType,
      selectedPackageId: defaultPackage.id,
      selectedAddons: customQuote ? [] : prev.selectedAddons,
      extraHours: customQuote ? 0 : prev.extraHours,
      total: customQuote
        ? 0
        : calculateTotal(defaultPackage, prev.selectedAddons, prev.extraHours),
      depositAmount: 0,
    }));

    if (eventType !== 'empresarial') {
      onNavigateRoute?.(eventType as RoutePath);
    }
  };

  const handleSelectPackage = (packageId: string) => {
    const pkg = currentPackages.find((item) => item.id === packageId) || currentPackages[0];

    onUpdateBookingState((prev) => ({
      ...prev,
      selectedPackageId: pkg.id,
      selectedAddons: pkg.price === 0 ? [] : prev.selectedAddons,
      extraHours: pkg.price === 0 ? 0 : prev.extraHours,
      total: calculateTotal(pkg, prev.selectedAddons, prev.extraHours),
      depositAmount: 0,
    }));
  };

  const handleToggleAddon = (addonId: string) => {
    if (isCustomQuote) return;

    onUpdateBookingState((prev) => {
      const nextAddons = prev.selectedAddons.includes(addonId)
        ? prev.selectedAddons.filter((id) => id !== addonId)
        : [...prev.selectedAddons, addonId];

      return {
        ...prev,
        selectedAddons: nextAddons,
        total: calculateTotal(selectedPackage, nextAddons, prev.extraHours),
        depositAmount: 0,
      };
    });
  };

  const handleExtraHoursChange = (delta: number) => {
    if (isCustomQuote) return;

    onUpdateBookingState((prev) => {
      const nextHours = Math.max(0, prev.extraHours + delta);
      return {
        ...prev,
        extraHours: nextHours,
        total: calculateTotal(selectedPackage, prev.selectedAddons, nextHours),
        depositAmount: 0,
      };
    });
  };

  return (
    <section id="cotizador" className="py-20 bg-[#0B0F17] relative border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161C28] border border-[#D4AF37]/30 text-xs font-semibold text-[#D4AF37]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>COTIZADOR XAVI.PH</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold font-serif-luxury text-white">
            Encuentra la cobertura adecuada para tu evento
          </h2>
          <p className="text-gray-300 text-sm sm:text-base">
            Los paquetes con precio publicado se calculan al instante. Los demás servicios se cotizan de forma personalizada para no mostrar importes que no correspondan a tu necesidad real.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="p-1.5 rounded-2xl bg-[#161C28] border border-white/10 inline-flex flex-wrap justify-center gap-2">
            {(Object.keys(categoryLabels) as EventType[]).map((category) => {
              const active = bookingState.eventType === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleSelectEventType(category)}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    active
                      ? 'gold-gradient-bg text-black font-bold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {categoryLabels[category]}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`grid gap-8 items-stretch ${currentPackages.length === 1 ? 'md:grid-cols-1 max-w-2xl mx-auto' : 'md:grid-cols-2'}`}>
          {currentPackages.map((pkg) => {
            const selected = bookingState.selectedPackageId === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => handleSelectPackage(pkg.id)}
                className={`relative text-left rounded-2xl p-6 sm:p-8 transition-all flex flex-col ${
                  selected
                    ? 'bg-[#161C28] border-2 border-[#D4AF37] shadow-xl'
                    : 'bg-[#161C28]/80 border border-white/10 hover:border-white/30'
                }`}
              >
                {pkg.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gold-gradient-bg text-black font-bold text-[10px] tracking-wider whitespace-nowrap">
                    {pkg.badge}
                  </span>
                )}

                <div className="space-y-5 flex-1">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-bold font-serif-luxury text-white">{pkg.name}</h3>
                      {selected && (
                        <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">{pkg.description}</p>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    {pkg.price > 0 ? (
                      <>
                        <span className="text-3xl font-extrabold text-white font-mono">
                          ${pkg.price.toLocaleString('es-MX')}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">MXN</span>
                        <p className="text-[11px] text-gray-500 mt-1">Precio base publicado.</p>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-extrabold text-[#D4AF37]">
                          Cotización personalizada
                        </span>
                        <p className="text-[11px] text-gray-500 mt-1">Se calcula según alcance y necesidades.</p>
                      </>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#D4AF37]">Incluye / considera</span>
                    <ul className="space-y-2 text-xs text-gray-300 mt-2">
                      {pkg.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {pkg.notIncludes && pkg.notIncludes.length > 0 && (
                    <div className="pt-3 border-t border-white/10">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-rose-400">No incluye</span>
                      <ul className="space-y-2 text-xs text-gray-400 mt-2">
                        {pkg.notIncludes.map((feature) => (
                          <li key={feature} className="flex items-start gap-2">
                            <X className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!isCustomQuote ? (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="rounded-2xl bg-[#161C28] border border-white/10 p-6 space-y-5">
              <div>
                <h3 className="text-xl font-bold text-white">Personaliza tu cobertura</h3>
                <p className="text-xs text-gray-400 mt-1">Adicionales con precio confirmado.</p>
              </div>

              <div className="space-y-3">
                {addons.filter((addon) => addon.type === 'checkbox').map((addon) => {
                  const active = bookingState.selectedAddons.includes(addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => handleToggleAddon(addon.id)}
                      className={`w-full p-4 rounded-xl border text-left flex items-start justify-between gap-4 transition-all ${
                        active
                          ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                          : 'border-white/10 bg-[#0B0F17] hover:border-white/20'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{addon.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{addon.description}</p>
                      </div>
                      <span className="text-sm font-bold text-[#D4AF37] font-mono whitespace-nowrap">
                        +${addon.price.toLocaleString('es-MX')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {extraHoursAddon && (
                <div className="p-4 rounded-xl bg-[#0B0F17] border border-white/10 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Horas extra</p>
                    <p className="text-xs text-gray-400">${extraHoursRate.toLocaleString('es-MX')} MXN por hora completa</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label="Quitar hora extra" onClick={() => handleExtraHoursChange(-1)} className="p-2 rounded-lg bg-white/10 text-white">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center text-white font-mono">{bookingState.extraHours}</span>
                    <button type="button" aria-label="Agregar hora extra" onClick={() => handleExtraHoursChange(1)} className="p-2 rounded-lg bg-white/10 text-white">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-[#161C28] border border-[#D4AF37]/30 p-6 sm:p-8 flex flex-col justify-between gap-8">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-mono">Total estimado</span>
                <div className="mt-2">
                  <span className="text-4xl font-black text-[#D4AF37] font-mono">
                    ${bookingState.total.toLocaleString('es-MX')}
                  </span>
                  <span className="text-sm text-gray-400 ml-2">MXN</span>
                </div>
                <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                  Este cálculo es informativo. La disponibilidad de fecha se confirma directamente antes de cualquier apartado.
                </p>
              </div>

              <button type="button" onClick={onProceedToBooking} className="w-full py-4 rounded-xl gold-gradient-bg text-black font-extrabold text-sm cursor-pointer">
                Solicitar disponibilidad
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto rounded-2xl bg-[#161C28] border border-[#D4AF37]/30 p-6 sm:p-8 text-center space-y-4">
            <h3 className="text-2xl font-bold text-white">Cuéntanos qué necesitas</h3>
            <p className="text-sm text-gray-400">
              Para este servicio no publicamos un precio genérico. Envíanos fecha, lugar y alcance para preparar una cotización adecuada.
            </p>
            <button type="button" onClick={onProceedToBooking} className="w-full sm:w-auto px-8 py-4 rounded-xl gold-gradient-bg text-black font-extrabold text-sm cursor-pointer">
              Solicitar cotización y disponibilidad
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
