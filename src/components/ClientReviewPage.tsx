import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, Loader2, Send, ShieldCheck, Star } from 'lucide-react';

type Props = { token: string };
type ReviewForm = { name: string; rating: number; comment: string };
const EMPTY_FORM: ReviewForm = { name: '', rating: 0, comment: '' };

const RatingField: React.FC<{ value: number; onChange: (value: number) => void }> = ({ value, onChange }) => (
  <fieldset className="space-y-3">
    <legend className="text-sm font-semibold text-white">¿Cómo calificarías tu experiencia con XPH?</legend>
    <div className="flex gap-2" aria-label="Calificación general">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button key={rating} type="button" aria-label={`${rating} de 5 estrellas`} aria-pressed={value === rating} onClick={() => onChange(rating)} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-[#d4af37]/60 hover:bg-[#d4af37]/10 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/60">
          <Star className={`h-7 w-7 ${rating <= value ? 'fill-[#d4af37] text-[#d4af37]' : 'text-white/35'}`} />
        </button>
      ))}
    </div>
    <p className="text-xs text-white/50">{value ? `${value} de 5 estrellas` : 'Selecciona una calificación'}</p>
  </fieldset>
);

export const ClientReviewPage: React.FC<Props> = ({ token }) => {
  const [form, setForm] = useState<ReviewForm>(EMPTY_FORM);
  const [checking, setChecking] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [eventType, setEventType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => form.name.trim().length >= 2 && form.rating >= 1 && form.comment.trim().length >= 10, [form]);

  useEffect(() => {
    let active = true;
    const validate = async () => {
      setChecking(true);
      setError('');
      try {
        const response = await fetch(`/api/reviews?token=${encodeURIComponent(token)}`, { method: 'GET', cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        setValidLink(Boolean(response.ok && data?.status === 'success'));
        setEventType(String(data?.eventType || ''));
        if (!response.ok) setError(data?.message || 'La liga no es válida o ya no está disponible.');
      } catch (_) {
        if (active) setError('No pudimos validar la liga en este momento.');
      } finally {
        if (active) setChecking(false);
      }
    };
    validate();
    return () => { active = false; };
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: form.name, rating: form.rating, comment: form.comment }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status !== 'success') throw new Error(data?.message || 'No se pudo guardar tu opinión.');
      setSubmitted(true);
      setForm(EMPTY_FORM);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar tu opinión.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d4af37]/35 bg-[#d4af37]/10 shadow-[0_0_50px_rgba(212,175,55,0.12)]"><Camera className="h-8 w-8 text-[#d4af37]" /></div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#d4af37]">XPH Producción Audiovisual</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Cuéntanos cómo fue tu experiencia</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/60 sm:text-base">Tu opinión nos ayuda a mejorar el servicio y la calidad de cada entrega.</p>
          {eventType ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/35">{eventType}</p> : null}
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
          {checking ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-white/70"><Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" /><p>Validando tu invitación…</p></div>
          ) : !validLink ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center"><ShieldCheck className="mb-4 h-10 w-10 text-white/35" /><h2 className="text-xl font-semibold">Esta liga no está disponible</h2><p className="mt-2 max-w-md text-sm leading-6 text-white/55">{error || 'Solicita a XPH una nueva liga para dejar tu opinión.'}</p></div>
          ) : submitted ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center"><CheckCircle2 className="mb-5 h-14 w-14 text-[#d4af37]" /><h2 className="text-2xl font-semibold">Gracias por compartir tu experiencia</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/60">Tu comentario quedó publicado correctamente.</p></div>
          ) : (
            <form onSubmit={submit} className="space-y-7">
              <label className="block space-y-2 text-sm font-semibold text-white">Nombre<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={80} autoComplete="name" placeholder="Tu nombre" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#d4af37]/60 focus:ring-2 focus:ring-[#d4af37]/15" /></label>

              <div className="border-y border-white/10 py-7"><RatingField value={form.rating} onChange={(rating) => setForm((current) => ({ ...current, rating }))} /></div>

              <label className="block space-y-2 text-sm font-semibold text-white">Cuéntanos qué te pareció<textarea value={form.comment} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} maxLength={1500} rows={6} placeholder="Puedes contarnos qué te gustó del servicio, la atención, la cobertura y el resultado final." className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/30 focus:border-[#d4af37]/60 focus:ring-2 focus:ring-[#d4af37]/15" /><span className="block text-right text-xs font-normal text-white/35">{form.comment.length}/1500</span></label>

              {error ? <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

              <button type="submit" disabled={!canSubmit || submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d4af37] px-5 py-3.5 text-sm font-bold text-black transition hover:bg-[#e0bf4c] disabled:cursor-not-allowed disabled:opacity-40">{submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{submitting ? 'Publicando opinión…' : 'Enviar mi opinión'}</button>
            </form>
          )}
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-white/35">Esta página solo puede abrirse con una invitación válida de XPH.</p>
      </div>
    </main>
  );
};
