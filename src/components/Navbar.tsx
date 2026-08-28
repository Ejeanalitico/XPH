import React, { useState } from 'react';
import { Menu, X, Sparkles, ChevronDown, MapPin, CalendarCheck, Shield } from 'lucide-react';
import { BuiltInRoutePath, CatalogCategory, RoutePath } from '../types';
import { DEFAULT_CATALOG_CATEGORIES } from '../utils/catalogCategories';
import { routePath } from '../utils/seo';

interface NavbarProps {
  currentRoute: RoutePath;
  categories?: CatalogCategory[];
  onNavigateRoute: (route: RoutePath) => void;
  onOpenClientPortal?: () => void;
  onOpenAdminPortal?: () => void;
  favoritesCount?: number;
  onOpenFavorites?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  categories = DEFAULT_CATALOG_CATEGORIES,
  onNavigateRoute,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [routeDropdownOpen, setRouteDropdownOpen] = useState(false);

  const builtInLabels: Record<BuiltInRoutePath, { title: string; subtitle: string; icon: string }> = {
    inicio: { title: 'Inicio', subtitle: 'Servicios y referencias visuales', icon: '✨' },
    bodas: { title: 'Bodas', subtitle: 'Fotografía y video para tu historia', icon: '💍' },
    'xv-anos': { title: 'XV Años', subtitle: 'Cobertura y sesión previa', icon: '👑' },
    bautizos: { title: 'Bautizos & Familia', subtitle: 'Ceremonias y celebraciones', icon: '🕊️' },
    retratos: { title: 'Retratos & Editorial', subtitle: 'Sesiones personales y creativas', icon: '📸' },
    empresarial: { title: 'Empresarial & Branding', subtitle: 'Imagen para marcas y equipos', icon: '💼' },
  };

  const selectableCategories = categories.filter((category) => category.active);
  const activeCategory = selectableCategories.find((category) => category.id === currentRoute);
  const activeRouteLabel = builtInLabels[currentRoute as BuiltInRoutePath] || {
    title: activeCategory?.name || 'Especialidad',
    subtitle: activeCategory?.description || 'Paquetes y servicios XPH',
    icon: '✦',
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    setRouteDropdownOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectRoute = (route: RoutePath) => {
    onNavigateRoute(route);
    setRouteDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  const openAdmin = () => {
    window.location.href = '/?xph-admin=panel';
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0B0F17]/95 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <a href="/" onClick={(event) => { event.preventDefault(); handleSelectRoute('inicio'); }} className="group text-left cursor-pointer min-w-0">
            <span className="text-lg sm:text-xl xl:text-2xl font-bold tracking-wide font-serif-luxury text-white block truncate">
              XPH <span className="text-[#D4AF37] font-sans font-light">Fotografía & Video</span>
            </span>
            <span className="text-[9px] sm:text-[10px] tracking-widest text-gray-400 uppercase block font-mono">
              Producción Audiovisual
            </span>
          </a>

          {currentRoute !== 'inicio' && (
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-medium">
              <span>{activeRouteLabel.icon}</span>
              <span>{activeRouteLabel.title}</span>
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-3 text-sm font-medium text-gray-300">
          <div className="relative">
            <button
              onClick={() => setRouteDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-all cursor-pointer font-semibold"
            >
              <span>{activeRouteLabel.icon}</span>
              <span>{currentRoute === 'inicio' ? 'Especialidad' : activeRouteLabel.title}</span>
              <ChevronDown className={`w-4 h-4 text-[#D4AF37] transition-transform ${routeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {routeDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-[#161C28] border border-[#D4AF37]/30 shadow-2xl p-2 z-50 backdrop-blur-xl">
                <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase text-gray-400 font-mono">Especialidades</div>
                {selectableCategories.map((category) => {
                  const route = category.id;
                  const label = builtInLabels[route as BuiltInRoutePath] || { title: category.name, subtitle: category.description || 'Paquetes y servicios XPH', icon: '✦' };
                  return (
                  <a
                    key={route}
                    href={routePath(route, categories)}
                    onClick={(event) => { event.preventDefault(); handleSelectRoute(route); }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-3 cursor-pointer ${currentRoute === route ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]' : 'hover:bg-white/5 text-gray-200 hover:text-white'}`}
                  >
                    <span className="text-xl mt-0.5">{label.icon}</span>
                    <div>
                      <div className="font-semibold text-sm">{label.title}</div>
                      <div className="text-xs text-gray-400 line-clamp-2">{label.subtitle}</div>
                    </div>
                  </a>
                  );
                })}
              </div>
            )}
          </div>

          <button onClick={() => scrollToSection('galerias')} className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer">Galería</button>
          <button onClick={() => scrollToSection('cotizador')} className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer flex items-center gap-1 text-[#D4AF37] font-semibold"><Sparkles className="w-3.5 h-3.5" />Cotizador</button>
          <button onClick={() => scrollToSection('cierre-presencial')} className="hidden xl:flex hover:text-[#D4AF37] transition-colors py-1 cursor-pointer items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />Cita</button>
          <button onClick={() => scrollToSection('solicitud')} className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer flex items-center gap-1 font-semibold"><CalendarCheck className="w-3.5 h-3.5 text-[#D4AF37]" />Solicitar fecha</button>
          <button onClick={openAdmin} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-all flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Administrador</button>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <button onClick={() => setMobileMenuOpen((prev) => !prev)} className="p-2 rounded-lg bg-white/5 text-gray-300" aria-label="Abrir menú">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0B0F17] border-b border-white/10 px-4 pt-3 pb-6 space-y-4">
          <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 font-mono">Especialidades</div>
          <div className="grid grid-cols-1 gap-2">
            {selectableCategories.map((category) => {
              const route = category.id;
              const label = builtInLabels[route as BuiltInRoutePath] || { title: category.name, subtitle: category.description || 'Paquetes y servicios XPH', icon: '✦' };
              return <a key={route} href={routePath(route, categories)} onClick={(event) => { event.preventDefault(); handleSelectRoute(route); }} className={`p-2.5 rounded-xl text-left flex items-center gap-3 cursor-pointer ${currentRoute === route ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-bold' : 'bg-white/5 text-gray-300'}`}>
                <span>{label.icon}</span>
                <span className="text-sm">{label.title}</span>
              </a>;
            })}
          </div>
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2 font-medium text-gray-300">
            <button onClick={() => scrollToSection('galerias')} className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37]">Galería</button>
            <button onClick={() => scrollToSection('cotizador')} className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37] text-[#D4AF37]">Cotizador</button>
            <button onClick={() => scrollToSection('solicitud')} className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37] font-semibold">Solicitar disponibilidad</button>
            <button onClick={openAdmin} className="text-left py-2 flex items-center gap-2 text-[#D4AF37]"><Shield className="w-4 h-4" />Administrador</button>
          </div>
        </div>
      )}
    </header>
  );
};
