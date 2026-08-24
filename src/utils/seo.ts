import { RoutePath, SeoPageSetting, SeoSettings } from '../types';

const SITE_URL = 'https://www.xaviph.com';

const SEO_METADATA: Record<RoutePath, { path: string; title: string; description: string; service: string }> = {
  inicio: {
    path: '/',
    title: 'Fotografía y Video en CDMX | XPH',
    description: 'Fotografía y video profesional en CDMX para bodas, XV años, eventos, retratos y empresas. Consulta paquetes y solicita disponibilidad con XPH.',
    service: 'Fotografía y video profesional',
  },
  bodas: {
    path: '/bodas',
    title: 'Fotógrafo de Bodas en CDMX | Foto y Video XPH',
    description: 'Fotografía y video para bodas en CDMX y zona centro. Cobertura civil y completa, sesión previa, video y entrega digital. Revisa paquetes XPH.',
    service: 'Fotografía y video para bodas',
  },
  'xv-anos': {
    path: '/xv-anos',
    title: 'Fotografía y Video para XV Años en CDMX | XPH',
    description: 'Paquetes de fotografía y video para XV años en CDMX: sesión previa, ceremonia, vals, fiesta y entregables digitales. Cotiza con XPH.',
    service: 'Fotografía y video para XV años',
  },
  bautizos: {
    path: '/bautizos',
    title: 'Fotografía de Bautizos y Familia en CDMX | XPH',
    description: 'Fotografía y video para bautizos y celebraciones familiares en CDMX, Estado de México y zona centro. Solicita una propuesta personalizada.',
    service: 'Fotografía de bautizos y eventos familiares',
  },
  retratos: {
    path: '/retratos',
    title: 'Fotografía de Retrato y Sesiones en CDMX | XPH',
    description: 'Sesiones de retrato en CDMX para personas, parejas, graduaciones y proyectos editoriales. Fotografía profesional con propuesta personalizada.',
    service: 'Fotografía de retrato y sesiones',
  },
  empresarial: {
    path: '/empresarial',
    title: 'Fotografía y Video Empresarial en CDMX | XPH',
    description: 'Fotografía corporativa, headshots, branding y video para empresas en CDMX. Contenido visual profesional para marcas, equipos y eventos.',
    service: 'Fotografía y video empresarial',
  },
};

export const DEFAULT_SEO_SETTINGS: Record<RoutePath, SeoPageSetting> = Object.fromEntries(
  Object.entries(SEO_METADATA).map(([route, metadata]) => [route, {
    title: metadata.title,
    description: metadata.description,
    indexed: true,
  }]),
) as Record<RoutePath, SeoPageSetting>;

export const normalizeSeoSettings = (value?: SeoSettings | null): Record<RoutePath, SeoPageSetting> =>
  (Object.keys(SEO_METADATA) as RoutePath[]).reduce((acc, route) => {
    const candidate = value?.[route];
    const fallback = DEFAULT_SEO_SETTINGS[route];
    acc[route] = {
      title: String(candidate?.title || fallback.title).trim().slice(0, 120) || fallback.title,
      description: String(candidate?.description || fallback.description).trim().slice(0, 320) || fallback.description,
      indexed: candidate?.indexed !== false,
    };
    return acc;
  }, {} as Record<RoutePath, SeoPageSetting>);

const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

export const routePath = (route: RoutePath) => SEO_METADATA[route].path;

export const updateRouteMetadata = (route: RoutePath, settings?: SeoSettings | null) => {
  const defaults = SEO_METADATA[route];
  const configured = normalizeSeoSettings(settings)[route];
  const metadata = { ...defaults, ...configured };
  const canonicalUrl = `${SITE_URL}${metadata.path}`;
  document.title = metadata.title;
  document.documentElement.lang = 'es-MX';

  setMeta('meta[name="description"]', 'name', 'description', metadata.description);
  setMeta(
    'meta[name="robots"]',
    'name',
    'robots',
    metadata.indexed
      ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
      : 'noindex,nofollow,noarchive',
  );
  setMeta('meta[property="og:title"]', 'property', 'og:title', metadata.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', metadata.description);
  setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', metadata.title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', metadata.description);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  let structuredData = document.head.querySelector<HTMLScriptElement>('#xph-route-structured-data');
  if (!structuredData) {
    structuredData = document.createElement('script');
    structuredData.id = 'xph-route-structured-data';
    structuredData.type = 'application/ld+json';
    document.head.appendChild(structuredData);
  }
  structuredData.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: metadata.service,
    description: metadata.description,
    url: canonicalUrl,
    areaServed: ['Ciudad de México', 'Estado de México', 'Morelos', 'Puebla', 'Querétaro', 'Tlaxcala', 'Pachuca'],
    provider: {
      '@type': 'ProfessionalService',
      name: 'XPH Fotografía & Video',
      url: SITE_URL,
      telephone: '+52 56 1556 7863',
    },
  });
};
