import React from 'react';
import { Star, Shield, Zap, Sparkles, ChevronRight, FileCheck, Award, HeartHandshake, MapPin } from 'lucide-react';
import { RoutePath } from '../types';

interface HeroProps {
  currentRoute: RoutePath;
  onQuoteClick: () => void;
  onGalleryClick: () => void;
  onCitaClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ currentRoute, onQuoteClick, onGalleryClick, onCitaClick }) => {
  const routeContent: Record<
    RoutePath,
    {
      badge: string;
      title: string;
      highlight: string;
      subtitle: string;
      imageUrl: string;
      imageTag: string;
      imageCaption: string;
      imageLocation: string;
    }
  > = {
    inicio: {
      badge: 'Fotografía Profesional en CDMX, EdoMex, Morelos, Puebla, Querétaro, Tlaxcala & Pachuca',
      title: 'Fotografía Editorial & Documental para Momentos que Exigen ',
      highlight: 'Perfección',
      subtitle:
        'Cobertura fotográfica profesional para Bodas, XV Años, Bautizos, Retratos y Fotografía Empresarial en Ciudad de México, Estado de México, Morelos, Tlaxcala, Puebla, Pachuca, Querétaro y toda la República. Cotiza en tiempo real, agenda tu cita presencial y asegura tu fecha.',
      imageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Colección Boda Editorial',
      imageCaption: 'Valeria & Carlos — Jardines de San Ángel',
      imageLocation: 'CDMX, EdoMex & Zona Centro',
    },
    bodas: {
      badge: 'Especialidad en Bodas Destination & Editorial',
      title: 'Historias de Boda Inmortales con Estética ',
      highlight: 'Editorial & Elegancia',
      subtitle:
        'Documentamos el día más importante de tu vida en CDMX, Estado de México, Morelos, Puebla, Querétaro, Tlaxcala, Pachuca y todo México con la precisión de una revista de lujo.',
      imageUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Getting Ready & Boda Religiosa',
      imageCaption: 'Sofía & Alejandro — San Ángel & Valle de Bravo',
      imageLocation: 'CDMX, EdoMex & Puebla',
    },
    'xv-anos': {
      badge: 'Quinceañeras Tendencia & Youth Editorial',
      title: 'El Día Más Esperado de tus XV Años Capturado con ',
      highlight: 'Estilo & Magia',
      subtitle:
        'Sesión previa en locaciones emblemáticas de CDMX, Estado de México, Querétaro o Puebla, cobertura completa de Misa y Recepción con Photobook de lujo impreso.',
      imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Sesión Previa & Noche de Gala',
      imageCaption: 'Regina — Palacio Metropolitano',
      imageLocation: 'CDMX & Querétaro',
    },
    bautizos: {
      badge: 'Bautizos & Eventos Familiares en México',
      title: 'Fotografía Cálida y Espontánea para ',
      highlight: 'Celebraciones Sagradas',
      subtitle:
        'Capturamos la bendición en iglesia y el festejo familiar en CDMX, EdoMex, Morelos, Tlaxcala, Puebla, Pachuca y Querétaro con máxima agilidad y sensibilidad.',
      imageUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Misa Religiosa & Convivio',
      imageCaption: 'Bautizo de Mateo — Parroquia San Josemaría',
      imageLocation: 'CDMX & Estado de México',
    },
    retratos: {
      badge: 'Retratos, Personal Branding & Graduaciones',
      title: 'Tu Mejor Versión en Fotografía ',
      highlight: 'Personal & Professional',
      subtitle:
        'Potencia tu marca personal, celebra tu graduación o crea retratos artísticos en estudio y locaciones de la CDMX, Estado de México y estados vecinos con dirección de posado experta.',
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Retrato Fino & Fine Art',
      imageCaption: 'Sesión Editorial & Personal Branding',
      imageLocation: 'Estudio Condesa, CDMX',
    },
    empresarial: {
      badge: 'Fotografía Empresarial, Branding & Corporativo',
      title: 'Imágenes de Alto Impacto para tu Marca, Equipo & ',
      highlight: 'Negocio',
      subtitle:
        'Headshots ejecutivos, branding personal y cobertura de eventos corporativos en CDMX, Estado de México, Querétaro, Puebla, Morelos y toda la República con entrega rápida.',
      imageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1000&q=85',
      imageTag: 'Branding & Perfil Corporativo',
      imageCaption: 'Sesión Ejecutiva Directiva',
      imageLocation: 'Torre Reforma, CDMX',
    },
  };

  const current = routeContent[currentRoute];

  return (
    <section className="relative overflow-hidden bg-[#0B0F17] pt-8 pb-14 lg:pt-16 lg:pb-28 border-b border-white/5">
      {/* Background Decorative Metallic Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#D4AF37]/10 via-[#D4AF37]/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 -right-20 w-80 h-80 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* Left Column: Headline & Value Proposition */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-7 text-center lg:text-left">
            
            {/* Top Eyebrow Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161C28] border border-[#D4AF37]/30 text-[11px] sm:text-xs font-medium text-[#D4AF37] shadow-lg shadow-[#D4AF37]/5 max-w-full text-left">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{current.badge}</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-serif-luxury text-white leading-[1.15]">
              {current.title}
              <span className="gold-gradient-text italic font-normal">{current.highlight}</span>
            </h1>

            {/* Subtitle - Fear Mitigation */}
            <p className="text-sm sm:text-base lg:text-lg text-gray-300 max-w-2xl leading-relaxed font-light mx-auto lg:mx-0">
              {current.subtitle}
            </p>

            {/* Reassurance Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-medium text-gray-300">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Atención Presencial CDMX</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <Shield className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Contrato Firmado Legal</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <FileCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>CDMX, EdoMex, Puebla, Qro, etc.</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={onQuoteClick}
                className="w-full sm:w-auto px-8 py-4 rounded-xl gold-gradient-bg text-black font-bold text-sm tracking-wide shadow-xl shadow-[#D4AF37]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Cotizar Paquete en Vivo</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onCitaClick}
                className="w-full sm:w-auto px-7 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Agendar Cita Presencial</span>
              </button>

              <button
                onClick={onGalleryClick}
                className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ver Galería</span>
              </button>
            </div>

            {/* Micro-Social Proof Bar */}
            <div className="pt-5 border-t border-white/10 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <span className="font-bold text-white">5.0</span>
                <span className="text-gray-400 text-xs">(+120 Reseñas Verificadas)</span>
              </div>

              <div className="h-4 w-px bg-white/10 hidden sm:block" />

              <div className="flex items-center gap-4">
                <div>
                  <span className="font-bold text-white text-base font-mono">+250,000</span>
                  <span className="text-gray-400 text-xs block">Fotos Entregadas</span>
                </div>
                <div>
                  <span className="font-bold text-white text-base font-mono">+180</span>
                  <span className="text-gray-400 text-xs block">Eventos Realizados</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: High Fashion Editorial Composite */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Main Luxury Frame */}
              <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-[#161C28] p-2 shadow-2xl shadow-black/80">
                <div className="relative h-[420px] sm:h-[460px] rounded-xl overflow-hidden">
                  <img
                    src={current.imageUrl}
                    alt={current.imageCaption}
                    className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-transparent opacity-80" />
                  
                  {/* Overlay Tag */}
                  <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-[#0B0F17]/80 backdrop-blur-md border border-white/10 text-xs font-serif-luxury text-[#D4AF37] flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Premio Wedding & Event Awards 2025</span>
                  </div>

                  {/* Bottom Image Caption */}
                  <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[#0B0F17]/80 backdrop-blur-md border border-white/10 space-y-1">
                    <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">{current.imageTag}</p>
                    <h3 className="text-base font-bold text-white font-serif-luxury">{current.imageCaption}</h3>
                    <p className="text-xs text-gray-400">{current.imageLocation}</p>
                  </div>
                </div>
              </div>

              {/* Floating Counter Card Accent */}
              <div className="absolute -bottom-6 -left-6 bg-[#161C28] border border-[#D4AF37]/30 p-4 rounded-2xl shadow-2xl backdrop-blur-md hidden sm:flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Reunión Presencial</p>
                  <p className="text-sm font-bold text-white">Muestras Físicas en Mano</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
