import { useEffect } from 'react';
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

  return null;
};
