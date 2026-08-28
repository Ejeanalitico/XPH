import React from 'react';
import { MapPin, Mail, Phone, Clock, MessageSquare, ExternalLink } from 'lucide-react';
import { CatalogCategory, RoutePath, FooterContact } from '../types';
import { DEFAULT_FOOTER_CONTACT, normalizeFooterContact } from '../footerConfig';
import { DEFAULT_CATALOG_CATEGORIES } from '../utils/catalogCategories';
import { routePath } from '../utils/seo';

interface FooterProps {
  onNavigateRoute: (route: RoutePath) => void;
  onOpenClientPortal?: () => void;
  onOpenAdminPortal?: () => void;
  footerContact?: FooterContact;
  categories?: CatalogCategory[];
}

const XPH_LOGO = '/xph-logo.png?v=20260814-6';

export const Footer: React.FC<FooterProps> = ({
  onNavigateRoute,
  footerContact = DEFAULT_FOOTER_CONTACT,
  categories = DEFAULT_CATALOG_CATEGORIES,
}) => {
  const config = normalizeFooterContact(footerContact);
  const configuredRoutes = new Set(config.services.map((service) => service.route));
  const services = [
    ...config.services,
    ...categories
      .filter((category) => category.active && !configuredRoutes.has(category.id))
      .map((category) => ({ id: `category-${category.id}`, label: `✦ ${category.name}`, route: category.id })),
  ];
  const whatsappHref = `https://wa.me/${config.whatsapp.replace(/\D/g, '')}`;
  const phoneHref = `tel:${config.phone.replace(/[^+\d]/g, '')}`;
  const safeHref = (href: string) => href.startsWith('#') || /^https?:\/\//i.test(href) ? href : '#';

  return (
    <footer className="bg-[#0B0F17] border-t border-white/10 text-gray-400 text-xs pt-16 pb-32 sm:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 p-1.5 rounded-xl bg-[#0B0F17] border border-white/10 shadow-inner flex items-center justify-center shrink-0 overflow-hidden">
                <img src={XPH_LOGO} alt="XPH Fotografía & Video" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="text-base font-bold font-serif-luxury text-white">{config.brandTitle}</div>
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-mono">{config.brandSubtitle}</div>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{config.aboutText}</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">{config.specialtiesTitle}</h4>
            <ul className="space-y-2">
              {services.map((service) => <li key={service.id}><a href={routePath(service.route, categories)} onClick={(event) => { event.preventDefault(); onNavigateRoute(service.route); }} className="hover:text-[#D4AF37] text-left cursor-pointer">{service.label}</a></li>)}
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">{config.quickLinksTitle}</h4>
            <ul className="space-y-2">
              {config.quickLinks.map((link) => <li key={link.id}><a href={safeHref(link.href)} className="hover:text-[#D4AF37] flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /><span>{link.label}</span></a></li>)}
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">{config.contactTitle}</h4>
            <div className="space-y-2 text-gray-300">
              <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" /><span>{config.address}</span></div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#D4AF37] shrink-0" /><a href={`mailto:${config.email}`} className="hover:text-[#D4AF37]">{config.email}</a></div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#D4AF37] shrink-0" /><a href={phoneHref} className="hover:text-[#D4AF37]">{config.phone}</a></div>
              <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" /><a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">WhatsApp</a></div>
              <div className="flex items-center gap-2 text-gray-400 text-[11px]"><Clock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" /><span>{config.schedule}</span></div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">{config.socialTitle}</h4>
            <ul className="space-y-2">
              {config.socialLinks.map((social) => <li key={social.id}><a href={safeHref(social.url)} target="_blank" rel="noopener noreferrer" className="hover:text-[#D4AF37] flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /><span>{social.label}</span></a></li>)}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-[11px] text-gray-500 font-mono text-center sm:text-left">
          <p>{config.copyrightText}</p>
        </div>
      </div>
    </footer>
  );
};
