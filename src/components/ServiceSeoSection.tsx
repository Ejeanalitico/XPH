import React, { useEffect, useMemo } from 'react';
import { ArrowRight, CheckCircle2, HelpCircle, MapPin } from 'lucide-react';
import { BuiltInRoutePath, CatalogCategory, PackageOption, RoutePath } from '../types';
import { DEFAULT_CATALOG_CATEGORIES } from '../utils/catalogCategories';
import { routePath } from '../utils/seo';

type RouteContent = {
  eyebrow: string;
  heading: string;
  intro: string;
  details: string[];
  faqs: Array<{ question: string; answer: string }>;
};

const CONTENT: Record<BuiltInRoutePath, RouteContent> = {
  inicio: {
    eyebrow: 'Fotografía y video en Ciudad de México',
    heading: 'Producción visual para celebraciones, personas y empresas',
    intro: 'XPH realiza fotografía y video profesional en CDMX, Estado de México y la zona centro. Cada propuesta se prepara según la fecha, ubicación, duración y entregables que necesita el proyecto.',
    details: ['Coberturas de bodas, XV años y eventos familiares', 'Retratos, sesiones previas y fotografía editorial', 'Fotografía corporativa, branding y video empresarial'],
    faqs: [
      { question: '¿En qué zonas trabaja XPH?', answer: 'Atendemos principalmente Ciudad de México, Estado de México y destinos de la zona centro como Morelos, Puebla, Querétaro, Tlaxcala y Pachuca.' },
      { question: '¿Cómo se calcula una cotización?', answer: 'La propuesta considera tipo de servicio, horas de cobertura, ubicación, fotografía, video y entregables seleccionados.' },
      { question: '¿Cómo puedo consultar una fecha?', answer: 'Puedes armar una cotización en esta página y enviar la solicitud. La disponibilidad se confirma personalmente.' },
    ],
  },
  bodas: {
    eyebrow: 'Fotógrafo de bodas en CDMX',
    heading: 'Fotografía y video para bodas con cobertura a tu medida',
    intro: 'Documentamos bodas civiles, ceremonias y celebraciones completas con una combinación de momentos naturales, retratos dirigidos y una edición cuidada. Hay opciones con sesión previa, fotografía, video y entrega digital.',
    details: ['Preparativos, ceremonia, retratos y recepción', 'Coberturas por horas y paquetes completos', 'Atención en CDMX, Estado de México y destinos cercanos'],
    faqs: [
      { question: '¿Los paquetes de boda incluyen fotografía y video?', answer: 'Hay opciones de fotografía y paquetes que combinan fotografía y video. En el cotizador puedes revisar qué incluye cada alternativa.' },
      { question: '¿Puedo agregar horas de cobertura?', answer: 'Sí. El cotizador permite agregar horas y servicios complementarios antes de enviar la solicitud.' },
      { question: '¿Realizan sesiones previas a la boda?', answer: 'Sí, la sesión previa puede incluirse en determinados paquetes o agregarse según la propuesta elegida.' },
    ],
  },
  'xv-anos': {
    eyebrow: 'Fotografía y video para XV años en CDMX',
    heading: 'Cobertura de XV años, sesión previa y recuerdos de la celebración',
    intro: 'Creamos coberturas para XV años que pueden incluir sesión previa, preparación, ceremonia, vals, retratos familiares y fiesta. La propuesta se ajusta a la duración y al estilo de cada celebración.',
    details: ['Sesión previa y retratos de quinceañera', 'Ceremonia, vals, familia y ambiente de fiesta', 'Opciones de fotografía, video y entregables digitales'],
    faqs: [
      { question: '¿La sesión previa está incluida?', answer: 'Depende del paquete seleccionado. Puedes comparar las opciones y agregar servicios desde el cotizador.' },
      { question: '¿Cubren ceremonia y fiesta?', answer: 'Sí. La cobertura puede organizarse para documentar preparación, ceremonia, vals y recepción de acuerdo con las horas contratadas.' },
      { question: '¿Atienden XV años fuera de CDMX?', answer: 'Sí, se revisan solicitudes en Estado de México y otros destinos de la zona centro. Los traslados se confirman en la propuesta.' },
    ],
  },
  bautizos: {
    eyebrow: 'Fotografía de bautizos y familia en CDMX',
    heading: 'Recuerdos naturales de ceremonias y celebraciones familiares',
    intro: 'La cobertura de bautizos y eventos familiares se prepara según la ceremonia, la recepción, el número de horas y la ubicación. Buscamos imágenes cercanas, ordenadas y fáciles de compartir con la familia.',
    details: ['Ceremonia, retratos familiares y recepción', 'Cobertura adaptable al tamaño de la celebración', 'Propuesta personalizada según ubicación y duración'],
    faqs: [
      { question: '¿Pueden cubrir solo la ceremonia?', answer: 'Sí. La propuesta se ajusta a la duración y a los momentos que deseas documentar.' },
      { question: '¿Realizan retratos familiares durante el evento?', answer: 'Sí, se pueden organizar retratos familiares además del registro espontáneo de la celebración.' },
      { question: '¿Cómo solicito precio para un bautizo?', answer: 'Indica fecha, ubicación, duración aproximada y si habrá recepción para preparar una propuesta adecuada.' },
    ],
  },
  retratos: {
    eyebrow: 'Sesiones de retrato en CDMX',
    heading: 'Retratos personales, de pareja, graduación y proyectos editoriales',
    intro: 'Planeamos sesiones de retrato según el objetivo, la locación y el estilo visual. Podemos trabajar retratos personales, pareja, graduación, portafolio o contenido editorial con orientación durante la sesión.',
    details: ['Planeación de locación y estilo visual', 'Dirección durante la sesión y selección cuidada', 'Opciones para personas, parejas y proyectos editoriales'],
    faqs: [
      { question: '¿Ayudan a elegir la locación?', answer: 'Sí. La locación se recomienda de acuerdo con el estilo, el horario, los permisos y el tipo de retrato.' },
      { question: '¿Necesito experiencia frente a la cámara?', answer: 'No. Durante la sesión damos indicaciones sencillas de postura, movimiento y expresión.' },
      { question: '¿Hacen sesiones de graduación o pareja?', answer: 'Sí, la propuesta puede adaptarse a graduaciones, parejas, retrato personal y proyectos editoriales.' },
    ],
  },
  empresarial: {
    eyebrow: 'Fotografía y video empresarial en CDMX',
    heading: 'Contenido profesional para marcas, equipos y eventos corporativos',
    intro: 'Producimos headshots, retrato de equipo, fotografía de espacios, branding, cobertura de eventos y video empresarial. El alcance se define por número de personas, locaciones, duración y formatos de entrega.',
    details: ['Headshots y retratos de equipo', 'Fotografía de marca, espacios y productos en contexto', 'Cobertura corporativa y piezas de video empresarial'],
    faqs: [
      { question: '¿Pueden fotografiar a todo un equipo?', answer: 'Sí. La producción se organiza según el número de personas, el espacio disponible y el estilo visual de la empresa.' },
      { question: '¿Entregan archivos para web y redes sociales?', answer: 'Los formatos y tamaños de entrega se definen en la propuesta para adaptarse a web, comunicación interna o redes sociales.' },
      { question: '¿Realizan cobertura de eventos corporativos?', answer: 'Sí, podemos cubrir conferencias, reuniones, lanzamientos y otros eventos empresariales según horario y ubicación.' },
    ],
  },
};

