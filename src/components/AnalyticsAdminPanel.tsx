import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Eye,
  Globe2,
  Link2,
  Loader2,
  MessageCircle,
  MonitorSmartphone,
  RefreshCw,
  Search,
  Target,
  Users,
} from 'lucide-react';
import {
  AdminAnalytics,
  AdminSession,
  AnalyticsBreakdownRow,
  loadAdminAnalytics,
} from '../utils/adminApi';

interface Props {
  session: AdminSession;
}

type Period = 7 | 30 | 90;

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
];

const EVENT_LABELS: Record<string, string> = {
  bodas: 'Bodas',
  'xv-anos': 'XV años',
  bautizos: 'Bautizos y familia',
  retratos: 'Retratos',
  empresarial: 'Empresarial',
  'sin-especificar': 'Sin especificar',
};

const COUNTRY_LABELS: Record<string, string> = {
  MX: 'México',
  US: 'Estados Unidos',
  CA: 'Canadá',
  ES: 'España',
};

const numericValue = (row: AnalyticsBreakdownRow, keys: string[]) => {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return Math.max(0, value);
  }
  return 0;
};

const textValue = (row: AnalyticsBreakdownRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const rowCount = (row: AnalyticsBreakdownRow) => numericValue(row, ['pageviews', 'count', 'visitors']);

const formatNumber = (value: number) => new Intl.NumberFormat('es-MX').format(value || 0);

const formatDate = (value: string) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(timestamp);
};

