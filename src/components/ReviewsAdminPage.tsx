import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ClipboardCopy, Link2, Loader2, LogIn, LogOut, RefreshCw, Star } from 'lucide-react';
import { AdminSession, adminLogin, adminLogout, resumeAdminSession } from '../utils/adminApi';

type AdminReview = {
  id: string;
  name: string;
  eventType?: string;
  rating: number;
  comment: string;
  status: string;
  approved: boolean;
  createdAt?: string;
};

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-1" aria-label={`${rating} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map((value) => (
      <Star key={value} className={`h-4 w-4 ${value <= Math.round(rating) ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-white/20'}`} />
    ))}
  </div>
);

export const ReviewsAdminPage: React.FC = () => {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');

  const loadReviews = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/review-admin', { credentials: 'include', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status !== 'success') throw new Error(data?.message || 'No se pudieron cargar las reseñas.');
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar las reseñas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    resumeAdminSession()
      .then((restored) => {
        if (!active) return;
        setSession(restored?.role === 'SUPER_ADMIN' ? restored : null);
        if (restored?.role === 'SUPER_ADMIN') loadReviews();
      })
      .catch(() => active && setSession(null))
      .finally(() => active && setCheckingSession(false));
    return () => { active = false; };
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      const next = await adminLogin(email, password);
      if (next.role !== 'SUPER_ADMIN') throw new Error('Solo el Super Admin puede administrar reseñas.');
      setSession(next);
      setPassword('');
      await loadReviews();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await adminLogout().catch(() => null);
    setSession(null);
  };

  const createLink = async () => {
    setLinkLoading(true);
    setCopied(false);
    setMessage('');
    try {
      const response = await fetch('/api/review-admin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status !== 'success' || !data.url) throw new Error(data?.message || 'No se pudo generar la liga.');
      setInviteUrl(String(data.url));
      setExpiresAt(String(data.expiresAt || ''));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo generar la liga.');
    } finally {
      setLinkLoading(false);
    }
  };

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (_) {
      setMessage('No se pudo copiar automáticamente. Selecciona la liga y cópiala manualmente.');
    }
  };

  const average = useMemo(() => reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    : 0, [reviews]);

  if (checkingSession) {
    return <main className="grid min-h-screen place-items-center bg-[#0B0F17] text-white"><Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" /></main>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#0B0F17] px-4 py-12 text-white">
        <form onSubmit={login} className="mx-auto max-w-md rounded-3xl border border-white/10 bg-[#161C28] p-6 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#D4AF37]">Administrador XPH</p>
          <h1 className="mt-2 text-2xl font-bold">Reseñas</h1>
          <p className="mt-2 text-sm text-white/50">Inicia sesión para generar ligas y consultar comentarios.</p>
          <div className="mt-6 space-y-4">
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Correo" className="w-full rounded-xl border border-white/10 bg-[#0B0F17] px-4 py-3 text-sm outline-none focus:border-[#D4AF37]/60" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Contraseña" className="w-full rounded-xl border border-white/10 bg-[#0B0F17] px-4 py-3 text-sm outline-none focus:border-[#D4AF37]/60" />
            {authError ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">{authError}</p> : null}
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 font-bold text-black disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}Entrar</button>
            <a href="/?xph-admin=panel" className="block text-center text-xs text-white/40">Volver al administrador</a>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F17] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#D4AF37]">Administrador XPH</p>
            <h1 className="mt-1 text-3xl font-bold">Reseñas de clientes</h1>
            <p className="mt-2 text-sm text-white/50">Genera la liga que enviarás al cliente y revisa las opiniones publicadas automáticamente.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/?xph-admin=panel" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm"><ArrowLeft className="h-4 w-4" />Administrador</a>
            <button onClick={loadReviews} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200"><LogOut className="h-4 w-4" />Cerrar sesión</button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#161C28] p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37]"><Link2 className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-bold">Liga para solicitar una reseña</h2>
                <p className="mt-1 text-sm leading-6 text-white/50">Genera una liga nueva cuando vayas a enviársela a un cliente. Cada liga tiene vigencia de 30 días.</p>
              </div>
            </div>

            <button onClick={createLink} disabled={linkLoading} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-bold text-black disabled:opacity-50">{linkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}Generar liga</button>

            {inviteUrl ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-[#0B0F17] p-4">
                <label className="text-xs font-bold uppercase tracking-wider text-white/40">Liga lista para enviar</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-xs text-white/75" />
                  <button onClick={copyLink} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2.5 text-sm font-semibold text-[#F5D76E]">{copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}{copied ? 'Copiada' : 'Copiar liga'}</button>
                </div>
                {expiresAt ? <p className="mt-2 text-xs text-white/35">Vigente hasta {new Date(expiresAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}.</p> : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#161C28] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Resumen</p>
            <p className="mt-3 text-4xl font-bold">{reviews.length}</p>
            <p className="text-sm text-white/45">reseñas registradas</p>
            <div className="mt-5 flex items-center gap-3"><Stars rating={average} /><span className="text-sm text-white/60">{average ? average.toFixed(1) : '0.0'} / 5</span></div>
            <p className="mt-4 text-xs leading-5 text-emerald-300/80">Las nuevas reseñas se publican automáticamente en la página.</p>
          </div>
        </section>

        {message ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{message}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-[#161C28] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="text-xl font-bold">Comentarios recibidos</h2><p className="mt-1 text-sm text-white/45">Los más recientes aparecen primero.</p></div>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" /> : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-white/10 bg-[#0B0F17]/75 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-bold">{review.name}</p><p className="mt-1 text-xs text-white/40">{review.eventType || 'Evento XPH'}{review.createdAt ? ` · ${new Date(review.createdAt).toLocaleDateString('es-MX')}` : ''}</p></div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Publicada</span>
                </div>
                <div className="mt-3"><Stars rating={review.rating} /></div>
                <p className="mt-4 text-sm leading-6 text-white/70">{review.comment}</p>
              </article>
            ))}
          </div>

          {!loading && !reviews.length ? <div className="py-14 text-center text-sm text-white/40">Aún no hay reseñas. Genera una liga y envíasela a tu cliente cuando quieras solicitar la primera.</div> : null}
        </section>
      </div>
    </main>
  );
};
