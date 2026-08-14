import React from 'react';
import { CalendarCheck, MapPin, Sparkles, CheckCircle, HeartHandshake, MessageCircle } from 'lucide-react';
import { BookingState } from '../types';

interface InPersonConsultationProps {
  bookingState: BookingState;
  onSendWhatsApp?: () => void;
  onNavigateToQuote: () => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'success' | 'warning') => void;
}

export const InPersonConsultation: React.FC<InPersonConsultationProps> = ({
  bookingState,
  onNavigateToQuote,
  onShowToast,
}) => {
  const handleContinue = () => {
    if (!bookingState.selectedPackageId) {
      onShowToast('Selecciona un servicio', 'Primero elige el tipo de cobertura que te interesa.', 'warning');
      onNavigateToQuote();
      return;
    }

    document.getElementById('solicitud')?.scrollIntoView({ behavior: 'smooth' });
    if (!bookingState.date) {
      onShowToast('Selecciona una fecha tentativa', 'En el siguiente paso podrás elegir la fecha para solicitar disponibilidad.', 'info');
    }
  };

  const quoteText = bookingState.total > 0
    ? `$${bookingState.total.toLocaleString('es-MX')} MXN estimados`
    : 'Cotización personalizada';

  return (
    <section id="cierre-presencial" className="py-20 relative overflow-hidden bg-gradient-to-b from-[#0B0F17] via-[#111723] to-[#0B0F17]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold tracking-wider uppercase mb-4">
            <HeartHandshake className="w-4 h-4" />
            <span>Atención personalizada</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif-luxury text-white mb-6">
            Cotiza en línea y <span className="gold-gradient-text">coordina los detalles personalmente</span>
          </h2>
          <p className="text-gray-300 text-base sm:text-lg leading-relaxed">
            Revisa opciones desde la web, solicita disponibilidad y continúa la atención directamente por WhatsApp. Cuando sea necesario, podemos coordinar una cita presencial para revisar muestras y logística.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="relative p-8 rounded-2xl bg-[#161C28]/80 border border-white/10 hover:border-[#D4AF37]/40 transition-all backdrop-blur-md">
            <div className="absolute top-6 right-6 text-4xl font-black text-[#D4AF37]/10 font-mono">01</div>
            <div className="w-14 h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-6"><Sparkles className="w-7 h-7" /></div>
            <h3 className="text-xl font-bold text-white mb-3">Cotiza & Personaliza</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">Elige tu tipo de evento, revisa los paquetes publicados y agrega únicamente los adicionales que necesites.</p>
            <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-[#D4AF37]"><CheckCircle className="w-4 h-4" /><span>Precios publicados claramente identificados</span></div>
          </div>

          <div className="relative p-8 rounded-2xl bg-[#161C28]/80 border border-[#D4AF37]/40 shadow-xl shadow-[#D4AF37]/5 transition-all backdrop-blur-md">
            <div className="absolute top-6 right-6 text-4xl font-black text-[#D4AF37]/20 font-mono">02</div>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#AA771C] flex items-center justify-center text-[#0B0F17] mb-6"><CalendarCheck className="w-7 h-7" /></div>
            <h3 className="text-xl font-bold text-white mb-3">Solicita Disponibilidad</h3>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">Comparte la fecha tentativa y lugar del evento. La fecha no se presenta como disponible hasta que la agenda sea revisada.</p>
            <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-[#D4AF37]"><CheckCircle className="w-4 h-4" /><span>Confirmación personal de agenda</span></div>
          </div>

          <div className="relative p-8 rounded-2xl bg-[#161C28]/80 border border-white/10 hover:border-[#D4AF37]/40 transition-all backdrop-blur-md">
            <div className="absolute top-6 right-6 text-4xl font-black text-[#D4AF37]/10 font-mono">03</div>
            <div className="w-14 h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-6"><MapPin className="w-7 h-7" /></div>
            <h3 className="text-xl font-bold text-white mb-3">Afinamos los Detalles</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">Continuamos por WhatsApp y, si lo necesitas, coordinamos una cita presencial para revisar muestras, horarios y logística del evento.</p>
            <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-[#D4AF37]"><CheckCircle className="w-4 h-4" /><span>Atención directa y personalizada</span></div>
          </div>
        </div>

        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-[#161C28] via-[#1A2232] to-[#161C28] border border-[#D4AF37]/30 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center lg:text-left max-w-2xl">
            <div className="flex items-center justify-center lg:justify-start gap-2 text-emerald-400 text-sm font-semibold"><MessageCircle className="w-5 h-5" /><span>Atención directa por WhatsApp</span></div>
            <h3 className="text-2xl sm:text-3xl font-bold font-serif-luxury text-white">¿Quieres revisar tu fecha y cobertura?</h3>
            <p className="text-gray-300 text-sm sm:text-base">Selección actual: <span className="text-[#D4AF37] font-semibold">{bookingState.eventType.toUpperCase()}</span> · {quoteText}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <button onClick={handleContinue} className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm tracking-wide hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 cursor-pointer">
              <CalendarCheck className="w-5 h-5" /><span>Solicitar disponibilidad</span>
            </button>
            <button onClick={onNavigateToQuote} className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white/5 border border-white/20 text-gray-200 font-semibold text-sm hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2 cursor-pointer"><span>Modificar cotización</span></button>
          </div>
        </div>
      </div>
    </section>
  );
};
