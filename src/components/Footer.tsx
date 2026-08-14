import React from 'react';
import { Camera, MapPin, Mail, Phone, HeartHandshake, Clock, MessageSquare, Sparkles } from 'lucide-react';
import { RoutePath, FooterContact } from '../types';

interface FooterProps {
  onNavigateRoute: (route: RoutePath) => void;
  footerContact: FooterContact;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateRoute, footerContact }) => {
  const whatsappHref = `https://wa.me/${footerContact.whatsapp.replace(/\D/g, '')}`;
  const phoneHref = `tel:${footerContact.phone.replace(/[^+\d]/g, '')}`;

  return (
    <footer className="bg-[#0B0F17] border-t border-white/10 text-gray-400 text-xs pt-16 pb-32 sm:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
            <p className="text-xs text-gray-400 leading-relaxed">{footerContact.aboutText}</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Especialidades</h4>
            <ul className="space-y-2">
              <li><button onClick={() => onNavigateRoute('bodas')} className="hover:text-[#D4AF37] text-left cursor-pointer">💍 Bodas</button></li>
              <li><button onClick={() => onNavigateRoute('xv-anos')} className="hover:text-[#D4AF37] text-left cursor-pointer">👑 XV Años</button></li>
              <li><button onClick={() => onNavigateRoute('bautizos')} className="hover:text-[#D4AF37] text-left cursor-pointer">🕊️ Bautizos & Familia</button></li>
              <li><button onClick={() => onNavigateRoute('retratos')} className="hover:text-[#D4AF37] text-left cursor-pointer">📸 Retratos & Sesiones</button></li>
              <li><button onClick={() => onNavigateRoute('empresarial')} className="hover:text-[#D4AF37] text-left cursor-pointer">💼 Empresarial & Branding</button></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Cotiza & Contacta</h4>
            <ul className="space-y-2">
              <li>
                <a href="#cotizador" className="hover:text-[#D4AF37] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cotizador</span>
                </a>
              </li>
              <li>
                <a href="#solicitud" className="hover:text-[#D4AF37] flex items-center gap-1.5 text-[#D4AF37] font-semibold">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Solicitar disponibilidad</span>
                </a>
              </li>
              <li>
                <a href="#cierre-presencial" className="hover:text-[#D4AF37] flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <HeartHandshake className="w-3.5 h-3.5" />
                  <span>Cita presencial & asesoría</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Contacto & Cobertura</h4>
            <div className="space-y-2 text-gray-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>{footerContact.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a href={`mailto:${footerContact.email}`} className="hover:text-[#D4AF37]">{footerContact.email}</a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a href={phoneHref} className="hover:text-[#D4AF37]">{footerContact.phone}</a>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">WhatsApp</a>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span>{footerContact.schedule}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-[11px] text-gray-500 font-mono text-center sm:text-left">
          <p>© 2026 Xavi.Ph Photography. Cobertura en CDMX, Estado de México y estados de la zona centro. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
