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

  useEffect(() => {
    const REVIEW_ENTRY_ID = 'xph-admin-reviews-menu-entry';

    const addReviewsToMenu = () => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Áreas del administrador"]');
      if (!nav || nav.querySelector(`#${REVIEW_ENTRY_ID}`)) return;

      const section = document.createElement('section');
      section.id = REVIEW_ENTRY_ID;
      section.className = 'overflow-hidden rounded-xl border border-white/5';

      const link = document.createElement('a');
      link.href = '/?xph-admin=resenas';
      link.className = 'flex w-full items-start gap-3 bg-white/[0.02] px-4 py-3 text-left text-gray-300 hover:bg-white/5';
      link.setAttribute('aria-label', 'Abrir reseñas de clientes');

      const icon = document.createElement('span');
      icon.className = 'mt-0.5 grid h-5 w-5 shrink-0 place-items-center text-[#D4AF37]';
      icon.textContent = '★';

      const text = document.createElement('span');
      text.className = 'min-w-0 flex-1';

      const title = document.createElement('strong');
      title.className = 'block text-sm';
      title.textContent = 'Reseñas';

      const description = document.createElement('span');
      description.className = 'mt-1 block text-xs leading-5 text-gray-500';
      description.textContent = 'Generar ligas y consultar opiniones de clientes';

      const arrow = document.createElement('span');
      arrow.className = 'mt-1 shrink-0 text-sm text-gray-500';
      arrow.textContent = '›';

      text.append(title, description);
      link.append(icon, text, arrow);
      section.append(link);
      nav.append(section);
    };

    addReviewsToMenu();
    const observer = new MutationObserver(addReviewsToMenu);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.getElementById(REVIEW_ENTRY_ID)?.remove();
    };
  }, []);

  return null;
};
