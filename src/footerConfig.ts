import { FooterContact, FooterQuickLink, FooterServiceLink, FooterSocialLink } from './types';

export type NormalizedFooterContact = FooterContact & {
  brandTitle: string;
  brandSubtitle: string;
  specialtiesTitle: string;
  quickLinksTitle: string;
  contactTitle: string;
  socialTitle: string;
  copyrightText: string;
  services: FooterServiceLink[];
  quickLinks: FooterQuickLink[];
  socialLinks: FooterSocialLink[];
};

export const DEFAULT_FOOTER_CONTACT: NormalizedFooterContact = {
  phone: '+52 56 1556 7863',
  whatsapp: '5615567863',
  email: 'contacto@xavi.ph',
  address: 'CDMX, Estado de México, Morelos, Puebla, Querétaro, Tlaxcala y Pachuca',
  schedule: 'Atención por WhatsApp y citas previamente coordinadas',
  aboutText: 'XPH Fotografía & Video; Producción Audiovisual para bodas, XV años, sesiones, eventos y proyectos empresariales.',
  brandTitle: 'XPH Fotografía & Video',
  brandSubtitle: 'Producción Audiovisual',
  specialtiesTitle: 'Especialidades',
  quickLinksTitle: 'Cotiza & Contacta',
  contactTitle: 'Contacto & Cobertura',
  socialTitle: 'Redes sociales',
  copyrightText: '© 2026 XPH Fotografía & Video; Producción Audiovisual. Todos los derechos reservados.',
  services: [
    { id: 'service-bodas', label: '💍 Bodas', route: 'bodas' },
    { id: 'service-xv', label: '👑 XV Años', route: 'xv-anos' },
    { id: 'service-bautizos', label: '🕊️ Bautizos & Familia', route: 'bautizos' },
    { id: 'service-retratos', label: '📸 Retratos & Sesiones', route: 'retratos' },
    { id: 'service-empresarial', label: '💼 Empresarial & Branding', route: 'empresarial' },
  ],
  quickLinks: [
    { id: 'link-quote', label: 'Cotizador', href: '#cotizador' },
    { id: 'link-availability', label: 'Solicitar disponibilidad', href: '#solicitud' },
    { id: 'link-consultation', label: 'Cita presencial & asesoría', href: '#cierre-presencial' },
  ],
  socialLinks: [
    { id: 'social-instagram', label: 'Instagram', url: 'https://www.instagram.com/xph.photos' },
    { id: 'social-facebook', label: 'Facebook', url: 'https://www.facebook.com/share/189P2eFVAa/' },
  ],
};

const isValidPublicRoute = (value: unknown) => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(value);

const textValue = (value: unknown, fallback: string) => typeof value === 'string' ? value : fallback;

export const normalizeFooterContact = (value?: Partial<FooterContact> | null): NormalizedFooterContact => {
  const input = value || {};
  const services = Array.isArray(input.services)
    ? input.services
      .filter((item): item is FooterServiceLink => Boolean(item?.label && isValidPublicRoute(item.route)))
      .map((item, index) => ({ ...item, id: item.id || `service-${index}` }))
    : DEFAULT_FOOTER_CONTACT.services;
  const quickLinks = Array.isArray(input.quickLinks)
    ? input.quickLinks
      .filter((item): item is FooterQuickLink => Boolean(item?.label && item?.href))
      .map((item, index) => ({ ...item, id: item.id || `quick-${index}` }))
    : DEFAULT_FOOTER_CONTACT.quickLinks;
  const socialLinks = Array.isArray(input.socialLinks)
    ? input.socialLinks
      .filter((item): item is FooterSocialLink => Boolean(item?.label && item?.url))
      .map((item, index) => ({ ...item, id: item.id || `social-${index}` }))
    : DEFAULT_FOOTER_CONTACT.socialLinks;

  return {
    phone: textValue(input.phone, DEFAULT_FOOTER_CONTACT.phone),
    whatsapp: textValue(input.whatsapp, DEFAULT_FOOTER_CONTACT.whatsapp),
    email: textValue(input.email, DEFAULT_FOOTER_CONTACT.email),
    address: textValue(input.address, DEFAULT_FOOTER_CONTACT.address),
    schedule: textValue(input.schedule, DEFAULT_FOOTER_CONTACT.schedule),
    aboutText: textValue(input.aboutText, DEFAULT_FOOTER_CONTACT.aboutText),
    brandTitle: textValue(input.brandTitle, DEFAULT_FOOTER_CONTACT.brandTitle),
    brandSubtitle: textValue(input.brandSubtitle, DEFAULT_FOOTER_CONTACT.brandSubtitle),
    specialtiesTitle: textValue(input.specialtiesTitle, DEFAULT_FOOTER_CONTACT.specialtiesTitle),
    quickLinksTitle: textValue(input.quickLinksTitle, DEFAULT_FOOTER_CONTACT.quickLinksTitle),
    contactTitle: textValue(input.contactTitle, DEFAULT_FOOTER_CONTACT.contactTitle),
    socialTitle: textValue(input.socialTitle, DEFAULT_FOOTER_CONTACT.socialTitle),
    copyrightText: textValue(input.copyrightText, DEFAULT_FOOTER_CONTACT.copyrightText),
    services,
    quickLinks,
    socialLinks,
  };
};