const RELATED_ROUTES: Record<BuiltInRoutePath, RoutePath[]> = {
  inicio: ['bodas', 'xv-anos', 'retratos', 'empresarial'],
  bodas: ['xv-anos', 'retratos'],
  'xv-anos': ['bodas', 'retratos'],
  bautizos: ['bodas', 'retratos'],
  retratos: ['bodas', 'empresarial'],
  empresarial: ['retratos', 'inicio'],
};

const ROUTE_LABELS: Record<BuiltInRoutePath, string> = {
  inicio: 'Todos los servicios',
  bodas: 'Fotografía de bodas',
  'xv-anos': 'Foto y video para XV años',
  bautizos: 'Bautizos y familia',
  retratos: 'Retratos y sesiones',
  empresarial: 'Fotografía empresarial',
};

interface Props {
  currentRoute: RoutePath;
  categories?: CatalogCategory[];
  packages?: PackageOption[];
  onNavigateRoute: (route: RoutePath) => void;
  onQuoteClick: () => void;
}

export const ServiceSeoSection: React.FC<Props> = ({
  currentRoute,
  categories = DEFAULT_CATALOG_CATEGORIES,
  packages = [],
  onNavigateRoute,
  onQuoteClick,
}) => {
  const category = categories.find((item) => item.id === currentRoute);
  const content = useMemo<RouteContent>(() => {
    const builtIn = CONTENT[currentRoute as BuiltInRoutePath];
    if (builtIn) return builtIn;
    const name = category?.name || 'servicios de fotografía y video';
    const packageDetails = [...new Set(packages.flatMap((pkg) => pkg.features || []))].filter(Boolean).slice(0, 3);
    return {
      eyebrow: `${name} en Ciudad de México`,
      heading: `${name} con paquetes y atención personalizada`,
      intro: category?.description || `Conoce las opciones de ${name} disponibles con XPH. Compara los paquetes publicados y solicita disponibilidad para tu fecha, ubicación y necesidades.`,
      details: packageDetails.length ? packageDetails : [
        `Paquetes configurados especialmente para ${name}`,
        'Atención en CDMX, Estado de México y zona centro',
        'Cotización y disponibilidad confirmadas personalmente',
      ],
      faqs: [
        { question: `¿Qué incluyen los paquetes de ${name}?`, answer: 'Cada paquete muestra sus servicios, entregables y precio publicado. Puedes compararlos en el cotizador de esta misma página.' },
        { question: `¿Puedo personalizar un paquete de ${name}?`, answer: 'Sí. La propuesta puede ajustarse con servicios adicionales según la fecha, ubicación y necesidades del cliente.' },
        { question: '¿Cómo consulto disponibilidad?', answer: 'Selecciona un paquete, completa los datos de tu solicitud y la disponibilidad se confirmará personalmente.' },
      ],
    };
  }, [category, currentRoute, packages]);

  const relatedRoutes = useMemo(() => {
    const preferred = RELATED_ROUTES[currentRoute as BuiltInRoutePath] || [];
    return [...new Set([
      ...preferred,
      ...categories.filter((item) => item.active && item.id !== currentRoute).map((item) => item.id),
      ...(currentRoute === 'inicio' ? [] : ['inicio']),
    ])].filter((route) => route !== currentRoute).slice(0, 4) as RoutePath[];
  }, [categories, currentRoute]);

  useEffect(() => {
    let script = document.head.querySelector<HTMLScriptElement>('#xph-faq-structured-data');
    if (!script) {
      script = document.createElement('script');
      script.id = 'xph-faq-structured-data';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: content.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });
  }, [content]);

  return (
    <section className="py-16 sm:py-20 bg-[#111722] border-b border-white/5" aria-labelledby="service-seo-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-8 lg:gap-12 items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#D4AF37] font-mono flex items-center gap-2"><MapPin className="w-4 h-4" />{content.eyebrow}</p>
            <h2 id="service-seo-heading" className="text-2xl sm:text-4xl font-bold font-serif-luxury text-white mt-3 leading-tight">{content.heading}</h2>
            <p className="text-sm sm:text-base text-gray-300 leading-relaxed mt-4 max-w-3xl">{content.intro}</p>
            <div className="space-y-3 mt-6">
              {content.details.map((detail) => <p key={detail} className="flex items-start gap-3 text-sm text-gray-300"><CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />{detail}</p>)}
            </div>
            <button type="button" onClick={onQuoteClick} className="mt-7 px-6 py-3 rounded-xl gold-gradient-bg text-black font-bold text-sm inline-flex items-center gap-2">Cotizar este servicio<ArrowRight className="w-4 h-4" /></button>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-white flex items-center gap-2"><HelpCircle className="w-5 h-5 text-[#D4AF37]" />Preguntas frecuentes</h3>
            {content.faqs.map((faq) => (
              <details key={faq.question} className="group rounded-xl bg-[#0B0F17] border border-white/10 p-4">
                <summary className="cursor-pointer list-none font-semibold text-sm text-gray-100 flex items-start justify-between gap-3">{faq.question}<span className="text-[#D4AF37] group-open:rotate-45 transition-transform text-lg leading-none">+</span></summary>
                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mt-3 pr-5">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>

        <nav aria-label="Servicios relacionados" className="mt-10 pt-6 border-t border-white/10 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 mr-2">También te puede interesar:</span>
          {relatedRoutes.map((route) => <a key={route} href={routePath(route, categories)} onClick={(event) => { event.preventDefault(); onNavigateRoute(route); }} className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors">{ROUTE_LABELS[route as BuiltInRoutePath] || categories.find((item) => item.id === route)?.name || route}</a>)}
        </nav>
      </div>
    </section>
  );
};
