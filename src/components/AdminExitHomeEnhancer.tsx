import { useEffect } from 'react';
import { Star } from 'lucide-react';
import { adminLogout } from '../utils/adminApi';

export const AdminExitHomeEnhancer = () => {
  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button || !button.textContent?.includes('Cerrar sesión')) return;

      event.preventDefault();
      event.stopPropagation();
      setTimeout(async () => {
        try { await adminLogout(); } catch (_) {}
        window.location.assign('/');
      }, 0);
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return (
    <a
      href="/?xph-admin=resenas"
      className="fixed bottom-5 left-5 z-[130] inline-flex items-center gap-2 rounded-2xl border border-[#D4AF37]/35 bg-[#161C28]/95 px-4 py-3 text-sm font-semibold text-[#F5D76E] shadow-2xl shadow-black/40 backdrop-blur hover:bg-[#1B2230]"
      aria-label="Abrir reseñas de clientes"
    >
      <Star className="h-4 w-4 fill-[#D4AF37] text-[#D4AF37]" />
      Reseñas
    </a>
  );
};
