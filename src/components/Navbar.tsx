import React, { useState } from 'react';
import { Camera, Sun, Moon, UserCheck, ShieldCheck, Heart, Menu, X, Sparkles, ChevronDown, CalendarCheck, MapPin } from 'lucide-react';
import { RoutePath } from '../types';

interface NavbarProps {
  currentRoute: RoutePath;
  onNavigateRoute: (route: RoutePath) => void;
  onOpenClientPortal: () => void;
  onOpenAdminPortal: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigateRoute,
  onOpenClientPortal,
  onOpenAdminPortal,
  isDarkMode,
  onToggleTheme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [routeDropdownOpen, setRouteDropdownOpen] = useState(false);

  const routeLabels: Record<RoutePath, { title: string; subtitle: string; icon: string }> = {
    inicio: { title: 'Inicio / Editorial', subtitle: 'Visión de marca & portafolio', icon: '✨' },
    bodas: { title: 'Bodas CDMX', subtitle: 'Historias de amor inmortales', icon: '💍' },
    'xv-anos': { title: 'Quinceañeras (XV Años)', subtitle: 'Tendencias & sesión youth', icon: '👑' },
    bautizos: { title: 'Bautizos & Familia', subtitle: 'Calidez y emoción espontánea', icon: '🕊️' },
    retratos: { title: 'Retratos & Editorial', subtitle: 'Personal branding & graduaciones', icon: '📸' },
    empresarial: { title: 'Empresarial & Branding', subtitle: 'Headshots & eventos corporativos', icon: '💼' },
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    setRouteDropdownOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectRoute = (route: RoutePath) => {
    onNavigateRoute(route);
    setRouteDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0B0F17]/90 border-b border-white/10 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo & Live Availability Indicator */}
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
              <span className="text-xl font-bold tracking-wider font-serif-luxury text-white flex items-center gap-1.5">
                XAVI<span className="text-[#D4AF37] font-sans font-light">.PH</span>
              </span>
              <span className="text-[10px] tracking-widest text-gray-400 uppercase block font-mono">
                Fotografía Editorial
              </span>
            </div>
          </button>

          {/* Route Active Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-medium">
            <span>{routeLabels[currentRoute].icon}</span>
            <span className="capitalize">{routeLabels[currentRoute].title}</span>
          </div>
        </div>

        {/* Desktop Navigation Links & Route Selector */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-300">
          
          {/* Multi-page Navigation Dropdown */}
          <div className="relative">
            <button
              onClick={() => setRouteDropdownOpen(!routeDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-all cursor-pointer font-semibold"
            >
              <span>{routeLabels[currentRoute].icon}</span>
              <span>{routeLabels[currentRoute].title}</span>
              <ChevronDown className={`w-4 h-4 text-[#D4AF37] transition-transform ${routeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {routeDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-[#161C28] border border-[#D4AF37]/30 shadow-2xl p-2 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase text-gray-400 font-mono">
                  Especialidades / Secciones
                </div>
                {(Object.keys(routeLabels) as RoutePath[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleSelectRoute(r)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-3 cursor-pointer ${
                      currentRoute === r
                        ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]'
                        : 'hover:bg-white/5 text-gray-200 hover:text-white'
                    }`}
                  >
                    <span className="text-xl mt-0.5">{routeLabels[r].icon}</span>
                    <div>
                      <div className="font-semibold text-sm">{routeLabels[r].title}</div>
                      <div className="text-xs text-gray-400">{routeLabels[r].subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => scrollToSection('galerias')}
            className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer"
          >
            Galería
          </button>

          <button
            onClick={() => scrollToSection('cotizador')}
            className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer flex items-center gap-1 text-[#D4AF37] font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Cotizador
          </button>

          <button
            onClick={() => scrollToSection('cierre-presencial')}
            className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer flex items-center gap-1"
          >
            <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
            Cita Presencial
          </button>

          <button
            onClick={() => scrollToSection('contratacion')}
            className="hover:text-[#D4AF37] transition-colors py-1 cursor-pointer"
          >
            Contrato Firmado
          </button>
        </nav>

        {/* Header Right Utility Actions */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all cursor-pointer"
            title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-[#D4AF37]" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Dual Login Modals */}
          <button
            onClick={onOpenClientPortal}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Acceso Clientes</span>
          </button>

          <button
            onClick={onOpenAdminPortal}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#161C28] border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Admin</span>
          </button>
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-white/5 text-gray-300"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-[#D4AF37]" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-white/5 text-gray-300"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0B0F17] border-b border-white/10 px-4 pt-3 pb-6 space-y-4">
          <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 font-mono">
            Navegar Sección / Especialidad
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(routeLabels) as RoutePath[]).map((r) => (
              <button
                key={r}
                onClick={() => handleSelectRoute(r)}
                className={`p-2.5 rounded-xl text-left flex items-center gap-3 cursor-pointer ${
                  currentRoute === r
                    ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-bold'
                    : 'bg-white/5 text-gray-300'
                }`}
              >
                <span>{routeLabels[r].icon}</span>
                <span className="text-sm">{routeLabels[r].title}</span>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-white/10 flex flex-col gap-2 font-medium text-gray-300">
            <button
              onClick={() => scrollToSection('galerias')}
              className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37]"
            >
              Galería Destacada
            </button>
            <button
              onClick={() => scrollToSection('cotizador')}
              className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37] text-[#D4AF37]"
            >
              Cotizador Dinámico
            </button>
            <button
              onClick={() => scrollToSection('cierre-presencial')}
              className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37]"
            >
              Cita Presencial
            </button>
            <button
              onClick={() => scrollToSection('contratacion')}
              className="text-left py-2 border-b border-white/5 hover:text-[#D4AF37]"
            >
              Contrato Firmado
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => { setMobileMenuOpen(false); onOpenClientPortal(); }}
              className="w-full py-2.5 px-3 text-xs font-semibold rounded-xl bg-white/5 border border-white/10 text-gray-200 flex items-center justify-center gap-2"
            >
              <UserCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>Acceso Clientes</span>
            </button>

            <button
              onClick={() => { setMobileMenuOpen(false); onOpenAdminPortal(); }}
              className="w-full py-2.5 px-3 text-xs font-semibold rounded-xl bg-[#161C28] border border-[#D4AF37]/30 text-[#D4AF37] flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Portal</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