const BreakdownList: React.FC<{
  rows: AnalyticsBreakdownRow[];
  keys: string[];
  empty: string;
  labelMap?: Record<string, string>;
  fallback?: string;
}> = ({ rows, keys, empty, labelMap, fallback = 'Directo / sin dato' }) => {
  const normalized = rows
    .map((row) => {
      const rawLabel = textValue(row, keys);
      return { label: labelMap?.[rawLabel] || rawLabel || fallback, count: rowCount(row) };
    })
    .filter((row) => row.count > 0)
    .slice(0, 8);
  const max = Math.max(1, ...normalized.map((row) => row.count));

  if (!normalized.length) return <p className="text-sm text-gray-500 py-8 text-center">{empty}</p>;

  return (
    <div className="space-y-3">
      {normalized.map((row) => (
        <div key={`${row.label}-${row.count}`} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-gray-300 truncate" title={row.label}>{row.label}</span>
            <span className="font-mono text-white">{formatNumber(row.count)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D76E]" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const AnalyticsAdminPanel: React.FC<Props> = ({ session }) => {
  const [period, setPeriod] = useState<Period>(30);
  const [reloadKey, setReloadKey] = useState(0);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    loadAdminAnalytics(session, period)
      .then((data) => {
        if (mounted) setAnalytics(data);
      })
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la analítica.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [period, reloadKey, session]);

  const trend = useMemo(() => {
    if (!analytics) return [];
    const leads = new Map(analytics.leadsByDay.map((row) => [row.date, row.count]));
    return analytics.trends.map((row) => {
      const rawDate = textValue(row, ['timestamp', 'day', 'date']);
      const date = rawDate.slice(0, 10);
      return {
        date,
        label: formatDate(rawDate),
        pageviews: rowCount(row),
        visitors: numericValue(row, ['visitors']),
        leads: leads.get(date) || 0,
      };
    });
  }, [analytics]);

  const trendMax = Math.max(1, ...trend.map((row) => Math.max(row.pageviews, row.visitors)));
  const dateCaption = analytics
    ? `${formatDate(analytics.range.since)} – ${formatDate(analytics.range.until)}`
    : '';

  if (loading && !analytics) {
    return <section className="min-h-[420px] rounded-2xl bg-[#161C28] border border-white/10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></section>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#D4AF37]"><BarChart3 className="w-5 h-5" /><span className="text-xs uppercase tracking-widest font-mono">Seguimiento del sitio</span></div>
          <h2 className="text-2xl font-bold mt-2">Visitas, origen y conversión</h2>
          <p className="text-sm text-gray-400 mt-1">Datos desde que se activó Web Analytics. Las cotizaciones se toman de tu registro actual.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((item) => <button key={item.value} type="button" onClick={() => setPeriod(item.value)} className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${period === item.value ? 'bg-[#D4AF37] text-black' : 'bg-[#161C28] border border-white/10 text-gray-300'}`}>{item.label}</button>)}
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="px-3.5 py-2 rounded-xl border border-white/10 text-xs text-gray-300 flex items-center gap-2"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
      {analytics?.message && <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{analytics.message}</div>}

      {!analytics?.connected && (
        <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/8 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div><p className="font-semibold text-white">Web Analytics ya está activo</p><p className="text-sm text-gray-300 mt-1">La recolección comenzó hoy. La conexión privada de lectura se terminará antes de publicar esta pestaña.</p></div>
          <a href="https://vercel.com/ejeanaliticos-projects/xavi-ph1/analytics" target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm flex items-center justify-center gap-2">Abrir fuente de datos<ExternalLink className="w-4 h-4" /></a>
        </div>
      )}

      {analytics && (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Personas', value: analytics.totals.visitors, suffix: '', icon: Users, note: 'Visitantes únicos' },
              { label: 'Vistas', value: analytics.totals.pageviews, suffix: '', icon: Eye, note: 'Páginas consultadas' },
              { label: 'Cotizaciones', value: analytics.totals.leads, suffix: '', icon: MessageCircle, note: 'Solicitudes registradas' },
              { label: 'Match', value: analytics.totals.conversionRate, suffix: '%', icon: Target, note: 'Cotizaciones ÷ personas' },
            ].map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl bg-[#161C28] border border-white/10 p-5"><div className="flex items-center justify-between"><p className="text-xs text-gray-400 uppercase tracking-wider">{card.label}</p><Icon className="w-5 h-5 text-[#D4AF37]" /></div><p className="text-3xl font-black mt-3 font-mono">{formatNumber(card.value)}{card.suffix}</p><p className="text-[11px] text-gray-500 mt-2">{card.note}</p></article>; })}
          </div>

          <article className="rounded-2xl bg-[#161C28] border border-white/10 p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Actividad diaria</h3><p className="text-xs text-gray-500 mt-1">{dateCaption}</p></div><div className="flex gap-3 text-[10px] text-gray-400"><span><i className="inline-block w-2 h-2 rounded-full bg-[#D4AF37] mr-1" />Vistas</span><span><i className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />Personas</span></div></div>
            {trend.length ? (
              <div className="overflow-x-auto pb-2">
                <div className="h-52 flex items-end gap-2 min-w-[620px] border-b border-white/10">
                  {trend.map((row) => (
                    <div key={row.date || row.label} className="h-full flex-1 min-w-3 flex flex-col items-center justify-end gap-1 group" title={`${row.label}: ${row.pageviews} vistas, ${row.visitors} personas, ${row.leads} cotizaciones`}>
                      <div className="w-full flex items-end justify-center gap-0.5 h-[172px]">
                        <div className="w-[42%] rounded-t bg-[#D4AF37] min-h-0.5" style={{ height: `${Math.max(2, (row.pageviews / trendMax) * 100)}%` }} />
                        <div className="w-[42%] rounded-t bg-emerald-400 min-h-0.5" style={{ height: `${Math.max(2, (row.visitors / trendMax) * 100)}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-600 whitespace-nowrap">{row.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-gray-500 py-16 text-center">Los primeros datos aparecerán después de las visitas al nuevo despliegue.</p>}
          </article>

          <div className="grid lg:grid-cols-2 gap-5">
            <article className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4"><h3 className="font-bold flex items-center gap-2"><Link2 className="w-4 h-4 text-[#D4AF37]" />De dónde llegan</h3><BreakdownList rows={analytics.referrers} keys={['referrerHostname']} empty="Todavía no hay referidos registrados." /></article>
            <article className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4"><h3 className="font-bold flex items-center gap-2"><Globe2 className="w-4 h-4 text-[#D4AF37]" />Países</h3><BreakdownList rows={analytics.countries} keys={['country']} labelMap={COUNTRY_LABELS} empty="Todavía no hay ubicaciones registradas." fallback="Sin país" /></article>
            <article className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4"><h3 className="font-bold flex items-center gap-2"><Eye className="w-4 h-4 text-[#D4AF37]" />Páginas más vistas</h3><BreakdownList rows={analytics.pages} keys={['requestPath', 'route']} empty="Todavía no hay páginas registradas." fallback="/" /></article>
            <article className="rounded-2xl bg-[#161C28] border border-white/10 p-5 space-y-4"><h3 className="font-bold flex items-center gap-2"><MonitorSmartphone className="w-4 h-4 text-[#D4AF37]" />Dispositivos</h3><BreakdownList rows={analytics.devices} keys={['deviceType']} empty="Todavía no hay dispositivos registrados." fallback="Sin dato" /></article>
          </div>

          <article className="rounded-2xl bg-[#161C28] border border-white/10 p-5 sm:p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Target className="w-4 h-4 text-[#D4AF37]" />Solicitudes por servicio</h3>
            {analytics.leadsByService.length ? <BreakdownList rows={analytics.leadsByService} keys={['label']} labelMap={EVENT_LABELS} empty="Todavía no hay solicitudes en este periodo." /> : <p className="text-sm text-gray-500 py-6 text-center">Todavía no hay solicitudes en este periodo.</p>}
          </article>
        </>
      )}

      <article className="rounded-2xl bg-[#161C28] border border-white/10 p-5 sm:p-6 space-y-5">
        <div><h3 className="font-bold flex items-center gap-2"><Search className="w-4 h-4 text-[#D4AF37]" />Posicionamiento en Google</h3><p className="text-sm text-gray-400 mt-1">Objetivos locales con mayor intención de contratación; la posición cambia por zona, dispositivo y competencia.</p></div>
        <div className="flex flex-wrap gap-2">{['fotografía y video CDMX', 'fotógrafo de bodas CDMX', 'foto y video para XV años CDMX', 'fotografía de eventos CDMX', 'fotografía empresarial CDMX'].map((keyword) => <span key={keyword} className="px-3 py-2 rounded-full bg-[#0B0F17] border border-white/10 text-xs text-gray-300">{keyword}</span>)}</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {['Sitio encontrado por Google', 'URLs limpias por servicio', 'Sitemap y robots publicados', 'Datos estructurados del negocio'].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl bg-[#0B0F17]/70 border border-white/10 p-3 text-xs text-gray-300"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />{item}</div>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="https://search.google.com/search-console?resource_id=sc-domain%3Axaviph.com" target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center gap-2">Abrir Google Search Console<ExternalLink className="w-3.5 h-3.5" /></a>
          <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center gap-2">Ver sitemap<ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      </article>
    </section>
  );
};
