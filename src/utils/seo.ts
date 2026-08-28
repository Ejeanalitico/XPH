import {
  BuiltInRoutePath,
  CatalogCategory,
  RoutePath,
  SeoPageSetting,
  SeoSettings,
} from '../types';
import { slugifyCatalogValue } from './catalogCategories';

const SITE_URL = 'https://www.xaviph.com';

type RouteMetadata = {
  path: string;
  title: string;
  description: string;
  service: string;
  indexed: boolean;
  imageUrl?: string;
};

const SEO_METADATA: Record<BuiltInRoutePath, Omit<RouteMetadata, 'indexed' | 'imageUrl'>> = {
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

const isBuiltInRoute = (route: string): route is BuiltInRoutePath => route in SEO_METADATA;

const categoryDescription = (category: CatalogCategory) => {
  const configured = String(category.description || '').trim();
  if (configured) return configured;
  return `Conoce los paquetes de ${category.name} de XPH en CDMX, Estado de México y zona centro. Compara opciones y solicita disponibilidad.`;
};

const categoryMetadata = (category: CatalogCategory): RouteMetadata => ({
  path: `/${slugifyCatalogValue(category.slug || category.name || category.id)}`,
  title: `${category.name} en CDMX | XPH Fotografía & Video`.slice(0, 120),
  description: categoryDescription(category).slice(0, 320),
  service: category.name,
  indexed: true,
  imageUrl: category.imageUrl || undefined,
});

const fallbackMetadata = (route: string): RouteMetadata => {
  const label = route.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    path: `/${slugifyCatalogValue(route)}`,
    title: `${label} | XPH Fotografía & Video`.slice(0, 120),
    description: `Conoce los servicios y paquetes de ${label} disponibles con XPH Fotografía & Video.`.slice(0, 320),
    service: label,
    indexed: false,
  };
};

export const DEFAULT_SEO_SETTINGS: Record<BuiltInRoutePath, SeoPageSetting> = Object.fromEntries(
  Object.entries(SEO_METADATA).map(([route, metadata]) => [route, {
    title: metadata.title,
    description: metadata.description,
    indexed: true,
  }]),
) as Record<BuiltInRoutePath, SeoPageSetting>;

const normalizeSetting = (candidate: SeoPageSetting | undefined, fallback: SeoPageSetting): SeoPageSetting => ({
  title: String(candidate?.title || fallback.title).trim().slice(0, 120) || fallback.title,
  description: String(candidate?.description || fallback.description).trim().slice(0, 320) || fallback.description,
  indexed: candidate?.indexed !== false,
});

export const normalizeSeoSettings = (
  value?: SeoSettings | null,
  categories: CatalogCategory[] = [],
): Record<string, SeoPageSetting> => {
  const normalized: Record<string, SeoPageSetting> = {};

  Object.entries(value || {}).forEach(([route, candidate]) => {
    if (!candidate || typeof candidate !== 'object') return;
    const fallback = fallbackMetadata(route);
    normalized[route] = normalizeSetting(candidate, fallback);
  });

  (Object.keys(SEO_METADATA) as BuiltInRoutePath[]).forEach((route) => {
    normalized[route] = normalizeSetting(value?.[route], DEFAULT_SEO_SETTINGS[route]);
  });

  categories.forEach((category) => {
    const fallback = categoryMetadata(category);
    normalized[category.id] = normalizeSetting(value?.[category.id] || value?.[category.slug], fallback);
  });

  return normalized;
};

const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

export const routePath = (route: RoutePath, categories: CatalogCategory[] = []) => {
  if (route === 'inicio') return '/';
  const category = categories.find((item) => item.id === route || item.slug === route);
  if (category) return `/${slugifyCatalogValue(category.slug || category.name || category.id)}`;
  if (isBuiltInRoute(route)) return SEO_METADATA[route].path;
  return `/${slugifyCatalogValue(route)}`;
};

export const getRouteMetadata = (
  route: RoutePath,
  settings?: SeoSettings | null,
  category?: CatalogCategory,
): RouteMetadata => {
  const defaults: RouteMetadata = isBuiltInRoute(route)
    ? { ...SEO_METADATA[route], indexed: true }
    : category
      ? categoryMetadata(category)
      : fallbackMetadata(route);
  const configured = settings?.[route] || (category ? settings?.[category.slug] : undefined);
  return {
    ...defaults,
    title: String(configured?.title || defaults.title).trim().slice(0, 120) || defaults.title,
    description: String(configured?.description || defaults.description).trim().slice(0, 320) || defaults.description,
    indexed: configured?.indexed !== false && defaults.indexed,
  };
};

export const updateRouteMetadata = (
  route: RoutePath,
  settings?: SeoSettings | null,
  category?: CatalogCategory,
) => {
  const metadata = getRouteMetadata(route, settings, category);
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
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', metadata.title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', metadata.description);
  if (metadata.imageUrl) {
    setMeta('meta[property="og:image"]', 'property', 'og:image', metadata.imageUrl);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', metadata.imageUrl);
  }

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
    image: metadata.imageUrl || undefined,
    areaServed: ['Ciudad de México', 'Estado de México', 'Morelos', 'Puebla', 'Querétaro', 'Tlaxcala', 'Pachuca'],
    provider: {
      '@type': 'ProfessionalService',
      name: 'XPH Fotografía & Video',
      url: SITE_URL,
      telephone: '+52 56 1556 7863',
    },
  });
};
