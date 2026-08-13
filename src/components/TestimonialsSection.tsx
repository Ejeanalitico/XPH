import React, { useState } from 'react';
import { Testimonial, EventType } from '../types';
import { Star, MessageSquareQuote, CheckCircle, Send, Sparkles, UserCheck, Link as LinkIcon, Plus, Share2 } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
  onAddTestimonial: (newTestimonial: Omit<Testimonial, 'id' | 'verified'>) => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'success' | 'warning') => void;
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({
  testimonials,
  onAddTestimonial,
  onShowToast,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [eventType, setEventType] = useState<EventType>('bodas');
  const [date, setDate] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyReviewLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}#testimonios`;
    const success = await copyToClipboard(link);
    setCopiedLink(true);
    if (success) {
      onShowToast('¡Enlace Copiado!', 'Enlace para dejar testimonio copiado al portapapeles.', 'success');
    } else {
      onShowToast('Enlace de Testimonios', link, 'info');
    }
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !comment) {
      onShowToast('Campos requeridos', 'Por favor ingresa tu nombre y testimonio.');
      return;
    }

    onAddTestimonial({
      clientName,
      eventType,
      date: date || new Date().toISOString().split('T')[0],
      rating,
      comment,
    });

    onShowToast('¡Gracias por tu testimonio!', 'Tu opinión ha sido registrada con éxito.');
    setClientName('');
    setComment('');
    setIsModalOpen(false);
  };

  const categoryLabels: Record<EventType, string> = {
    bodas: 'Boda en CDMX',
    'xv-anos': 'XV Años',
    bautizos: 'Bautizo & Familia',
    retratos: 'Sesión de Retrato',
    empresarial: 'Evento Empresarial',
  };

  return (
    <section id="testimonios" className="py-12 sm:py-20 bg-[#0B0F17] relative border-b border-white/5">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10 space-y-8 sm:space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6 border-b border-white/10 pb-6 sm:pb-8">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 rounded-full bg-[#161C28] border border-[#D4AF37]/30 text-[10px] sm:text-xs font-semibold text-[#D4AF37]">
              <MessageSquareQuote className="w-3.5 h-3.5" />
              <span>TESTIMONIOS REALES DE CLIENTES EN CDMX</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold font-serif-luxury text-white">
              Historias & Experiencias Compartidas
            </h2>
            <p className="text-gray-300 text-xs sm:text-sm max-w-xl">
              Lee la opinión de nuestras parejas y clientes sobre la calidez, puntualidad y calidad editorial en Ciudad de México.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
            <button
              onClick={handleCopyReviewLink}
              className="px-4 py-3 rounded-xl bg-[#161C28] hover:bg-white/10 border border-[#D4AF37]/40 text-[#D4AF37] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#D4AF37]" />
              <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3 rounded-xl gold-gradient-bg text-black font-extrabold text-xs shadow-lg shadow-[#D4AF37]/20 hover:scale-105 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-black" />
              <span>Escribir Mi Testimonio</span>
            </button>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="p-6 rounded-2xl bg-[#161C28] border border-white/10 hover:border-[#D4AF37]/40 transition-all flex flex-col justify-between space-y-4 shadow-xl relative group"
            >
              <div className="space-y-3">
                {/* Header card info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[#D4AF37]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < t.rating ? 'fill-[#D4AF37]' : 'text-gray-600'}`}
                      />
                    ))}
                  </div>

                  {t.verified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <UserCheck className="w-3 h-3" />
                      <span>Verificado</span>
                    </span>
                  )}
                </div>

                <p className="text-gray-300 text-xs leading-relaxed italic">
                  "{t.comment}"
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-white">{t.clientName}</h4>
                  <span className="text-[10px] text-gray-400">{categoryLabels[t.eventType] || t.eventType}</span>
                </div>
                <span className="text-[10px] font-mono text-gray-500">{t.date}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Modal form for client review */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#161C28] border border-white/15 rounded-2xl p-6 sm:p-8 max-w-lg w-full space-y-6 relative shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                  <span>Deja tu Opinión / Testimonio</span>
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="text-gray-300 block mb-1 font-semibold">Tu Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Sofía & Carlos"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-300 block mb-1 font-semibold">Tipo de Evento</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as EventType)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="bodas">Boda</option>
                      <option value="xv-anos">XV Años</option>
                      <option value="bautizos">Bautizo / Familia</option>
                      <option value="retratos">Retrato / Moda</option>
                      <option value="empresarial">Empresarial / Branding</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-300 block mb-1 font-semibold">Calificación</label>
                    <div className="flex items-center gap-1.5 pt-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setRating(star)}
                          className="text-[#D4AF37] focus:outline-none cursor-pointer"
                        >
                          <Star
                            className={`w-5 h-5 ${star <= rating ? 'fill-[#D4AF37]' : 'text-gray-600'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-gray-300 block mb-1 font-semibold">Tu Testimonio / Experiencia *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Cuéntanos sobre tu experiencia con Xavi.Ph..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl gold-gradient-bg text-black font-extrabold flex items-center gap-2 shadow-lg shadow-[#D4AF37]/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Publicar Testimonio</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
