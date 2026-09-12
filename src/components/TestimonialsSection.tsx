import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquareQuote, Star } from 'lucide-react';

type PublicReview = {
  id: string;
  name: string;
  eventType?: string;
  rating: number;
  comment: string;
  createdAt?: string;
};

const RETRY_DELAYS_MS = [0, 900, 2500, 5000];
const REVIEW_CACHE_KEY = 'xph-public-reviews-v1';
const REVIEW_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const ReviewStars: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-1" aria-label={`${rating} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map((value) => (
      <Star key={value} className={`h-4 w-4 ${value <= Math.round(rating) ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-white/20'}`} />
    ))}
  </div>
);

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const sanitizeReviews = (value: unknown): PublicReview[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      id: String(item?.id || ''),
      name: String(item?.name || 'Cliente XPH'),
      eventType: String(item?.eventType || ''),
      rating: Number(item?.rating || 0),
      comment: String(item?.comment || ''),
      createdAt: String(item?.createdAt || ''),
    }))
    .filter((item) => item.id && item.comment && item.rating >= 1 && item.rating <= 5);
};

const readCachedReviews = (): PublicReview[] => {
  try {
    const raw = window.localStorage.getItem(REVIEW_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.savedAt || 0) > REVIEW_CACHE_MAX_AGE_MS) return [];
    return sanitizeReviews(parsed.reviews);
  } catch (_) {
    return [];
  }
};

const writeCachedReviews = (reviews: PublicReview[]) => {
  if (!reviews.length) return;
  try {
    window.localStorage.setItem(REVIEW_CACHE_KEY, JSON.stringify({ reviews, savedAt: Date.now() }));
  } catch (_) {
    // localStorage can be unavailable in restrictive/private browser modes.
  }
};

export const TestimonialsSection: React.FC = () => {
  const [reviews, setReviews] = useState<PublicReview[]>(() => readCachedReviews());
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let delayedRetry: number | undefined;

    const loadReviews = async () => {
      setLoading(true);
      setLoadFailed(false);

      for (let index = 0; index < RETRY_DELAYS_MS.length && active; index += 1) {
        if (RETRY_DELAYS_MS[index]) await wait(RETRY_DELAYS_MS[index]);
        if (!active) return;

        try {
          const response = await fetch(`/api/public-reviews?_t=${Date.now()}`, { cache: 'no-store' });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data?.status !== 'success' || !Array.isArray(data?.reviews)) {
            throw new Error(data?.message || 'No se pudieron cargar las reseñas.');
          }

          const incoming = sanitizeReviews(data.reviews);
          if (incoming.length) {
            if (!active) return;
            setReviews(incoming);
            writeCachedReviews(incoming);
            setLoading(false);
            setLoadFailed(false);
            return;
          }

          // An empty response can be transient while Apps Script wakes up.
          // Keep the section in place and try again instead of disappearing on mobile.
          if (index < RETRY_DELAYS_MS.length - 1) continue;
          if (!active) return;
          setLoading(false);
          setLoadFailed(true);
        } catch (_) {
          if (index === RETRY_DELAYS_MS.length - 1 && active) {
            setLoading(false);
            setLoadFailed(true);
          }
        }
      }

      if (active && !reviews.length) {
        delayedRetry = window.setTimeout(() => {
          if (active) loadReviews();
        }, 15000);
      }
    };

    loadReviews();
    return () => {
      active = false;
      if (delayedRetry) window.clearTimeout(delayedRetry);
    };
  }, []);

  const visibleReviews = useMemo(() => reviews.slice(0, 9), [reviews]);
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    : 0;

  // Always reserve this area while the mobile request is loading. Previously the
  // component returned null, so users who reached the footer before the request
  // finished never saw the section appear above their current scroll position.
  return (
    <section id="resenas" className="min-h-[360px] border-y border-white/5 bg-[#0E141F] px-4 py-14 sm:min-h-0 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-9 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#D4AF37]">Experiencias XPH</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Lo que dicen nuestros clientes</h2>
          {reviews.length ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-white/60">
              <ReviewStars rating={average} />
              <span>{average.toFixed(1)} de 5 · {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}</span>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/50">{loadFailed ? 'Actualizando reseñas…' : 'Cargando reseñas…'}</p>
          )}
        </div>

        {visibleReviews.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleReviews.map((review) => (
              <article key={review.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-xl shadow-black/10">
                <div className="flex items-start justify-between gap-4">
                  <ReviewStars rating={review.rating} />
                  <MessageSquareQuote className="h-6 w-6 shrink-0 text-[#D4AF37]/60" />
                </div>
                <p className="mt-5 break-words text-sm leading-7 text-white/75">“{review.comment}”</p>
                <div className="mt-6 border-t border-white/10 pt-4">
                  <p className="break-words text-sm font-bold text-white">{review.name}</p>
                  {review.eventType ? <p className="mt-1 break-words text-xs text-white/40">{review.eventType}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
            {[1, 2, 3].map((item) => (
              <div key={item} className="min-h-40 animate-pulse rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                <div className="h-4 w-28 rounded-full bg-white/10" />
                <div className="mt-6 h-3 w-full rounded-full bg-white/10" />
                <div className="mt-3 h-3 w-4/5 rounded-full bg-white/10" />
                <div className="mt-8 h-3 w-32 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        )}

        {loading && reviews.length ? <p className="mt-5 text-center text-xs text-white/30">Actualizando reseñas…</p> : null}
      </div>
    </section>
  );
};
