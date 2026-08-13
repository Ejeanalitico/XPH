import React from 'react';
import { Camera, MapPin, Mail, Phone, Instagram, Facebook, HeartHandshake, Clock, MessageSquare } from 'lucide-react';
import { RoutePath, FooterContact } from '../types';

interface FooterProps {
  onNavigateRoute: (route: RoutePath) => void;
  onOpenClientPortal: () => void;
  onOpenAdminPortal: () => void;
  footerContact?: FooterContact;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigateRoute,
  onOpenClientPortal,
  onOpenAdminPortal,
  footerContact = {
    phone: '+52 55 1234 5678',
    whatsapp: '+52 55 1234 5678',
    email: 'contacto@xavi.ph',
    address: 'Polanco & Roma Norte, Ciudad de México (CDMX)',
    schedule: 'Lunes a Sábado: 09:00 - 19:00 hrs',
    aboutText: 'Estudio especializado en fotografía editorial, cine documental y fotografía empresarial con cobertura exclusiva en Ciudad de México.',
  },
}) => {
  return (
    <footer className="bg-[#0B0F17] border-t border-white/10 text-gray-400 text-xs pt-16 pb-32 sm:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Col 1: Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#AA771C] p-0.5 flex items-center justify-center">
                <div className="w-full h-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
                  <Camera className="w-4 h-4 text-[#D4AF37]" />
                </div>
              </div>
              <span className="text-xl font-bold font-serif-luxury text-white">
                XAVI<span className="text-[#D4AF37] font-sans font-light">.PH</span>
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              {footerContact.aboutText}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-white/5 hover:text-[#D4AF37] transition-colors">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-white/5 hover:text-[#D4AF37] transition-colors">
                <Facebook className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Col 2: Especialidades / Rutas */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Especialidades & Cobertura</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={() => onNavigateRoute('bodas')} className="hover:text-[#D4AF37] text-left cursor-pointer">
                  💍 Bodas (Destination & Editorial)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigateRoute('xv-anos')} className="hover:text-[#D4AF37] text-left cursor-pointer">
                  👑 Quinceañeras (XV Años)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigateRoute('bautizos')} className="hover:text-[#D4AF37] text-left cursor-pointer">
                  🕊️ Bautizos & Eventos Familiares
                </button>
              </li>
              <li>
                <button onClick={() => onNavigateRoute('retratos')} className="hover:text-[#D4AF37] text-left cursor-pointer">
                  📸 Retratos & Moda Editorial
                </button>
              </li>
              <li>
                <button onClick={() => onNavigateRoute('empresarial')} className="hover:text-[#D4AF37] text-left cursor-pointer">
                  💼 Empresarial & Branding
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Portales de Acceso */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Servicio & Accesos</h4>
            <ul className="space-y-2">
              <li>
                <a href="#cierre-presencial" className="hover:text-[#D4AF37] flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <HeartHandshake className="w-3.5 h-3.5" />
                  <span>Cita Presencial & Asesoría</span>
                </a>
              </li>
              <li>
                <button onClick={onOpenClientPortal} className="hover:text-[#D4AF37] text-left cursor-pointer">
                  Acceso a Galería Privada (PIN)
                </button>
              </li>
              <li>
                <button onClick={onOpenAdminPortal} className="hover:text-[#D4AF37] text-left cursor-pointer text-gray-400">
                  Panel de Control / Administrador
                </button>
              </li>
              <li><a href="#contratacion" className="hover:text-[#D4AF37]">Contrato Firmado con Validez Legal</a></li>
            </ul>
          </div>

          {/* Col 4: Contact & Coverage (Editable from Admin) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Contacto & Cobertura</h4>
            <div className="space-y-2 text-gray-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>{footerContact.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>{footerContact.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>{footerContact.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span>{footerContact.schedule}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Legal Notice */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-500 font-mono text-center sm:text-left">
          <p>© 2026 Xavi.Ph Photography. Cobertura en CDMX, EdoMex, Morelos, Tlaxcala, Puebla, Pachuca, Querétaro y toda la República. Todos los derechos reservados.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#" className="hover:text-gray-300">Términos de Servicio</a>
            <a href="#" className="hover:text-gray-300">Aviso de Privacidad</a>
            <a href="#" className="hover:text-gray-300">Garantía de Contrato Firmado</a>
          </div>
        </div>

      </div>
    </footer>
  );
};
