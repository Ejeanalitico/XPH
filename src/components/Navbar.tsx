import React, { useState } from 'react';
import { Camera, Sun, Moon, Menu, X, Sparkles, ChevronDown, MapPin, CalendarCheck } from 'lucide-react';
import { RoutePath } from '../types';

interface NavbarProps {
  currentRoute: RoutePath;
  onNavigateRoute: (route: RoutePath) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigateRoute,
  isDarkMode,
  onToggleTheme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [routeDropdownOpen, setRouteDropdownOpen] = useState(false);

  const routeLabels: Record<RoutePath, { title: string; subtitle: string; icon: string }> = {
    inicio: { title: 'Inicio / Editorial', subtitle: 'Portafolio y servicios', icon: '✨' },
    bodas: { title: 'Bodas', subtitle: 'Fotografía y video para tu historia', icon: '💍' },
    'xv-anos': { title: 'XV Años', subtitle: 'Cobertura y sesión previa', icon: '👑' },
    bautizos: { title: 'Bautizos & Familia', subtitle: 'Ceremonias y celebraciones', icon: '🕊️' },
    retratos: { title: 'Retratos & Editorial', subtitle: 'Sesiones personales y creativas', icon: '📸' },
    empresarial: { title: 'Empresarial & Branding', subtitle: 'Imagen para marcas y equipos', icon: '💼' },
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

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0B0F17]/90 border-b border-white/10 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleSelectRoute('inicio')}
            className="flex items-center gap-3 group text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#AA771C] p-0.5 flex items-center justify-center shadow-lg shadow-[#D4AF37]/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
                <Camera className="w-5 h-5 text-[#D4AF37]" />
              </div>
            </div>
            <div>
              <span className="text-lg sm:text-xl font-bold tracking-wider font-serif-luxury text-white flex items-center gap-1.5">
                XPH <span className="text-[#D4AF37] font-sans font-light">Fotografía & Video</span>
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-widest text-gray-400 uppercase block font-mono">
                Producción Audiovisual
              </span>
            </div>
          </button>

          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-medium">
            <span>{routeLabels[currentRoute].icon}</span>
            <span>{routeLabels[currentRoute].title}</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-300">
          <div className="relative">
            <button
              onClick={() => setRouteDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-all cursor-pointer font-semibold"
            >
              <span>{routeLabels[currentRoute].icon}</span>
              <span>{routeLabels[currentRoute].title}</span>
              <ChevronDown className={`w-4 h-4 text-[#D4AF37] transition-transform ${routeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {routeDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-[#161C28] border border-[#D4AF37]/30 shadow-2xl p-2 z-50 backdrop-blur-xl">
                <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase text-gray-400 font-mono">
                  Especialidades
                </div>
                {(Object.keys(routeLabels) as RoutePath[]).map((route) => (
                  <button
                    key={route}
                    onClick={() => handleSelectRoute(route)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-3 cursor-pointer ${
                      currentRoute === route
                        ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]'
                        : 'hover:bg-white/5 text-gray-200 hover:text-white'
                    }`}
                  >
                    <span className="text-xl mt-0.5">{routeLabels[route].icon}</span>
                    <div>
                      <div className="font-semibold text-sm">{routeLabels[route].title}</div>
                      <div className="text-xs text-gray-400">{routeLabels[route].subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => scrollToSection('galerias')} className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer">
            Galería
          </button>

          <button onClick={() => scrollToSection('cotizador')} className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer flex items-center gap-1 text-[#D4AF37] font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Cotizador
          </button>

          <button onClick={() => scrollToSection('cierre-presencial')} className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
            Cita presencial
          </button>

          <button onClick={() => scrollToSection('solicitud')} className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer flex items-center gap-1 font-semibold">
            <CalendarCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
            Solicitar fecha
          </button>
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all cursor-pointer"
            title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-[#D4AF37]" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          <button
            onClick={() => scrollToSection('solicitud')}
            className="px-4 py-2.5 text-xs font-bold rounded-xl gold-gradient-bg text-black flex items-center gap-2 cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4" />
            Consultar disponibilidad
          </button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button onClick={onToggleTheme} className="p-2 rounded-lg bg-white/5 text-gray-300" aria-label="Cambiar tema">
            {isDarkMode ? <Sun className="w-4 h-4 text-[#D4AF37]" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
          <button onClick={() => setMobileMenuOpen((prev) => !prev)} className="p-2 rounded-lg bg-white/5 text-gray-300" aria-label="Abrir menú">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0B0F17] border-b border-white/10 px-4 pt-3 pb-6 space-y-4">
          <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 font-mono">
            Especialidades
          </div>
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(routeLabels) as RoutePath[]).map((route) => (
              <button
                key={route}
                onClick={() => handleSelectRoute(route)}
                className={`p-2.5 rounded-xl text-left flex items-center gap-3 cursor-pointer ${
                  currentRoute === route
                    ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-bold'
                    : 'bg-white/5 text-gray-300'
                }`}
              >
                <span>{routeLabels[route].icon}</span>
                <span className="text-sm">{routeLabels[route].title}</span>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-white/10 flex flex-col gap-2 font-medium text-gray-300">
            <button onClick={() => scrollToSection('galerias')} className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37]">
              Galería
            </button>
            <button onClick={() => scrollToSection('cotizador')} className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37] text-[#D4AF37]">
              Cotizador
            </button>
            <button onClick={() => scrollToSection('cierre-presencial')} className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37]">
              Cita presencial
            </button>
            <button onClick={() => scrollToSection('solicitud')} className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37] font-semibold">
              Solicitar disponibilidad
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
