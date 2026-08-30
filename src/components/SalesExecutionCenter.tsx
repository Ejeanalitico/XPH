import React, { memo, useMemo } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot, History, UserRoundCheck } from 'lucide-react';
import { BusinessSnapshot, CrmClient, CrmStatus } from '../types/business';

type Props = {
  snapshot: BusinessSnapshot;
  onOpenRecord: (client: CrmClient) => void;
  onOpenNotification: (notificationId: string) => void;
  onUpdateStage: (client: CrmClient, status: CrmStatus) => Promise<void>;
};

const dateOnly = (value?: string) => String(value || '').slice(0, 10);
const todayKey = () => new Date().toISOString().slice(0, 10);
const formatDateTime = (value?: string) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return raw || 'Sin fecha';
  const [, year, month, day, hour, minute] = match;
  if (!hour || !minute) return `${day}/${month}/${year}`;
  const hourNumber = Number(hour);
  return `${day}/${month}/${year} · ${hourNumber % 12 || 12}:${minute} ${hourNumber >= 12 ? 'p. m.' : 'a. m.'}`;
};

const stages: Array<{ label: string; statuses: CrmStatus[]; accent: string }> = [
  { label: 'Entrante', statuses: ['Nuevo'], accent: 'border-sky-400/40' },
  { label: 'Contactado', statuses: ['Contactado'], accent: 'border-cyan-400/40' },
  { label: 'Oferta enviada', statuses: ['Cotización enviada'], accent: 'border-violet-400/40' },
  { label: 'Seguimiento', statuses: ['Esperando respuesta', 'Seguimiento pendiente', 'Seguimiento'], accent: 'border-amber-300/40' },
  { label: 'Negociación', statuses: ['Interesado', 'Negociación', 'Por cerrar', 'Cierre prioritario'], accent: 'border-emerald-400/40' },
];

const selectableStatuses: CrmStatus[] = stages.flatMap((stage) => stage.statuses);

