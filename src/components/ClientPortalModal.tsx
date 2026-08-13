import React, { useState } from 'react';
import { X, Lock, Download, Heart, CheckCircle2, Key, Image as ImageIcon, Sparkles } from 'lucide-react';
import { GALLERY_IMAGES } from '../data/gallery';

interface ClientPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (title: string, description?: string) => void;
}

export const ClientPortalModal: React.FC<ClientPortalModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [clientFavorites, setClientFavorites] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234' || pin.length >= 4) {
      setIsUnlocked(true);
      onShowToast('Acceso Concedido', 'Galería privada desbloqueada para Valeria & Carlos.');
    } else {
      onShowToast('PIN Incorrecto', 'Prueba ingresando el PIN de prueba: 1234');
    }
  };

  const toggleClientFav = (id: string) => {
    setClientFavorites((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-[#161C28] rounded-2xl border border-white/15 p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!isUnlocked ? (
          /* PIN LOGIN SCREEN */
          <div className="max-w-md mx-auto text-center space-y-6 py-8">
            <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mx-auto">
              <Key className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold font-serif-luxury text-white">
                Portal de Entrega de Fotos
              </h3>
              <p className="text-xs text-gray-300">
                Ingresa el Código de Evento o PIN de 4 dígitos enviado a tu correo.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="PIN de Acceso (Prueba: 1234)"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full text-center tracking-[0.5em] text-xl font-mono py-3 px-4 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl gold-gradient-bg text-black font-extrabold text-xs shadow-lg shadow-[#D4AF37]/20 hover:scale-105 transition-all cursor-pointer"
              >
                Desbloquear Galería Privada
              </button>
            </form>

            <p className="text-[11px] text-gray-500 font-mono">
              💡 Tip de prueba: Ingresa <strong className="text-[#D4AF37]">1234</strong> para ver la entrega simulada.
            </p>
          </div>
        ) : (
          /* UNLOCKED CLIENT GALLERY DELIVERY VIEW */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-mono font-bold">
                  GALERÍA PRIVADA DE ENTREGA HD
                </span>
                <h3 className="text-2xl font-bold font-serif-luxury text-white">
                  Boda de Valeria & Carlos — Hacienda San José
                </h3>
                <p className="text-xs text-gray-400">
                  450 fotografías entregadas | Galería activa por 365 días
                </p>
              </div>

              <button
                onClick={() =>
                  onShowToast('Descarga ZIP Iniciada', 'Descargando paquete completo de 450 fotos en HD (4.2 GB).')
                }
                className="px-4 py-2.5 rounded-xl gold-gradient-bg text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#D4AF37]/20 cursor-pointer self-start sm:self-auto"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Todo (ZIP - 4.2 GB)</span>
              </button>
            </div>

            {/* Photo Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {GALLERY_IMAGES.slice(0, 6).map((img) => {
                const isFav = clientFavorites.includes(img.id);
                return (
                  <div key={img.id} className="relative group rounded-xl overflow-hidden bg-[#0B0F17] border border-white/10">
                    <img src={img.url} alt={img.title} className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        onClick={() => toggleClientFav(img.id)}
                        className={`p-2 rounded-lg backdrop-blur-md cursor-pointer ${
                          isFav ? 'bg-rose-500 text-white' : 'bg-white/20 text-white'
                        }`}
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>

                      <button
                        onClick={() =>
                          onShowToast('Descarga HD', `Descargando foto "${img.title}" en resolución original.`)
                        }
                        className="p-2 rounded-lg bg-[#D4AF37] text-black cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
