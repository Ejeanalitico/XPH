import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { PromotionPopupConfig } from '../promotion';

interface PromotionPopupProps {
  config: PromotionPopupConfig | null;
}

const isDateActive = (config: PromotionPopupConfig) => {
  const today = new Date();
  const start = config.validFrom ? new Date(`${config.validFrom}T00:00:00`) : null;
  const end = config.validUntil ? new Date(`${config.validUntil}T23:59:59`) : null;
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
};

export const PromotionPopup: React.FC<PromotionPopupProps> = ({ config }) => {
  const [open, setOpen] = useState(false);

  const storageKey = useMemo(() => {
    if (!config) return '';
    return `xph-promo-closed-${config.updatedAt || `${config.title}-${config.validUntil || ''}`}`;
  }, [config]);

  useEffect(() => {
    if (!config?.enabled || !isDateActive(config)) {
      setOpen(false);
      return;
    }

    const hasContent = Boolean(
      (config.mode !== 'image' && (config.title.trim() || config.text.trim())) ||
      (config.mode !== 'text' && config.imageUrl.trim())
    );
    if (!hasContent) {
      setOpen(false);
      return;
    }

    try {
      if (storageKey && sessionStorage.getItem(storageKey) === '1') return;
    } catch (_) {}

    const timer = window.setTimeout(() => setOpen(true), 650);
    return () => window.clearTimeout(timer);
  }, [config, storageKey]);

  if (!config || !open) return null;

  const close = () => {
    setOpen(false);
    try {
      if (storageKey) sessionStorage.setItem(storageKey, '1');
    } catch (_) {}
  };

  const showText = config.mode === 'text' || config.mode === 'both';
  const showImage = config.mode === 'image' || config.mode === 'both';

  return (
    <div className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center" onClick={close}>
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-[#111722] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/70 border border-white/15 text-white flex items-center justify-center"
          aria-label="Cerrar promoción"
        >
          <X className="w-4 h-4" />
        </button>

        {showImage && config.imageUrl && (
          <img src={config.imageUrl} alt={config.title || 'Promoción XPH'} className="w-full max-h-[60vh] object-contain bg-black" />
        )}

        {showText && (
          <div className="p-6 sm:p-7">
            {config.title && <h2 className="text-2xl sm:text-3xl font-bold font-serif-luxury text-white pr-8">{config.title}</h2>}
            {config.text && <p className="mt-3 text-sm sm:text-base leading-relaxed text-gray-300 whitespace-pre-line">{config.text}</p>}
            {config.ctaText && config.ctaUrl && (
              <a
                href={config.ctaUrl}
                target={config.ctaUrl.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl gold-gradient-bg text-black font-extrabold text-sm"
              >
                {config.ctaText}<ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
