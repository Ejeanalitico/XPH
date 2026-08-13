import React from 'react';
import { CalendarCheck, MapPin, FileSignature, Sparkles, PhoneCall, CheckCircle, Award, HeartHandshake, ShieldCheck } from 'lucide-react';
import { BookingState } from '../types';

interface InPersonConsultationProps {
  bookingState: BookingState;
  onSendWhatsApp: () => void;
  onNavigateToQuote: () => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'success' | 'warning') => void;
}

export const InPersonConsultation: React.FC<InPersonConsultationProps> = ({
  bookingState,
  onSendWhatsApp,
  onNavigateToQuote,
  onShowToast,
}) => {
  const handleScheduleConsultation = () => {
    if (!bookingState.selectedPackageId) {
      onShowToast(
        'Selección Requerida',
        'Por favor selecciona primero un paquete en el cotizador antes de agendar tu cita presencial.',
        'warning'
      );
      onNavigateToQuote();
      return;
    }

    if (!bookingState.date) {
      onShowToast(
        'Fecha Requerida',
        'Ingresa o selecciona la fecha de tu evento en el paso 1 de reserva para verificar disponibilidad.',
        'warning'
      );
      const el = document.getElementById('contratacion');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    onSendWhatsApp();
  };
  return (
    <section id="cierre-presencial" className="py-12 sm:py-20 relative overflow-hidden bg-gradient-to-b from-[#0B0F17] via-[#111723] to-[#0B0F17]">
      {/* Decorative Glow Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] sm:text-xs font-semibold tracking-wider uppercase mb-3 sm:mb-4 shadow-sm">
            <HeartHandshake className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Atención Personalizada en CDMX, EdoMex & Zona Centro</span>
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold font-serif-luxury text-white mb-4 sm:mb-6">
            El Cierre Perfecto: <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#AA771C]">Nos Vemos en Persona</span>
          </h2>

          <p className="text-gray-300 text-xs sm:text-base lg:text-lg leading-relaxed">
            Sabemos lo valioso que es tu evento. Por eso combinamos la cotización en línea con un encuentro presencial en CDMX, Estado de México, Morelos, Puebla, Querétaro, Tlaxcala o Pachuca, donde podrás ver álbumes físicos y resolver cada detalle con total tranquilidad.
          </p>
        </div>

        {/* 3-Step Process Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8 mb-10 sm:mb-16">
          
          {/* Step 1 */}
          <div className="relative p-5 sm:p-8 rounded-2xl bg-[#161C28]/80 border border-white/10 hover:border-[#D4AF37]/40 transition-all group backdrop-blur-md flex flex-col justify-between">
            <div className="absolute top-5 right-5 text-3xl sm:text-4xl font-black text-[#D4AF37]/10 group-hover:text-[#D4AF37]/20 transition-colors font-mono">
              01
            </div>

            <div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3 flex items-center gap-2">
                Cotizas & Personalizas
              </h3>

              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-4">
                Eliges la categoría de tu evento (<strong className="text-white">Bodas, XV Años, Bautizos o Retratos</strong>), ajustas horas extra o photobooks y obtienes un presupuesto transparente al instante.
              </p>
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-[#D4AF37]">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Sin costos ocultos ni sorpresas</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative p-5 sm:p-8 rounded-2xl bg-[#161C28]/80 border border-[#D4AF37]/40 shadow-xl shadow-[#D4AF37]/5 transition-all group backdrop-blur-md flex flex-col justify-between">
            <div className="absolute top-5 right-5 text-3xl sm:text-4xl font-black text-[#D4AF37]/20 font-mono">
              02
            </div>

            <div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#AA771C] flex items-center justify-center text-[#0B0F17] mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-[#D4AF37]/20">
                <MapPin className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3 flex items-center gap-2 flex-wrap">
                <span>Visita Presencial en CDMX</span>
                <span className="px-2 py-0.5 text-[9px] rounded bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40">CDMX</span>
              </h3>

              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mb-4">
                Nos reunimos en la Ciudad de México (tu domicilio, estudio o cafetería de preferencia). <strong className="text-white">Te mostramos álbumes en lino impresos y muestras físicas</strong> mientras afinamos la logística fotográfica de tu evento.
              </p>
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-[#D4AF37]">
              <CheckCircle className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <span>Muestras físicas táctiles en mano</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative p-5 sm:p-8 rounded-2xl bg-[#161C28]/80 border border-white/10 hover:border-[#D4AF37]/40 transition-all group backdrop-blur-md flex flex-col justify-between">
            <div className="absolute top-5 right-5 text-3xl sm:text-4xl font-black text-[#D4AF37]/10 group-hover:text-[#D4AF37]/20 transition-colors font-mono">
              03
            </div>

            <div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <FileSignature className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3 flex items-center gap-2">
                Firma de Contrato Físico
              </h3>

              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-4">
                Formalizamos la reserva mediante un <strong className="text-white">contrato firmado formal con firmas autógrafas</strong> y la confirmación del 30% de anticipo. Tu fecha queda jurídicamente respaldada y bloqueada en nuestro calendario.
              </p>
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-[#D4AF37]">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Garantía por escrito con contrato firmado</span>
            </div>
          </div>

        </div>

        {/* Benefits Banner */}
        <div className="p-5 sm:p-10 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#161C28] via-[#1A2232] to-[#161C28] border border-[#D4AF37]/30 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
          
          <div className="space-y-2 sm:space-y-3 text-center lg:text-left max-w-2xl">
            <div className="flex items-center justify-center lg:justify-start gap-2 text-emerald-400 text-xs sm:text-sm font-semibold">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Garantía Total de Satisfacción & Entrega Puntual</span>
            </div>

            <h3 className="text-xl sm:text-3xl font-bold font-serif-luxury text-white">
              ¿Listo para conocernos y planear la cobertura de tu fecha?
            </h3>

            <p className="text-gray-300 text-xs sm:text-sm">
              Paquete seleccionado actual: <span className="text-[#D4AF37] font-semibold">{bookingState.eventType.toUpperCase()} - {bookingState.selectedPackageId.toUpperCase()}</span> (${bookingState.total.toLocaleString('es-MX')} MXN)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
            <button
              onClick={handleScheduleConsultation}
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-xs sm:text-sm tracking-wide hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2.5 group cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
              <span>Agendar Cita Presencial</span>
            </button>

            <button
              onClick={onNavigateToQuote}
              className="w-full sm:w-auto px-5 sm:px-6 py-3.5 sm:py-4 rounded-xl bg-white/5 border border-white/20 text-gray-200 font-semibold text-xs sm:text-sm hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Personalizar Cotización</span>
            </button>
          </div>

        </div>

      </div>
    </section>
  );
};
