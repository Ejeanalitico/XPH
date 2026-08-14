import React from 'react';
import { Sparkles, ChevronRight, HeartHandshake, MapPin, CalendarCheck, Camera } from 'lucide-react';
import { RoutePath } from '../types';

interface HeroProps {
  currentRoute: RoutePath;
  onQuoteClick: () => void;
  onGalleryClick: () => void;
  onCitaClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ currentRoute, onQuoteClick, onGalleryClick, onCitaClick }) => {
  const routeContent: Record<RoutePath, { badge: string; title: string; highlight: string; subtitle: string; imageUrl: string; imageTag: string }> = {
    inicio: {
      badge: 'Fotografía & video en CDMX, Estado de México y zona centro',
      title: 'Fotografía para momentos que merecen ',
      highlight: 'recordarse bien',
      subtitle: 'Cobertura para bodas, XV años, bautizos, retratos y proyectos empresariales. Revisa opciones, arma una cotización y solicita disponibilidad directamente.',
      imageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Referencia visual · Boda',
    },
    bodas: {
      badge: 'Bodas · Fotografía & video',
      title: 'Documenta tu boda con una mirada ',
      highlight: 'natural y editorial',
      subtitle: 'Coberturas para boda civil y celebraciones completas, con opciones de sesión previa, fotografía, video y entregables digitales.',
      imageUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Referencia visual · Boda',
    },
    'xv-anos': {
      badge: 'XV Años · Cobertura & sesión',
      title: 'Tus XV años con fotografía, video y ',
      highlight: 'estilo propio',
      subtitle: 'Opciones de cobertura para ceremonia, vals y fiesta, además de paquetes profesionales con preparación y entregables digitales.',
      imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Referencia visual · XV Años',
    },
    bautizos: {
      badge: 'Bautizos & familia',
      title: 'Fotografía cercana para ',
      highlight: 'celebraciones familiares',
      subtitle: 'Cuéntanos duración, ceremonia, recepción y ubicación para preparar una propuesta adecuada a tu evento.',
      imageUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Referencia visual · Familia',
    },
    retratos: {
      badge: 'Retratos & sesiones',
      title: 'Una sesión pensada para mostrar ',
      highlight: 'tu mejor versión',
      subtitle: 'Sesiones personales, de pareja, graduación o editoriales cotizadas según duración, locación y producción.',
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Referencia visual · Retrato',
    },
    empresarial: {
      badge: 'Empresarial & branding',
      title: 'Contenido visual para tu marca, equipo y ',
      highlight: 'negocio',
      subtitle: 'Headshots, branding y cobertura corporativa cotizados según número de personas, duración y entregables requeridos.',
      imageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Referencia visual · Empresarial',
    },
  };

  const current = routeContent[currentRoute];

  return (
    <section className="relative overflow-hidden bg-[#0B0F17] pt-8 pb-14 lg:pt-16 lg:pb-28 border-b border-white/5">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#D4AF37]/10 via-[#D4AF37]/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 -right-20 w-80 h-80 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          <div className="lg:col-span-7 space-y-6 sm:space-y-7 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161C28] border border-[#D4AF37]/30 text-[11px] sm:text-xs font-medium text-[#D4AF37] shadow-lg shadow-[#D4AF37]/5 max-w-full text-left">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{current.badge}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-serif-luxury text-white leading-[1.15]">
              {current.title}<span className="gold-gradient-text italic font-normal">{current.highlight}</span>
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-gray-300 max-w-2xl leading-relaxed font-light mx-auto lg:mx-0">{current.subtitle}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-medium text-gray-300">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10"><HeartHandshake className="w-4 h-4 text-[#D4AF37] shrink-0" /><span>Atención personalizada</span></div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10"><CalendarCheck className="w-4 h-4 text-[#D4AF37] shrink-0" /><span>Agenda confirmada personalmente</span></div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10"><MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" /><span>CDMX & zona centro</span></div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <button onClick={onQuoteClick} className="w-full sm:w-auto px-8 py-4 rounded-xl gold-gradient-bg text-black font-bold text-sm tracking-wide shadow-xl shadow-[#D4AF37]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group cursor-pointer">
                <span>Ver paquetes y cotizar</span><ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={onCitaClick} className="w-full sm:w-auto px-7 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
                <CalendarCheck className="w-4 h-4" /><span>Consultar disponibilidad</span>
              </button>
              <button onClick={onGalleryClick} className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
                <Camera className="w-4 h-4" /><span>Ver galería</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-[#161C28] p-2 shadow-2xl shadow-black/80">
                <div className="relative h-[420px] sm:h-[460px] rounded-xl overflow-hidden">
                  <img src={current.imageUrl} alt={current.imageTag} className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-transparent opacity-80" />
                  <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-[#0B0F17]/85 backdrop-blur-md border border-white/10 text-xs text-[#D4AF37] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /><span>Imagen de referencia</span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[#0B0F17]/80 backdrop-blur-md border border-white/10">
                    <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">{current.imageTag}</p>
                    <p className="text-xs text-gray-400 mt-1">La galería conectada a Google Drive muestra el portafolio clasificado por sección.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
