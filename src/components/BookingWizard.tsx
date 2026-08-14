import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  FileText,
  MessageCircle,
  Share2,
} from 'lucide-react';
import { BookingState, PackageOption, AddOnOption, EventType } from '../types';
import { PACKAGES_BY_EVENT, ADDONS_CATALOG } from '../data/packages';
import { copyToClipboard } from '../utils/clipboard';

interface BookingWizardProps {
  bookingState: BookingState;
  onUpdateBookingState: (updater: (prev: BookingState) => BookingState) => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'success' | 'warning') => void;
  onSendWhatsApp: () => void;
  packages?: Record<EventType, PackageOption[]>;
  addons?: AddOnOption[];
}

export const BookingWizard: React.FC<BookingWizardProps> = ({
  bookingState,
  onUpdateBookingState,
  onShowToast,
  onSendWhatsApp,
  packages,
  addons,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [copiedLink, setCopiedLink] = useState(false);

  const currentPackages =
    (packages && packages[bookingState.eventType]) || PACKAGES_BY_EVENT[bookingState.eventType];
  const currentAddons = addons || ADDONS_CATALOG;
  const selectedPackage =
    currentPackages.find((pkg) => pkg.id === bookingState.selectedPackageId) || currentPackages[0];

  const selectedAddons = bookingState.selectedAddons
    .map((id) => currentAddons.find((addon) => addon.id === id))
    .filter((addon): addon is AddOnOption => Boolean(addon));

  const handleDateChange = (newDate: string) => {
    onUpdateBookingState((prev) => ({ ...prev, date: newDate }));
    if (newDate) {
      onShowToast(
        'Fecha seleccionada',
        'La disponibilidad debe confirmarse en la agenda antes de apartar el evento.',
        'info'
      );
    }
  };

  const handleCopyRequestLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}#solicitud`;
    const success = await copyToClipboard(link);
    setCopiedLink(true);
    onShowToast(
      success ? 'Enlace copiado' : 'Enlace de solicitud',
      success ? 'Puedes compartir este enlace para solicitar disponibilidad.' : link,
      'info'
    );
    window.setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleSendRequest = () => {
    if (!bookingState.date) {
      setCurrentStep(1);
      onShowToast(
        'Selecciona una fecha',
        'Necesitamos una fecha tentativa para revisar la agenda.',
        'warning'
      );
      return;
    }

    if (!bookingState.clientName || !bookingState.clientEmail || !bookingState.clientPhone) {
      setCurrentStep(2);
      onShowToast(
        'Campos incompletos',
        'Completa nombre, correo y WhatsApp antes de enviar la solicitud.',
        'warning'
      );
      return;
    }

    onSendWhatsApp();
  };

  return (
    <section id="solicitud" className="py-20 bg-[#0B0F17] relative border-b border-white/5">
      <span id="contratacion" className="absolute -top-20" aria-hidden="true" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold font-mono">
            SOLICITUD DE DISPONIBILIDAD
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif-luxury text-white">
            Solicita tu fecha en 2 pasos
          </h2>
          <p className="text-gray-300 text-sm max-w-2xl mx-auto">
            Selecciona tu fecha tentativa y comparte tus datos. La disponibilidad se confirma personalmente antes de cualquier apartado.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-4 p-2 rounded-2xl bg-[#161C28] border border-white/10">
          {[
            { step: 1 as const, label: '1. Fecha', icon: CalendarIcon },
            { step: 2 as const, label: '2. Datos', icon: FileText },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = currentStep === item.step;
            const isDone = currentStep > item.step;

            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setCurrentStep(item.step)}
                className={`p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'gold-gradient-bg text-black shadow-lg shadow-[#D4AF37]/20'
                    : isDone
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-8 lg:p-10 rounded-2xl bg-[#161C28] border border-white/10 space-y-8 shadow-2xl">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-[#D4AF37]" />
                  <span>Paso 1: Fecha tentativa del evento</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Elegir una fecha aquí no la bloquea ni confirma. Primero se revisa la agenda y después se confirma contigo por WhatsApp.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6 items-stretch">
                <div className="p-5 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-2">
                  <label className="text-xs font-semibold text-gray-300 block">
                    Fecha tentativa del evento *
                  </label>
                  <input
                    type="date"
                    value={bookingState.date}
                    onChange={(event) => handleDateChange(event.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#161C28] border border-white/20 text-white focus:outline-none focus:border-[#D4AF37] font-mono text-sm cursor-pointer"
                  />
                </div>

                <div className="p-5 rounded-2xl bg-[#0B0F17] border border-white/10 flex items-center gap-3">
                  {bookingState.date ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-white">Fecha seleccionada</p>
                        <p className="text-xs text-gray-400">
                          {bookingState.date}. Pendiente de validación en agenda.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-gray-500 shrink-0" />
                      <p className="text-xs text-gray-400">Selecciona una fecha para continuar.</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleCopyRequestLink}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#D4AF37]" />
                  <span>{copiedLink ? 'Enlace copiado' : 'Copiar enlace de solicitud'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!bookingState.date}
                  className="px-6 py-3 rounded-xl gold-gradient-bg text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <span>Continuar con mis datos</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#D4AF37]" />
                  <span>Paso 2: Datos de contacto</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Estos datos se usan para revisar tu solicitud y continuar la atención por WhatsApp.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-3 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Paquete</span>
                  <span className="text-white font-semibold text-right">{selectedPackage.name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Precio</span>
                  <span className="text-[#D4AF37] font-mono font-bold text-right">
                    {selectedPackage.price > 0
                      ? `$${selectedPackage.price.toLocaleString('es-MX')} MXN`
                      : 'Cotización personalizada'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Fecha tentativa</span>
                  <span className="text-white font-mono">{bookingState.date || 'Por definir'}</span>
                </div>
                {selectedAddons.length > 0 && (
                  <div className="pt-3 border-t border-white/10">
                    <span className="text-gray-400 block mb-2">Adicionales seleccionados</span>
                    <ul className="space-y-1 text-gray-200">
                      {selectedAddons.map((addon) => (
                        <li key={addon.id}>• {addon.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Nombre completo *</label>
                  <input
                    type="text"
                    value={bookingState.clientName}
                    onChange={(event) =>
                      onUpdateBookingState((prev) => ({ ...prev, clientName: event.target.value }))
                    }
                    placeholder="Nombre completo"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Correo electrónico *</label>
                  <input
                    type="email"
                    value={bookingState.clientEmail}
                    onChange={(event) =>
                      onUpdateBookingState((prev) => ({ ...prev, clientEmail: event.target.value }))
                    }
                    placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">WhatsApp *</label>
                  <input
                    type="tel"
                    value={bookingState.clientPhone}
                    onChange={(event) =>
                      onUpdateBookingState((prev) => ({ ...prev, clientPhone: event.target.value }))
                    }
                    placeholder="+52 55 0000 0000"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Ciudad / locación</label>
                  <input
                    type="text"
                    value={bookingState.eventCity}
                    onChange={(event) =>
                      onUpdateBookingState((prev) => ({ ...prev, eventCity: event.target.value }))
                    }
                    placeholder="Ej. Iztacalco, CDMX"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Notas adicionales</label>
                <textarea
                  value={bookingState.notes}
                  onChange={(event) =>
                    onUpdateBookingState((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  rows={3}
                  placeholder="Cuéntanos brevemente qué necesitas para tu evento."
                  className="w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs resize-y"
                />
              </div>

              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-gray-300">
                <strong className="text-amber-300">Importante:</strong> enviar la solicitud no confirma ni bloquea la fecha. Primero se valida disponibilidad y se continúa la atención directamente contigo.
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Regresar</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendRequest}
                  disabled={!bookingState.clientName || !bookingState.clientEmail || !bookingState.clientPhone}
                  className="px-6 py-3 rounded-xl gold-gradient-bg text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enviar solicitud por WhatsApp</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
