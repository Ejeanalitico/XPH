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

const ReviewStars: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-1" aria-label={`${rating} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map((value) => (
      <Star key={value} className={`h-4 w-4 ${value <= Math.round(rating) ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-white/20'}`} />
    ))}
  </div>
);

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const TestimonialsSection: React.FC = () => {
  const [reviews, setReviews] = useState<PublicReview[]>([]);

  useEffect(() => {
    let active = true;

    const loadReviews = async () => {
      for (let index = 0; index < RETRY_DELAYS_MS.length && active; index += 1) {
        if (RETRY_DELAYS_MS[index]) await wait(RETRY_DELAYS_MS[index]);
        if (!active) return;

        try {
          const response = await fetch(`/api/public-reviews?_t=${Date.now()}`, { cache: 'no-store' });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data?.status !== 'success' || !Array.isArray(data?.reviews)) {
            throw new Error(data?.message || 'No se pudieron cargar las reseñas.');
          }
          if (active) setReviews(data.reviews);
          return;
        } catch (_) {
          if (index === RETRY_DELAYS_MS.length - 1 && active) setReviews([]);
        }
      }
    };

    loadReviews();
    return () => { active = false; };
  }, []);

  const visibleReviews = useMemo(() => reviews.slice(0, 9), [reviews]);
  if (!visibleReviews.length) return null;

  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    : 0;

  return (
    <section id="resenas" className="border-y border-white/5 bg-[#0E141F] px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-9 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#D4AF37]">Experiencias XPH</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Lo que dicen nuestros clientes</h2>
          <div className="mt-4 flex items-center justify-center gap-3 text-sm text-white/60">
            <ReviewStars rating={average} />
            <span>{average.toFixed(1)} de 5 · {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleReviews.map((review) => (
            <article key={review.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-xl shadow-black/10">
              <div className="flex items-start justify-between gap-4">
                <ReviewStars rating={review.rating} />
                <MessageSquareQuote className="h-6 w-6 shrink-0 text-[#D4AF37]/60" />
              </div>
              <p className="mt-5 text-sm leading-7 text-white/75">“{review.comment}”</p>
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="text-sm font-bold text-white">{review.name}</p>
                {review.eventType ? <p className="mt-1 text-xs text-white/40">{review.eventType}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