const SalesExecutionCenter = memo(({ snapshot, onOpenRecord, onOpenNotification, onUpdateStage }: Props) => {
  const data = useMemo(() => {
    const prospects = snapshot.clients.filter((client) => client.recordType === 'Prospecto' && !['Sin interés', 'No interesado', 'No responde', 'Archivado', 'Contratado'].includes(client.status));
    const currentDate = todayKey();
    const overdue = prospects.filter((client) => dateOnly(client.nextActionAt) && dateOnly(client.nextActionAt) < currentDate);
    const dueToday = prospects.filter((client) => dateOnly(client.nextActionAt) === currentDate);
    const withoutAction = prospects.filter((client) => !dateOnly(client.nextActionAt) || !String(client.nextAction || '').trim());
    const tasks = snapshot.notifications
      .filter((notification) => notification.status !== 'ANULADA' && notification.status !== 'RESUELTA')
      .map((notification) => ({
        id: notification.id,
        title: notification.title,
        detail: notification.message,
        dueAt: notification.dueAt,
        overdue: Boolean(dateOnly(notification.dueAt) && dateOnly(notification.dueAt) < currentDate),
      }))
      .slice(0, 12);
    const history = snapshot.followUps
      .slice()
      .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
      .slice(0, 12)
      .map((followUp) => ({
        id: followUp.id,
        client: snapshot.clients.find((client) => client.id === followUp.prospectId || client.id === followUp.clientId),
        title: followUp.result || followUp.conversation || 'Seguimiento registrado',
        occurredAt: followUp.occurredAt,
      }));
    return { prospects, overdue, dueToday, withoutAction, tasks, history };
  }, [snapshot.clients, snapshot.followUps, snapshot.notifications]);

  const resolved = snapshot.notifications.filter((notification) => notification.status === 'RESUELTA').length;
  const measurable = snapshot.notifications.filter((notification) => notification.status !== 'ANULADA').length;
  const completionRate = measurable ? Math.round((resolved / measurable) * 100) : 100;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#171D29] to-[#10151f] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">Ejecución comercial</p>
        <h3 className="mt-2 text-2xl font-bold text-white">Centro de ventas</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Cada prospecto conserva su etapa, próxima acción, responsable e historial. Abre una tarjeta para ejecutar el seguimiento desde su expediente.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ExecutionMetric label="Oportunidades activas" value={data.prospects.length} icon={CircleDot} tone="text-sky-300" />
        <ExecutionMetric label="Seguimientos de hoy" value={data.dueToday.length} icon={CalendarClock} tone="text-amber-200" />
        <ExecutionMetric label="Seguimientos vencidos" value={data.overdue.length} icon={AlertTriangle} tone="text-red-300" />
        <ExecutionMetric label="Sin próxima acción" value={data.withoutAction.length} icon={UserRoundCheck} tone="text-orange-300" />
        <ExecutionMetric label="Actividades resueltas" value={`${completionRate}%`} icon={CheckCircle2} tone="text-emerald-300" />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="font-semibold text-white">Embudo comercial</h3><p className="mt-1 text-xs text-gray-400">Las etapas se actualizan sobre el registro original.</p></div><span className="text-xs text-gray-500">{data.prospects.length} activas</span></div>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
          {stages.map((stage) => {
            const records = data.prospects.filter((client) => stage.statuses.includes(client.status));
            return <div key={stage.label} className={`min-w-0 rounded-2xl border ${stage.accent} bg-[#151B27] p-3`}>
              <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-semibold text-white">{stage.label}</h4><span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-300">{records.length}</span></div>
              <div className="space-y-2">
                {records.map((client) => {
                  const assignment = snapshot.assignments.find((item) => item.clientId === client.id && item.status === 'ACTIVA');
                  const user = assignment ? snapshot.users.find((item) => item.id === assignment.userId) : undefined;
                  const due = dateOnly(client.nextActionAt);
                  const isOverdue = Boolean(due && due < todayKey());
                  return <article key={client.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <button type="button" onClick={() => onOpenRecord(client)} className="block w-full text-left">
                      <strong className="block truncate text-sm text-white hover:text-[#F5D76E]">{client.name || 'Sin nombre'}</strong>
                      <span className="mt-1 block truncate text-xs text-gray-400">{client.eventType || 'Evento por confirmar'}</span>
                      <span className={`mt-3 block text-xs ${isOverdue ? 'font-semibold text-red-300' : 'text-amber-100'}`}>{client.nextAction || 'Sin próxima acción'}</span>
                      <span className="mt-1 block text-[11px] text-gray-500">{formatDateTime(client.nextActionAt)}</span>
                      <span className="mt-2 block truncate text-[11px] text-sky-200">{user?.displayName || user?.name || 'Sin responsable asignado'}</span>
                    </button>
                    <label className="mt-3 block text-[10px] uppercase tracking-wide text-gray-500">Mover etapa
                      <select value={client.status} onChange={(event) => onUpdateStage(client, event.target.value as CrmStatus)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0D121B] px-2 py-2 text-xs normal-case tracking-normal text-gray-200">
                        {selectableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>
                  </article>;
                })}
                {!records.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-gray-600">Sin prospectos</p>}
              </div>
            </div>;
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#161C28] p-4">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold text-white">Actividades por ejecutar</h3></div>
          <div className="mt-3 divide-y divide-white/10">
            {data.tasks.map((task) => <button key={task.id} type="button" onClick={() => onOpenNotification(task.id)} className="block w-full px-1 py-3 text-left hover:bg-white/[0.03]"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-white">{task.title}</strong><p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400">{task.detail}</p></div><span className={`shrink-0 text-[11px] ${task.overdue ? 'text-red-300' : 'text-amber-200'}`}>{formatDateTime(task.dueAt)}</span></div></button>)}
            {!data.tasks.length && <p className="py-8 text-center text-sm text-emerald-300">No hay actividades pendientes.</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#161C28] p-4">
          <div className="flex items-center gap-2"><History className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold text-white">Actividad reciente</h3></div>
          <div className="mt-3 divide-y divide-white/10">
            {data.history.map((item) => <button key={item.id} type="button" disabled={!item.client} onClick={() => item.client && onOpenRecord(item.client)} className="block w-full px-1 py-3 text-left hover:bg-white/[0.03] disabled:cursor-default"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-white">{item.client?.name || 'Registro histórico'}</strong><p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400">{item.title}</p></div><span className="shrink-0 text-[11px] text-gray-500">{formatDateTime(item.occurredAt)}</span></div></button>)}
            {!data.history.length && <p className="py-8 text-center text-sm text-gray-500">Aún no hay seguimientos registrados.</p>}
          </div>
        </section>
      </div>
    </div>
  );
});

SalesExecutionCenter.displayName = 'SalesExecutionCenter';

const ExecutionMetric = ({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: React.ElementType; tone: string }) => <article className="rounded-2xl border border-white/10 bg-[#161C28] p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs text-gray-400">{label}</span><Icon className={`h-4 w-4 ${tone}`} /></div><strong className={`mt-3 block text-2xl ${tone}`}>{value}</strong></article>;

export default SalesExecutionCenter;
