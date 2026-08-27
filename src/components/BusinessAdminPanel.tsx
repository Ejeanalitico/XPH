import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  CreditCard,
  Eye,
  FileSignature,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  Save,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  createContractSigningLink,
  cacheBusinessClients,
  convertProspectToClient,
  createCrmFollowUp,
  finalizeBusinessContract,
  loadBusinessClients,
  loadBusinessSnapshot,
  saveBusinessExpense,
  saveBusinessPayment,
  saveCrmClient,
  syncClientCalendar,
  saveOwnerSignature,
  uploadBusinessContract,
  adminContractPdfUrl,
} from '../utils/adminApi';
import {
  BusinessContract,
  BusinessExpense,
  BusinessPayment,
  BusinessSnapshot,
  CrmClient,
  CrmFollowUp,
  ExpenseCategory,
} from '../types/business';
import { SignaturePad } from './SignaturePad';

type BusinessTab = 'overview' | 'prospects' | 'clients' | 'calendar' | 'payments' | 'expenses' | 'contracts';

const emptySnapshot: BusinessSnapshot = { clients: [], followUps: [], expenses: [], payments: [], contracts: [], ownerSignatureConfigured: false };
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const dateValue = (value?: string) => String(value || '').slice(0, 10);
const timeValue = (value?: string) => /^\d{2}:\d{2}/.test(String(value || '')) ? String(value).slice(0, 5) : '';
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const localDateKey = (date: Date) => `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
const monthLabel = (date: Date) => new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(date);
const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

const blankClient = (): Partial<CrmClient> => ({
  recordType: 'Prospecto',
  name: '',
  phone: '',
  email: '',
  eventType: '',
  eventDate: '',
  eventLocation: '',
  packageName: '',
  totalAmount: 0,
  paidAmount: 0,
  status: 'Nuevo',
  source: '',
  firstContactAt: today(),
  lastContactAt: today(),
  nextAction: '',
  nextActionAt: '',
  notes: '',
  contractId: '',
  honoreeName: '',
  address: '',
  eventTime: '',
  serviceHours: 0,
  campaign: '',
  objection: '',
  followUpAttempts: 0,
  suggestedMessage: '',
  lossReason: '',
  estimatedCost: 0,
  allocatedAdCost: 0,
  preSessionApplies: false,
  preSessionDate: '',
  preSessionTime: '',
  preSessionLocation: '',
  inviteClientToCalendar: false,
});

const expenseCategories: ExpenseCategory[] = [
  'Equipo y fotografía',
  'Maquillaje e insumos',
  'Transporte',
  'Comida',
  'Gastos personales',
  'Publicidad',
  'Otros del negocio',
];

const blankExpense = (): Partial<BusinessExpense> => ({
  date: today(), category: 'Equipo y fotografía', subcategory: '', concept: '', supplier: '',
  paymentMethod: '', paymentStatus: 'Pagado', amount: 0, notes: '', relatedClientId: '',
  receiptReference: '', account: 'Banco',
});

const blankPayment = (clientId = '', contractId = ''): Partial<BusinessPayment> => ({
  clientId, contractId, date: today(), dueDate: '', installmentNumber: 1, percentage: 30,
  concept: 'Pago 1 de 3', plannedAmount: 0, receivedAmount: 0,
  status: 'Pendiente', method: '', reference: '', notes: '',
});

const expenseFingerprint = (expense: Partial<BusinessExpense>) => [
  expense.date,
  expense.category,
  expense.subcategory,
  expense.concept,
  expense.supplier,
  expense.paymentMethod,
  expense.paymentStatus,
  Number(expense.amount || 0).toFixed(2),
  expense.relatedClientId,
  expense.receiptReference,
  expense.account,
].map((value) => String(value || '').trim().toLocaleLowerCase('es-MX')).join('|');

interface Props {
  notify: (message: string) => void;
}

export const BusinessAdminPanel: React.FC<Props> = ({ notify }) => {
  const [tab, setTab] = useState<BusinessTab>('overview');
  const [snapshot, setSnapshot] = useState<BusinessSnapshot>(emptySnapshot);
  const [busy, setBusy] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showInlinePayment, setShowInlinePayment] = useState(false);
  const [clientDraft, setClientDraft] = useState<Partial<CrmClient>>(blankClient);
  const [expenseDraft, setExpenseDraft] = useState<Partial<BusinessExpense>>(blankExpense);
  const [paymentDraft, setPaymentDraft] = useState<Partial<BusinessPayment>>(blankPayment);
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null);
  const [contractDraft, setContractDraft] = useState({ clientId: '', folio: '', eventType: '', eventDate: '', file: null as File | null });
  const [latestLink, setLatestLink] = useState('');
  const [ownerSignature, setOwnerSignature] = useState('');
  const [query, setQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [expenseSuccess, setExpenseSuccess] = useState('');
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [followUpDraft, setFollowUpDraft] = useState<Partial<CrmFollowUp>>({ occurredAt: now(), conversation: '', result: '', nextAction: '', nextActionAt: '' });

  useEffect(() => {
    if (!expenseSuccess) return;
    const timeout = window.setTimeout(() => setExpenseSuccess(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [expenseSuccess]);

  const refresh = async () => {
    setBusy(true);
    try {
      const clients = await loadBusinessClients();
      setSnapshot((previous) => ({ ...previous, clients }));
      const complete = await loadBusinessSnapshot();
      cacheBusinessClients(complete.clients);
      setSnapshot(complete);
    } catch (error: any) {
      notify(error?.message || 'No se pudo cargar el control del negocio.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    const records = snapshot.clients.filter((client) => tab === 'prospects' ? client.recordType === 'Prospecto' : client.recordType === 'Cliente');
    if (!term) return records;
    return records.filter((client) => [client.name, client.phone, client.eventType, client.packageName, client.status]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [query, snapshot.clients, tab]);

  const totals = useMemo(() => snapshot.clients.reduce((acc, client) => {
    acc.sales += Number(client.totalAmount) || 0;
    acc.paid += Number(client.paidAmount) || 0;
    return acc;
  }, { sales: 0, paid: 0 }), [snapshot.clients]);

  const financials = useMemo(() => {
    const contractedClients = snapshot.clients.filter((client) => client.recordType === 'Cliente' || client.status === 'Contratado');
    const contracted = contractedClients.reduce((sum, client) => sum + (Number(client.totalAmount) || 0), 0);
    const collected = contractedClients.reduce((sum, client) => {
      const clientPayments = snapshot.payments.filter((payment) => payment.clientId === client.id);
      const liquidated = clientPayments.filter((payment) => payment.status === 'Liquidado').reduce((paymentSum, payment) => paymentSum + (Number(payment.receivedAmount) || 0), 0);
      return sum + Math.min(clientPayments.length ? liquidated : Number(client.paidAmount) || 0, Number(client.totalAmount) || 0);
    }, 0);
    const receivable = Math.max(0, contracted - collected);
    const paidExpenses = snapshot.expenses.filter((expense) => expense.paymentStatus === 'Pagado').reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    const pendingExpenses = snapshot.expenses.filter((expense) => expense.paymentStatus === 'Pendiente').reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    const advertising = snapshot.expenses.filter((expense) => expense.category === 'Publicidad').reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    const clientsFromAds = contractedClients.filter((client) => /facebook|instagram|meta|google|tiktok|publicidad|anuncio/i.test(`${client.source} ${client.campaign}`)).length;
    const productionCosts = contractedClients.reduce((sum, client) => sum + (Number(client.estimatedCost) || 0) + (Number(client.allocatedAdCost) || 0), 0);
    return {
      contracted,
      collected,
      receivable,
      paidExpenses,
      pendingExpenses,
      advertising,
      cac: clientsFromAds > 0 ? advertising / clientsFromAds : 0,
      clientsFromAds,
      netRegistered: collected - paidExpenses,
      projectedResult: contracted - paidExpenses - pendingExpenses - productionCosts,
    };
  }, [snapshot.clients, snapshot.expenses, snapshot.payments]);

  const paidForClient = (client: CrmClient) => {
    const clientPayments = snapshot.payments.filter((payment) => payment.clientId === client.id);
    return clientPayments.length
      ? clientPayments.filter((payment) => payment.status === 'Liquidado').reduce((sum, payment) => sum + Number(payment.receivedAmount || 0), 0)
      : Number(client.paidAmount || 0);
  };

  const duplicateExpenseIds = useMemo(() => {
    const groups = new Map<string, string[]>();
    snapshot.expenses.forEach((expense) => {
      const key = expenseFingerprint(expense);
      groups.set(key, [...(groups.get(key) || []), expense.id]);
    });
    return new Set(Array.from(groups.values()).filter((ids) => ids.length > 1).flat());
  }, [snapshot.expenses]);

  const saveClient = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await saveCrmClient(clientDraft);
      setSnapshot((prev) => {
        const clients = [saved, ...prev.clients.filter((item) => item.id !== saved.id)];
        cacheBusinessClients(clients);
        return { ...prev, clients };
      });
      setClientDraft(blankClient());
      setShowClientForm(false);
      setSelectedClientId(saved.id);
      notify('Registro guardado en el CRM.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar el registro.'); }
    finally { setBusy(false); }
  };

  const saveExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const isEditing = Boolean(expenseDraft.id);
    setBusy(true);
    try {
      const saved = await saveBusinessExpense(expenseDraft);
      setSnapshot((prev) => ({ ...prev, expenses: [saved, ...prev.expenses.filter((item) => item.id !== saved.id)] }));
      setExpenseDraft(blankExpense());
      setShowExpenseForm(false);
      setExpenseSuccess(isEditing ? 'Gasto actualizado correctamente' : 'Gasto registrado correctamente');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar el gasto.'); }
    finally { setBusy(false); }
  };

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await saveBusinessPayment(paymentDraft, paymentReceipt);
      setSnapshot((prev) => ({ ...prev, payments: [saved, ...prev.payments.filter((item) => item.id !== saved.id)] }));
      setPaymentDraft(blankPayment());
      setPaymentReceipt(null);
      setShowInlinePayment(false);
      notify(paymentDraft.id ? 'Pago actualizado y conciliado.' : 'Pago registrado y conciliado.');
      await refresh();
    } catch (error: any) { notify(error?.message || 'No se pudo guardar el pago.'); }
    finally { setBusy(false); }
  };

  const syncCalendar = async (client: CrmClient) => {
    if (!dateValue(client.eventDate) || !timeValue(client.eventTime)) {
      notify('Completa la fecha y el horario del evento antes de actualizar Calendar.');
      return;
    }
    setBusy(true);
    try {
      const saved = await syncClientCalendar(client);
      setSnapshot((prev) => ({ ...prev, clients: prev.clients.map((item) => item.id === saved.id ? saved : item) }));
      notify('Evento y sesión previa sincronizados con Google Calendar.');
    } catch (error: any) { notify(error?.message || 'No se pudo sincronizar Google Calendar.'); }
    finally { setBusy(false); }
  };

  const saveFollowUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClient) return;
    setBusy(true);
    try {
      const result = await createCrmFollowUp({ ...followUpDraft, recordId: selectedClient.id });
      setSnapshot((previous) => ({
        ...previous,
        clients: previous.clients.map((item) => item.id === result.client.id ? result.client : item),
        followUps: [result.followUp, ...previous.followUps],
      }));
      setFollowUpDraft({ occurredAt: now(), conversation: '', result: '', nextAction: '', nextActionAt: '' });
      notify('Seguimiento agregado al historial.');
    } catch (error: any) { notify(error?.message || 'No se pudo registrar el seguimiento.'); }
    finally { setBusy(false); }
  };

  const saveInlineClient = async (patch: Partial<CrmClient>) => {
    if (!selectedClient) return;
    setBusy(true);
    try {
      const saved = await saveCrmClient({ ...selectedClient, ...patch });
      setSnapshot((previous) => {
        const clients = previous.clients.map((item) => item.id === saved.id ? saved : item);
        cacheBusinessClients(clients);
        return { ...previous, clients };
      });
      notify('Datos actualizados.');
    } catch (error: any) { notify(error?.message || 'No se pudieron actualizar los datos.'); throw error; }
    finally { setBusy(false); }
  };

  const convertSelectedProspect = async () => {
    if (!selectedClient || selectedClient.recordType !== 'Prospecto') return;
    setBusy(true);
    try {
      const saved = await convertProspectToClient(selectedClient.id);
      setSnapshot((previous) => ({ ...previous, clients: previous.clients.map((item) => item.id === saved.id ? saved : item) }));
      cacheBusinessClients(snapshot.clients.map((item) => item.id === saved.id ? saved : item));
      setTab('clients');
      notify('Prospecto convertido en cliente sin duplicar el registro.');
    } catch (error: any) { notify(error?.message || 'No se pudo convertir el prospecto.'); }
    finally { setBusy(false); }
  };

  const prepareNextPayment = (client: CrmClient) => {
    const existing = snapshot.payments.filter((payment) => payment.clientId === client.id && payment.status !== 'Anulado');
    const used = new Set(existing.map((payment) => Number(payment.installmentNumber)));
    if (!existing.length && Number(client.paidAmount || 0) > 0) used.add(1);
    const nextNumber = ([1, 2, 3].find((number) => !used.has(number)) || 3) as 1 | 2 | 3;
    const percentage = nextNumber === 3 ? 40 : 30;
    const contract = snapshot.contracts.find((item) => item.clientId === client.id);
    setPaymentDraft({ ...blankPayment(client.id, contract?.id || ''), installmentNumber: nextNumber, percentage, concept: `Pago ${nextNumber} de 3`, plannedAmount: Number(((Number(client.totalAmount || 0) * percentage) / 100).toFixed(2)) });
    setShowInlinePayment(true);
  };

  const openClientDetails = (client: CrmClient) => {
    setSelectedClientId(client.id);
    setShowClientForm(false);
    setTab(client.recordType === 'Prospecto' ? 'prospects' : 'clients');
  };

  const selectedClient = snapshot.clients.find((client) => client.id === selectedClientId);
  const selectedClientPayments = selectedClient ? snapshot.payments.filter((payment) => payment.clientId === selectedClient.id && payment.status !== 'Anulado') : [];
  const selectedClientContract = selectedClient ? snapshot.contracts.find((contract) => contract.clientId === selectedClient.id) : undefined;
  const selectedFollowUps = selectedClient ? snapshot.followUps.filter((item) => item.prospectId === selectedClient.id || item.clientId === selectedClient.id).sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))) : [];
  const calendarClients = [...snapshot.clients]
    .filter((client) => client.recordType === 'Cliente' && dateValue(client.eventDate))
    .sort((a, b) => dateValue(a.eventDate).localeCompare(dateValue(b.eventDate)));
  const calendarEntries = useMemo(() => snapshot.clients.flatMap((client) => {
    const entries: Array<{ client: CrmClient; kind: 'event' | 'session'; date: string; time: string }> = [];
    if (dateValue(client.eventDate)) entries.push({ client, kind: 'event', date: dateValue(client.eventDate), time: timeValue(client.eventTime) });
    if (client.preSessionApplies && dateValue(client.preSessionDate)) entries.push({ client, kind: 'session', date: dateValue(client.preSessionDate), time: timeValue(client.preSessionTime) });
    return entries;
  }).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [snapshot.clients]);
  const calendarDays = useMemo(() => {
    const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = localDateKey(date);
      return { date, key, currentMonth: date.getMonth() === calendarCursor.getMonth(), entries: calendarEntries.filter((entry) => entry.date === key) };
    });
  }, [calendarCursor, calendarEntries]);
  const mobileMonthEntries = calendarEntries.filter((entry) => entry.date.startsWith(monthKey(calendarCursor)));

  const uploadContract = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = snapshot.clients.find((item) => item.id === contractDraft.clientId);
    if (!client || !contractDraft.file) return notify('Selecciona un cliente y el PDF del contrato.');
    setBusy(true);
    try {
      const saved = await uploadBusinessContract({
        clientId: client.id,
        clientName: client.name,
        folio: contractDraft.folio,
        eventType: contractDraft.eventType || client.eventType,
        eventDate: contractDraft.eventDate || client.eventDate,
        file: contractDraft.file,
      });
      setSnapshot((prev) => ({ ...prev, contracts: [saved, ...prev.contracts.filter((item) => item.id !== saved.id)] }));
      setContractDraft({ clientId: '', folio: '', eventType: '', eventDate: '', file: null });
      notify('Contrato guardado de forma privada.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar el contrato.'); }
    finally { setBusy(false); }
  };

  const createLink = async (contract: BusinessContract) => {
    setBusy(true);
    try {
      const result = await createContractSigningLink(contract.id);
      setLatestLink(result.url);
      await navigator.clipboard.writeText(result.url).catch(() => null);
      await refresh();
      notify('Liga móvil creada y copiada. Caduca en 72 horas.');
    } catch (error: any) { notify(error?.message || 'No se pudo crear la liga.'); }
    finally { setBusy(false); }
  };

  const finalize = async (contract: BusinessContract) => {
    setBusy(true);
    try {
      const saved = await finalizeBusinessContract(contract.id);
      setSnapshot((prev) => ({ ...prev, contracts: prev.contracts.map((item) => item.id === saved.id ? saved : item) }));
      notify('Contrato autorizado y finalizado con tu firma.');
    } catch (error: any) { notify(error?.message || 'No se pudo finalizar el contrato.'); }
    finally { setBusy(false); }
  };

  const persistOwnerSignature = async () => {
    if (!ownerSignature) return notify('Firma dentro del recuadro antes de guardar.');
    setBusy(true);
    try {
      await saveOwnerSignature(ownerSignature);
      setSnapshot((prev) => ({ ...prev, ownerSignatureConfigured: true }));
      setOwnerSignature('');
      notify('Firma de Javier guardada de forma privada.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar la firma.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="space-y-5">
      {expenseSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-[100] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-emerald-300/30 bg-[#101A16] px-5 py-4 text-sm font-semibold text-emerald-100 shadow-2xl shadow-black/40 sm:right-6 sm:top-6"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>{expenseSuccess}</span>
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clientes, gastos y contratos</h2>
          <p className="mt-1 text-sm text-gray-400">Información privada del negocio. Los registros nuevos comienzan vacíos.</p>
        </div>
        <button onClick={refresh} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Prospectos y clientes" value={String(snapshot.clients.length)} icon={Users} />
        <Metric label="Contratos" value={String(snapshot.contracts.length)} icon={FileSignature} />
        <Metric label="Cobrado / contratado" value={`${money(totals.paid)} / ${money(totals.sales)}`} icon={BadgeDollarSign} />
      </div>

      <div className="flex overflow-x-auto gap-2 rounded-2xl border border-white/10 bg-[#161C28] p-1.5">
        {[
          { id: 'overview' as const, label: 'Control financiero', icon: TrendingUp },
          { id: 'prospects' as const, label: 'Prospectos', icon: Users },
          { id: 'clients' as const, label: 'Clientes', icon: BriefcaseBusiness },
          { id: 'calendar' as const, label: 'Calendario', icon: CalendarDays },
          { id: 'payments' as const, label: 'Pagos de clientes', icon: CreditCard },
          { id: 'expenses' as const, label: 'Control de gastos', icon: BadgeDollarSign },
          { id: 'contracts' as const, label: 'Contratos y firmas', icon: FileSignature },
        ].map((item) => { const Icon = item.icon; return (
          <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === item.id ? 'bg-white text-black' : 'text-gray-300'}`}>
            <Icon className="h-4 w-4" />{item.label}
          </button>
        ); })}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Bote acumulado cobrado" value={money(financials.collected)} icon={BadgeDollarSign} />
            <Metric label="Por cobrar a clientes" value={money(financials.receivable)} icon={Users} />
            <Metric label="Gastos pagados" value={money(financials.paidExpenses)} icon={BriefcaseBusiness} />
            <Metric label="Flujo neto registrado" value={money(financials.netRegistered)} icon={TrendingUp} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5">
              <div className="flex items-start justify-between gap-4">
                <div><h3 className="font-semibold">Resumen del negocio</h3><p className="mt-1 text-xs leading-5 text-gray-400">Se calcula únicamente con lo que registres. Los depósitos no se presentan como utilidad.</p></div>
                <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1 text-xs text-[#F5D76E]">Automático</span>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <FinancialRow label="Valor contratado" value={financials.contracted} />
                <FinancialRow label="Gastos pendientes" value={financials.pendingExpenses} />
                <FinancialRow label="Publicidad registrada" value={financials.advertising} />
                <FinancialRow label="CAC provisional" value={financials.cac} detail={financials.clientsFromAds ? `${financials.clientsFromAds} cliente(s) de anuncios` : 'Sin clientes atribuidos a anuncios'} />
                <FinancialRow label="Resultado proyectado registrado" value={financials.projectedResult} detail="No incluye costos que todavía no hayas capturado" />
              </dl>
            </section>
            <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5">
              <h3 className="font-semibold">Gastos por categoría</h3>
              <div className="mt-4 space-y-3">
                {expenseCategories.map((category) => {
                  const value = snapshot.expenses.filter((item) => item.category === category).reduce((sum, item) => sum + Number(item.amount || 0), 0);
                  const percent = financials.paidExpenses + financials.pendingExpenses > 0 ? Math.min(100, (value / (financials.paidExpenses + financials.pendingExpenses)) * 100) : 0;
                  return <div key={category}><div className="flex justify-between gap-3 text-xs"><span className="text-gray-300">{category}</span><span>{money(value)}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${percent}%` }} /></div></div>;
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {(tab === 'prospects' || tab === 'clients') && (
        <div className="space-y-4">
          {selectedClient ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111722] shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-3 border-b border-white/10 bg-[#161C28] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><button onClick={() => { setSelectedClientId(''); setShowClientForm(false); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-200 hover:bg-white/5">← Clientes</button><span className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" />{selectedClient.status}</span></div>
                <div className="flex flex-wrap gap-2">{selectedClient.recordType === 'Prospecto' && <button onClick={convertSelectedProspect} disabled={busy} className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">Convertir en cliente</button>}{selectedClient.recordType === 'Cliente' && (selectedClientPayments.length > 0 || Number(selectedClient.paidAmount || 0) > 0) && <button onClick={() => prepareNextPayment(selectedClient)} className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">Registrar siguiente pago</button>}{selectedClientContract && <a href={adminContractPdfUrl(selectedClientContract.id, 'latest')} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white">Ver contrato</a>}<button onClick={() => { setClientDraft(selectedClient); setShowClientForm(true); }} className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black">Editar seguimiento</button>{selectedClient.recordType === 'Cliente' && <button onClick={() => syncCalendar(selectedClient)} disabled={busy || !dateValue(selectedClient.eventDate) || !timeValue(selectedClient.eventTime)} className="rounded-lg border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-100 disabled:border-white/10 disabled:bg-transparent disabled:text-gray-600">Actualizar Calendar</button>}</div>
              </div>
              {showInlinePayment && <div className="border-b border-white/10 p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-white">Registrar siguiente pago de {selectedClient.name}</h3><button onClick={() => setShowInlinePayment(false)} className="text-xs text-gray-400">Cerrar</button></div><PaymentForm draft={paymentDraft} receipt={paymentReceipt} clients={snapshot.clients} contracts={snapshot.contracts} onChange={setPaymentDraft} onReceipt={setPaymentReceipt} onSubmit={savePayment} onCancel={() => { setPaymentDraft(blankPayment()); setPaymentReceipt(null); setShowInlinePayment(false); }} busy={busy} /></div>}
              {showClientForm ? <ClientForm draft={clientDraft} onChange={setClientDraft} onSubmit={saveClient} onCancel={() => setShowClientForm(false)} busy={busy} /> : <ClientDetails client={selectedClient} paid={paidForClient(selectedClient)} followUps={selectedFollowUps} followUpDraft={followUpDraft} onFollowUpChange={setFollowUpDraft} onFollowUpSubmit={saveFollowUp} onInlineSave={saveInlineClient} busy={busy} />}
            </div>
          ) : <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar ${tab === 'prospects' ? 'prospectos' : 'clientes'} por nombre, teléfono, evento o estado`} className="w-full max-w-xl rounded-xl border border-white/10 bg-[#161C28] px-4 py-3 text-sm" />
            <button onClick={() => { setSelectedClientId(''); setClientDraft({ ...blankClient(), recordType: tab === 'clients' ? 'Cliente' : 'Prospecto' }); setShowClientForm(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black"><Plus className="h-4 w-4" />{tab === 'prospects' ? 'Nuevo prospecto' : 'Nuevo cliente'}</button>
          </div>
          {showClientForm && <ClientForm draft={clientDraft} onChange={setClientDraft} onSubmit={saveClient} onCancel={() => setShowClientForm(false)} busy={busy} />}
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#161C28]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-black/20 text-xs uppercase tracking-wider text-[#D4AF37]"><tr><th className="p-4">Contacto</th><th className="p-4">Evento</th><th className="p-4">Estado</th><th className="p-4">Importes</th><th className="p-4">Próxima acción</th><th className="p-4"></th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {filteredClients.map((client) => <tr key={client.id} className="align-top">
                  <td className="p-4"><button onClick={() => openClientDetails(client)} className="text-left font-semibold text-white hover:text-[#D4AF37]">{client.name || 'Sin nombre'}</button><div className="text-xs text-gray-400">{client.phone || 'Sin teléfono'} · {client.recordType}</div></td>
                  <td className="p-4"><div>{client.eventType || 'Por confirmar'}</div><div className="text-xs text-gray-400">{dateValue(client.eventDate) || 'Sin fecha'} · {client.eventLocation || 'Sin lugar'}</div></td>
                  <td className="p-4"><span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-xs text-[#F5D76E]">{client.status}</span></td>
                  <td className="p-4"><div>{money(client.totalAmount)}</div><div className="text-xs text-emerald-300">Pagado {money(paidForClient(client))}</div><div className="text-xs text-amber-300">Pendiente {money(Math.max(0, client.totalAmount - paidForClient(client)))}</div></td>
                  <td className="p-4"><div>{client.nextAction || 'Sin acción'}</div><div className="text-xs text-gray-400">{client.nextActionAt || 'Sin fecha'}</div></td>
                  <td className="p-4"><button onClick={() => openClientDetails(client)} className="text-left text-xs text-[#D4AF37]">Ver detalles</button></td>
                </tr>)}
                {!filteredClients.length && <tr><td colSpan={6} className="p-10 text-center text-gray-500">Aún no hay registros. Agrega el primer prospecto o cliente.</td></tr>}
              </tbody>
            </table>
          </div>
          </>}
        </div>
      )}

      {tab === 'calendar' && (
        <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-[#111722] xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 overflow-x-auto">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4">
            <button onClick={() => setCalendarCursor(new Date())} className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold">Hoy</button>
            <button aria-label="Mes anterior" onClick={() => setCalendarCursor((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="rounded-full border border-white/15 bg-white/10 p-2 text-white hover:bg-white/20"><ChevronLeft className="h-5 w-5 stroke-[2.5]" /></button>
            <button aria-label="Mes siguiente" onClick={() => setCalendarCursor((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="rounded-full border border-white/15 bg-white/10 p-2 text-white hover:bg-white/20"><ChevronRight className="h-5 w-5 stroke-[2.5]" /></button>
            <h3 className="min-w-[190px] text-xl font-bold capitalize">{monthLabel(calendarCursor)}</h3>
            <span className="ml-auto text-xs text-gray-400">Haz clic en un evento para abrir al cliente</span>
          </div>
          <div className="hidden grid-cols-7 border-b border-white/10 bg-black/15 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:grid">{['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => <div key={day} className="py-2">{day}</div>)}</div>
          <div className="hidden grid-cols-7 sm:grid">
            {calendarDays.map(({ date, key, currentMonth, entries }) => <div key={key} className={`min-h-28 border-b border-r border-white/10 p-2 sm:min-h-36 ${currentMonth ? 'bg-[#111722]' : 'bg-black/20 text-gray-600'}`}>
              <div className={`mb-2 text-center text-xs ${key === localDateKey(new Date()) ? 'mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-[#D4AF37] font-bold text-black' : ''}`}>{date.getDate()}</div>
              <div className="space-y-1">{entries.map((entry) => <button key={`${entry.client.id}-${entry.kind}`} onClick={() => openClientDetails(entry.client)} title={`${entry.kind === 'session' ? 'Sesión previa' : entry.client.eventType || 'Evento'} · ${entry.client.name}`} className={`block w-full truncate rounded-md border-l-4 px-1.5 py-1 text-left text-[10px] sm:text-xs ${entry.kind === 'session' ? 'border-red-400 bg-red-500/15 text-red-200 hover:bg-red-500/25' : 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F5D76E] hover:bg-[#D4AF37]/25'}`}><span className="font-semibold">{entry.time || '—'}</span> {entry.kind === 'session' ? 'Sesión · ' : ''}{entry.client.name || 'Cliente'}</button>)}</div>
            </div>)}
          </div>
          <div className="space-y-3 p-4 sm:hidden">{mobileMonthEntries.map((entry) => <button key={`${entry.client.id}-${entry.kind}-${entry.date}`} onClick={() => openClientDetails(entry.client)} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left ${entry.kind === 'session' ? 'border-red-400/30 bg-red-500/10' : 'border-[#D4AF37]/30 bg-[#D4AF37]/10'}`}><div className={`min-w-14 rounded-lg px-2 py-2 text-center ${entry.kind === 'session' ? 'bg-red-500/20 text-red-100' : 'bg-[#D4AF37]/20 text-[#F5D76E]'}`}><div className="text-lg font-bold">{entry.date.slice(8, 10)}</div><div className="text-[10px] uppercase">{new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(new Date(`${entry.date}T12:00:00`))}</div></div><div className="min-w-0 flex-1"><div className={`text-xs font-semibold uppercase tracking-wide ${entry.kind === 'session' ? 'text-red-200' : 'text-[#F5D76E]'}`}>{entry.kind === 'session' ? 'Sesión previa' : entry.client.eventType || 'Evento'}</div><div className="mt-1 break-words font-semibold text-white">{entry.client.name || 'Cliente sin nombre'}</div><div className="mt-1 text-sm text-gray-300">{entry.time || 'Horario pendiente'}</div><div className="mt-1 break-words text-xs text-gray-400">{entry.kind === 'session' ? entry.client.preSessionLocation || 'Lugar pendiente' : entry.client.eventLocation || 'Lugar pendiente'}</div></div></button>)}{!mobileMonthEntries.length && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">No hay eventos ni sesiones programadas este mes.</div>}</div>
          </div>
          <aside className="border-t border-white/10 bg-[#161C28] xl:border-l xl:border-t-0">
            <div className="border-b border-white/10 p-4"><h4 className="font-semibold text-white">Clientes</h4><p className="mt-1 text-xs text-gray-400">Eventos y sesiones programadas</p><div className="mt-3 flex gap-3 text-[11px]"><span className="flex items-center gap-1.5 text-[#F5D76E]"><i className="h-2.5 w-2.5 rounded-full bg-[#D4AF37]" />Evento</span><span className="flex items-center gap-1.5 text-red-200"><i className="h-2.5 w-2.5 rounded-full bg-red-400" />Sesión</span></div></div>
            <div className="max-h-[670px] divide-y divide-white/10 overflow-y-auto">{calendarClients.map((client) => <button key={client.id} onClick={() => openClientDetails(client)} className="block w-full p-4 text-left hover:bg-white/5"><div className="font-semibold text-white">{client.name || 'Cliente sin nombre'}</div><div className="mt-1 text-xs text-gray-400">{dateValue(client.eventDate)} · {timeValue(client.eventTime) || 'Horario pendiente'}</div><div className="mt-1 text-xs text-[#F5D76E]">{client.eventType || 'Evento por confirmar'}</div>{client.preSessionApplies && <div className="mt-2 rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-200">Sesión: {dateValue(client.preSessionDate) || 'Fecha pendiente'} · {timeValue(client.preSessionTime) || 'Hora pendiente'}</div>}</button>)}{!calendarClients.length && <p className="p-6 text-center text-sm text-gray-500">No hay clientes con fecha registrada.</p>}</div>
          </aside>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-4">
          <PaymentForm draft={paymentDraft} receipt={paymentReceipt} clients={snapshot.clients} contracts={snapshot.contracts} onChange={setPaymentDraft} onReceipt={setPaymentReceipt} onSubmit={savePayment} onCancel={() => { setPaymentDraft(blankPayment()); setPaymentReceipt(null); }} busy={busy} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Pagos liquidados" value={money(snapshot.payments.filter((item) => item.status === 'Liquidado').reduce((sum, item) => sum + Number(item.receivedAmount || 0), 0))} icon={CheckCircle2} />
            <Metric label="Pagos programados pendientes" value={money(snapshot.payments.filter((item) => item.status === 'Pendiente').reduce((sum, item) => sum + Number(item.plannedAmount || 0), 0))} icon={CreditCard} />
            <Metric label="Movimientos anulados" value={String(snapshot.payments.filter((item) => item.status === 'Anulado').length)} icon={RefreshCw} />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#161C28]"><table className="min-w-full text-left text-sm"><thead className="bg-black/20 text-xs uppercase tracking-wider text-[#D4AF37]"><tr><th className="p-4">Cliente</th><th className="p-4">Pago</th><th className="p-4">Fecha / concepto</th><th className="p-4">Programado</th><th className="p-4">Recibido</th><th className="p-4">Estado</th><th className="p-4">Comprobante</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-white/5">{snapshot.payments.map((payment) => { const client = snapshot.clients.find((item) => item.id === payment.clientId); return <tr key={payment.id}><td className="p-4">{client?.name || 'Cliente no localizado'}</td><td className="p-4">{payment.installmentNumber ? `${payment.installmentNumber} de 3` : 'Histórico'}<div className="text-xs text-[#D4AF37]">{payment.percentage ? `${payment.percentage}%` : ''}</div></td><td className="p-4"><div>{payment.date}</div><div className="text-xs text-gray-400">{payment.concept}</div></td><td className="p-4">{money(payment.plannedAmount)}</td><td className="p-4">{money(payment.receivedAmount)}</td><td className="p-4"><span className={payment.status === 'Liquidado' ? 'text-emerald-300' : payment.status === 'Pendiente' ? 'text-amber-300' : 'text-gray-400'}>{payment.status}</span></td><td className="p-4">{payment.receiptUrl ? <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-[#D4AF37]">Ver comprobante</a> : <span className="text-xs text-gray-500">Sin archivo</span>}</td><td className="p-4"><button onClick={() => { setPaymentDraft(payment); setPaymentReceipt(null); }} className="text-xs font-semibold text-[#D4AF37]">Editar</button></td></tr>; })}{!snapshot.payments.length && <tr><td colSpan={8} className="p-10 text-center text-gray-500">Aún no hay pagos en el historial. Los importes cobrados actuales se conservarán al registrar el primer movimiento de cada cliente.</td></tr>}</tbody></table></div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex justify-end"><button onClick={() => { setExpenseDraft(blankExpense()); setShowExpenseForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black"><Plus className="h-4 w-4" />Registrar gasto</button></div>
          {showExpenseForm && <ExpenseForm draft={expenseDraft} clients={snapshot.clients} onChange={setExpenseDraft} onSubmit={saveExpense} onCancel={() => { setExpenseDraft(blankExpense()); setShowExpenseForm(false); }} busy={busy} />}
          {duplicateExpenseIds.size > 0 && <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100"><strong>Revisión pendiente:</strong> hay {duplicateExpenseIds.size} registros dentro de grupos que coinciden en todos sus datos visibles. Edítalos para distinguirlos o revisa sus comprobantes antes de ajustar tus totales.</div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{expenseCategories.map((category) => <div key={category} className="rounded-2xl border border-white/10 bg-[#161C28] p-4"><div className="text-xs text-gray-400">{category}</div><div className="mt-2 text-xl font-bold">{money(snapshot.expenses.filter((item) => item.category === category).reduce((sum, item) => sum + Number(item.amount || 0), 0))}</div></div>)}</div>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#161C28]"><table className="min-w-full text-left text-sm"><thead className="bg-black/20 text-xs uppercase tracking-wider text-[#D4AF37]"><tr><th className="p-4">Fecha</th><th className="p-4">Categoría</th><th className="p-4">Concepto</th><th className="p-4">Estado</th><th className="p-4">Monto</th><th className="p-4">Acciones</th></tr></thead><tbody className="divide-y divide-white/5">{snapshot.expenses.map((expense) => <tr key={expense.id} className={duplicateExpenseIds.has(expense.id) ? 'bg-amber-400/5' : ''}><td className="p-4">{expense.date}</td><td className="p-4">{expense.category}<div className="text-xs text-gray-500">{expense.subcategory}</div></td><td className="p-4">{expense.concept}<div className="text-xs text-gray-500">{expense.supplier}</div>{duplicateExpenseIds.has(expense.id) && <div className="mt-1 text-xs font-semibold text-amber-300">Posible duplicado</div>}</td><td className="p-4"><span className={expense.paymentStatus === 'Pagado' ? 'text-emerald-300' : 'text-amber-300'}>{expense.paymentStatus}</span></td><td className="p-4 font-semibold">{money(expense.amount)}</td><td className="p-4"><button onClick={() => { setExpenseDraft(expense); setShowExpenseForm(true); }} className="text-xs font-semibold text-[#D4AF37]">Editar</button></td></tr>)}{!snapshot.expenses.length && <tr><td colSpan={6} className="p-10 text-center text-gray-500">Aún no hay gastos registrados.</td></tr>}</tbody></table></div>
        </div>
      )}

      {tab === 'contracts' && (
        <div className="space-y-5">
          <form onSubmit={uploadContract} className="grid gap-3 rounded-2xl border border-white/10 bg-[#161C28] p-5 lg:grid-cols-5">
            <select value={contractDraft.clientId} onChange={(event) => { const client = snapshot.clients.find((item) => item.id === event.target.value); setContractDraft((prev) => ({ ...prev, clientId: event.target.value, eventType: client?.eventType || '', eventDate: client?.eventDate || '' })); }} className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm" required><option value="">Selecciona cliente</option>{snapshot.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
            <input value={contractDraft.folio} onChange={(event) => setContractDraft((prev) => ({ ...prev, folio: event.target.value }))} placeholder="Folio" className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm" required />
            <input value={contractDraft.eventType} onChange={(event) => setContractDraft((prev) => ({ ...prev, eventType: event.target.value }))} placeholder="Tipo de evento" className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm" required />
            <input type="date" value={contractDraft.eventDate} onChange={(event) => setContractDraft((prev) => ({ ...prev, eventDate: event.target.value }))} className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm" required />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#D4AF37]/50 px-3 py-3 text-sm text-[#F5D76E]"><BriefcaseBusiness className="h-4 w-4" />{contractDraft.file?.name || 'Elegir PDF (máx. 2.6 MB)'}<input type="file" accept="application/pdf" className="hidden" onChange={(event) => setContractDraft((prev) => ({ ...prev, file: event.target.files?.[0] || null }))} /></label>
            <button type="submit" disabled={busy} className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black lg:col-span-5"><Save className="mr-2 inline h-4 w-4" />Guardar contrato privado</button>
          </form>

          {latestLink && <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 sm:flex-row sm:items-center"><input readOnly value={latestLink} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-2 text-xs" /><button onClick={() => navigator.clipboard.writeText(latestLink)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"><ClipboardCopy className="h-4 w-4" />Copiar</button></div>}

          <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
            <div className="space-y-3">{snapshot.contracts.map((contract) => <article key={contract.id} className="rounded-2xl border border-white/10 bg-[#161C28] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">{contract.clientName}</div><div className="text-xs text-gray-400">{contract.folio} · {contract.eventType} · {contract.eventDate}</div><div className="mt-2 text-xs text-[#F5D76E]">{contract.status}</div></div><div className="flex flex-wrap gap-2"><a href={adminContractPdfUrl(contract.id, 'latest')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs"><Eye className="h-4 w-4" />Ver contrato</a><button onClick={() => createLink(contract)} disabled={busy || contract.status === 'Finalizado'} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs disabled:opacity-40"><Send className="h-4 w-4" />Crear liga móvil</button>{contract.status === 'Firmado por cliente' && <button onClick={() => finalize(contract)} disabled={busy || !snapshot.ownerSignatureConfigured} className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-3 py-2 text-xs font-bold text-black disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Autorizar y finalizar</button>}</div></div></article>)}{!snapshot.contracts.length && <div className="rounded-2xl border border-white/10 bg-[#161C28] p-10 text-center text-gray-500">Aún no hay contratos cargados.</div>}</div>
            <aside className="rounded-2xl border border-white/10 bg-[#161C28] p-5 space-y-4"><div><div className="flex items-center gap-2 font-semibold"><PenLine className="h-4 w-4 text-[#D4AF37]" />Firma de Javier</div><p className="mt-1 text-xs text-gray-400">Se guarda privada y nunca se aplica automáticamente.</p></div><SignaturePad onChange={setOwnerSignature} label="Firma de autorización" /><button onClick={persistOwnerSignature} disabled={busy || !ownerSignature} className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-40">{snapshot.ownerSignatureConfigured ? 'Reemplazar firma guardada' : 'Guardar firma'}</button>{snapshot.ownerSignatureConfigured && <p className="text-xs text-emerald-300">Firma privada configurada.</p>}</aside>
          </div>
        </div>
      )}
    </section>
  );
};

const Metric = ({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) => <div className="rounded-2xl border border-white/10 bg-[#161C28] p-4"><div className="flex items-center gap-2 text-xs text-gray-400"><Icon className="h-4 w-4 text-[#D4AF37]" />{label}</div><div className="mt-2 text-xl font-bold">{value}</div></div>;
const FinancialRow = ({ label, value, detail }: { label: string; value: number; detail?: string }) => <div className="rounded-xl border border-white/5 bg-black/15 p-3"><dt className="text-xs text-gray-400">{label}</dt><dd className="mt-1 text-lg font-semibold">{money(value)}</dd>{detail && <p className="mt-1 text-[11px] leading-4 text-gray-500">{detail}</p>}</div>;

const ClientDetails = ({ client, paid, followUps, followUpDraft, onFollowUpChange, onFollowUpSubmit, onInlineSave, busy }: { client: CrmClient; paid: number; followUps: CrmFollowUp[]; followUpDraft: Partial<CrmFollowUp>; onFollowUpChange: (value: Partial<CrmFollowUp>) => void; onFollowUpSubmit: (event: React.FormEvent) => void; onInlineSave: (patch: Partial<CrmClient>) => Promise<void>; busy: boolean }) => {
  const [editKey, setEditKey] = useState('');
  const [inlineDraft, setInlineDraft] = useState<Partial<CrmClient>>(client);
  useEffect(() => setInlineDraft(client), [client]);
  const patchInline = (key: keyof CrmClient, value: unknown) => setInlineDraft((current) => ({ ...current, [key]: value }));
  const commitInline = async (keys: Array<keyof CrmClient>) => {
    const patch: Partial<CrmClient> = {};
    keys.forEach((key) => { (patch as Record<string, unknown>)[key] = inlineDraft[key]; });
    await onInlineSave(patch);
    setEditKey('');
  };
  const fields = [
    ['Responsable', 'Javier García'], ['Fecha de seguimiento', client.nextActionAt || 'Sin programar'], ['Proyecto', client.status],
    ['Tipo de servicio', client.eventType || 'Por confirmar'], ['Origen del cliente', client.source || 'Sin registrar'], ['Campaña', client.campaign || 'Sin campaña'],
  ];
  const pending: Array<[string, boolean, string, Array<keyof CrmClient>]> = [
    ['Datos de contacto', Boolean(client.phone || client.email), 'contact', ['phone', 'email']], ['Fecha y horario del evento', Boolean(dateValue(client.eventDate) && timeValue(client.eventTime)), 'eventDate', ['eventDate', 'eventTime']],
    ['Lugar del evento', Boolean(client.eventLocation), 'location', ['eventLocation']], ['Paquete y total', Boolean(client.packageName && client.totalAmount > 0), 'package', ['packageName', 'totalAmount']],
    ['Sesión previa', !client.preSessionApplies || Boolean(dateValue(client.preSessionDate) && timeValue(client.preSessionTime) && client.preSessionLocation), 'session', ['preSessionApplies', 'preSessionDate', 'preSessionTime', 'preSessionLocation']],
  ];
  return <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
    <div className="border-b border-white/10 pb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">Seguimiento de cliente</p><h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{client.nextAction || client.name || 'Cliente sin nombre'}</h3><p className="mt-2 text-sm text-gray-400">{client.name || 'Sin nombre'} · {client.recordType} · {client.phone || 'Sin teléfono'}</p></div>
    <dl className="divide-y divide-white/10 py-3">{fields.map(([label, value], index) => <div key={label} className="grid gap-2 py-3 text-sm sm:grid-cols-[180px_1fr]"><dt className="text-gray-400">{label}</dt><dd><span className={`inline-flex rounded-md px-2.5 py-1 ${index >= 2 ? 'bg-[#D4AF37]/15 text-[#F5D76E]' : 'text-gray-100'}`}>{String(value)}</span></dd></div>)}</dl>
    <section className="border-t border-white/10 py-6"><h4 className="text-sm font-semibold text-gray-200">Descripción</h4><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-300">{client.notes || client.objection || 'Sin descripción registrada. Usa “Editar seguimiento” para agregar contexto, acuerdos y observaciones.'}</p></section>
    <section className="border-t border-white/10 py-6"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-gray-200">Pendientes del expediente</h4><span className="text-xs text-gray-500">{pending.filter(([, done]) => done).length} de {pending.length} completos</span></div><div className="mt-4 divide-y divide-white/10 border-y border-white/10">{pending.map(([label, done, key, keys]) => <div key={key} className="py-3 text-sm"><button type="button" onClick={() => setEditKey(editKey === key ? '' : key)} className="flex w-full items-center gap-3 text-left"><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${done ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300' : 'border-gray-500 text-transparent'}`}>✓</span><span className={done ? 'text-gray-400 line-through' : 'text-gray-100'}>{label}</span><span className="ml-auto text-xs text-[#D4AF37]">{editKey === key ? 'Cerrar' : '›'}</span></button>{editKey === key && <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/15 p-3 sm:grid-cols-2">{key === 'contact' && <><input value={inlineDraft.phone || ''} onChange={(event) => patchInline('phone', event.target.value)} placeholder="Teléfono" className={inputClass} /><input type="email" value={inlineDraft.email || ''} onChange={(event) => patchInline('email', event.target.value)} placeholder="Correo" className={inputClass} /></>}{key === 'eventDate' && <><label className="text-xs text-gray-400">Fecha<input type="date" value={dateValue(inlineDraft.eventDate)} onChange={(event) => patchInline('eventDate', event.target.value)} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-400">Horario<input type="time" value={timeValue(inlineDraft.eventTime)} onChange={(event) => patchInline('eventTime', event.target.value)} className={`${inputClass} mt-1`} /></label></>}{key === 'location' && <input value={inlineDraft.eventLocation || ''} onChange={(event) => patchInline('eventLocation', event.target.value)} placeholder="Lugar y dirección del evento" className={`${inputClass} sm:col-span-2`} />}{key === 'package' && <><input value={inlineDraft.packageName || ''} onChange={(event) => patchInline('packageName', event.target.value)} placeholder="Paquete contratado" className={inputClass} /><input type="number" min="0" step="0.01" value={inlineDraft.totalAmount || 0} onChange={(event) => patchInline('totalAmount', Number(event.target.value))} placeholder="Total contratado" className={inputClass} /></>}{key === 'session' && <><label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 text-sm"><input type="checkbox" checked={Boolean(inlineDraft.preSessionApplies)} onChange={(event) => patchInline('preSessionApplies', event.target.checked)} />Aplica sesión</label><input type="date" value={dateValue(inlineDraft.preSessionDate)} onChange={(event) => patchInline('preSessionDate', event.target.value)} className={inputClass} disabled={!inlineDraft.preSessionApplies} /><input type="time" value={timeValue(inlineDraft.preSessionTime)} onChange={(event) => patchInline('preSessionTime', event.target.value)} className={inputClass} disabled={!inlineDraft.preSessionApplies} /><input value={inlineDraft.preSessionLocation || ''} onChange={(event) => patchInline('preSessionLocation', event.target.value)} placeholder="Lugar de la sesión" className={inputClass} disabled={!inlineDraft.preSessionApplies} /></>}<button type="button" disabled={busy} onClick={() => commitInline(keys)} className="w-fit rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">OK</button></div>}</div>)}</div></section>
    <section className="grid gap-5 border-t border-white/10 py-6 lg:grid-cols-2"><div><h4 className="text-sm font-semibold text-gray-200">Información del evento</h4><div className="mt-3 space-y-2 text-sm text-gray-300"><p>{client.eventType || 'Evento por confirmar'} · {dateValue(client.eventDate) || 'Sin fecha'} · {timeValue(client.eventTime) || 'Sin horario'}</p><p>{client.eventLocation || 'Lugar pendiente'}</p><p>{client.packageName || 'Paquete pendiente'} · {client.serviceHours ? `${client.serviceHours} horas` : 'Cobertura pendiente'}</p></div></div><div><h4 className="text-sm font-semibold text-gray-200">Control de cobro</h4><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><span className="block text-xs text-gray-500">Total</span>{money(client.totalAmount)}</div><div><span className="block text-xs text-gray-500">Pagado</span><span className="text-emerald-300">{money(paid)}</span></div><div><span className="block text-xs text-gray-500">Pendiente</span><span className="text-amber-300">{money(Math.max(0, Number(client.totalAmount || 0) - paid))}</span></div></div></div></section>
    <section className="border-t border-white/10 py-6"><h4 className="text-sm font-semibold text-gray-200">Actividad</h4><div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-black/15 p-4 sm:grid-cols-2"><label className="text-xs text-gray-400">Último contacto<input type="datetime-local" value={String(inlineDraft.lastContactAt || '').slice(0, 16)} onChange={(event) => patchInline('lastContactAt', event.target.value)} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-400">Próxima fecha<input type="datetime-local" value={String(inlineDraft.nextActionAt || '').slice(0, 16)} onChange={(event) => patchInline('nextActionAt', event.target.value)} className={`${inputClass} mt-1`} /></label><input value={inlineDraft.nextAction || ''} onChange={(event) => patchInline('nextAction', event.target.value)} placeholder="Próxima acción" className={inputClass} /><input type="number" min="0" step="1" value={inlineDraft.followUpAttempts || 0} onChange={(event) => patchInline('followUpAttempts', Number(event.target.value))} placeholder="Intentos de seguimiento" className={inputClass} /><button type="button" disabled={busy} onClick={() => commitInline(['lastContactAt', 'nextActionAt', 'nextAction', 'followUpAttempts'])} className="w-fit rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">OK</button></div><h4 className="mt-6 text-sm font-semibold text-gray-200">Agregar seguimiento al historial</h4><form onSubmit={onFollowUpSubmit} className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-black/15 p-4 sm:grid-cols-2"><label className="text-xs text-gray-400">Fecha y hora<input type="datetime-local" value={String(followUpDraft.occurredAt || '').slice(0, 16)} onChange={(event) => onFollowUpChange({ ...followUpDraft, occurredAt: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-400">Siguiente seguimiento<input type="datetime-local" value={String(followUpDraft.nextActionAt || '').slice(0, 16)} onChange={(event) => onFollowUpChange({ ...followUpDraft, nextActionAt: event.target.value })} className={`${inputClass} mt-1`} /></label><textarea value={followUpDraft.conversation || ''} onChange={(event) => onFollowUpChange({ ...followUpDraft, conversation: event.target.value })} placeholder="Resumen de la conversación" className={`${inputClass} min-h-24`} /><textarea value={followUpDraft.result || ''} onChange={(event) => onFollowUpChange({ ...followUpDraft, result: event.target.value })} placeholder="Resultado" className={`${inputClass} min-h-24`} /><input value={followUpDraft.nextAction || ''} onChange={(event) => onFollowUpChange({ ...followUpDraft, nextAction: event.target.value })} placeholder="Próxima acción" className={`${inputClass} sm:col-span-2`} /><button type="submit" disabled={busy} className="w-fit rounded-lg bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">Guardar en historial</button></form></section>
    <section className="border-t border-white/10 py-6"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-gray-200">Historial de seguimientos</h4><span className="text-xs text-gray-500">{followUps.length} registro(s)</span></div><div className="mt-4 space-y-3">{followUps.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><time className="text-xs font-semibold text-[#D4AF37]">{item.occurredAt}</time><span className="text-xs text-gray-500">{item.createdBy}</span></div><p className="mt-3 whitespace-pre-wrap text-sm text-gray-200">{item.conversation || 'Sin conversación capturada'}</p>{item.result && <p className="mt-2 text-sm text-gray-400">Resultado: {item.result}</p>}{item.nextAction && <p className="mt-2 text-xs text-sky-200">Siguiente: {item.nextAction} · {item.nextActionAt || 'sin fecha'}</p>}</article>)}{!followUps.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">Aún no hay seguimientos históricos. El siguiente registro se conservará sin sobrescribir los anteriores.</p>}</div></section>
  </div>;
};

const inputClass = 'w-full rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-2.5 text-sm';
const ClientForm = ({ draft, onChange, onSubmit, onCancel, busy }: { draft: Partial<CrmClient>; onChange: (value: Partial<CrmClient>) => void; onSubmit: (event: React.FormEvent) => void; onCancel: () => void; busy: boolean }) => {
  const patch = (key: keyof CrmClient, value: unknown) => onChange({ ...draft, [key]: value, updatedAt: now() });
  return <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#161C28] p-5 sm:grid-cols-2 lg:grid-cols-4">
    <select value={draft.recordType || 'Prospecto'} onChange={(e) => patch('recordType', e.target.value)} className={inputClass}><option>Prospecto</option><option>Cliente</option></select>
    <input value={draft.name || ''} onChange={(e) => patch('name', e.target.value)} placeholder="Nombre completo" className={inputClass} required />
    <input value={draft.honoreeName || ''} onChange={(e) => patch('honoreeName', e.target.value)} placeholder="Festejado(s) / pareja" className={inputClass} />
    <input value={draft.phone || ''} onChange={(e) => patch('phone', e.target.value)} placeholder="Teléfono" className={inputClass} />
    <input type="email" value={draft.email || ''} onChange={(e) => patch('email', e.target.value)} placeholder="Correo" className={inputClass} />
    <input value={draft.address || ''} onChange={(e) => patch('address', e.target.value)} placeholder="Domicilio del contratante" className={inputClass} />
    <input value={draft.eventType || ''} onChange={(e) => patch('eventType', e.target.value)} placeholder="Tipo de evento" className={inputClass} />
    <input type="date" value={dateValue(draft.eventDate)} onChange={(e) => patch('eventDate', e.target.value)} className={inputClass} />
    <input type="time" value={timeValue(draft.eventTime)} onChange={(e) => patch('eventTime', e.target.value)} className={inputClass} />
    <input type="number" min="0" step="0.5" value={draft.serviceHours || 0} onChange={(e) => patch('serviceHours', Number(e.target.value))} placeholder="Horas de cobertura" className={inputClass} />
    <input value={draft.eventLocation || ''} onChange={(e) => patch('eventLocation', e.target.value)} placeholder="Lugar del evento" className={inputClass} />
    <input value={draft.packageName || ''} onChange={(e) => patch('packageName', e.target.value)} placeholder="Paquete" className={inputClass} />
    <input type="number" min="0" step="0.01" value={draft.totalAmount || 0} onChange={(e) => patch('totalAmount', Number(e.target.value))} placeholder="Total" className={inputClass} />
    <input type="number" min="0" step="0.01" value={draft.paidAmount || 0} onChange={(e) => patch('paidAmount', Number(e.target.value))} placeholder="Pagado" className={inputClass} />
    <input type="number" min="0" step="0.01" value={draft.estimatedCost || 0} onChange={(e) => patch('estimatedCost', Number(e.target.value))} placeholder="Costo estimado del evento" className={inputClass} />
    <input type="number" min="0" step="0.01" value={draft.allocatedAdCost || 0} onChange={(e) => patch('allocatedAdCost', Number(e.target.value))} placeholder="Publicidad asignada" className={inputClass} />
    <fieldset className="grid gap-3 rounded-2xl border border-sky-300/25 bg-sky-400/5 p-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4">
      <legend className="px-2 text-sm font-semibold text-sky-100">Detalles de la sesión previa</legend>
      <label className="flex items-center gap-2 rounded-xl border border-sky-200/20 bg-[#0B0F17] px-3 py-2.5 text-sm text-sky-50"><input type="checkbox" checked={Boolean(draft.preSessionApplies)} onChange={(e) => patch('preSessionApplies', e.target.checked)} />¿Incluye sesión previa?</label>
      <label className="text-xs text-sky-100">Fecha<input type="date" value={dateValue(draft.preSessionDate)} onChange={(e) => patch('preSessionDate', e.target.value)} disabled={!draft.preSessionApplies} className={`${inputClass} mt-1 disabled:cursor-not-allowed disabled:opacity-40`} /></label>
      <label className="text-xs text-sky-100">Horario<input type="time" value={timeValue(draft.preSessionTime)} onChange={(e) => patch('preSessionTime', e.target.value)} disabled={!draft.preSessionApplies} className={`${inputClass} mt-1 disabled:cursor-not-allowed disabled:opacity-40`} /></label>
      <label className="text-xs text-sky-100">Lugar<input value={draft.preSessionLocation || ''} onChange={(e) => patch('preSessionLocation', e.target.value)} disabled={!draft.preSessionApplies} placeholder="Lugar de la sesión" className={`${inputClass} mt-1 disabled:cursor-not-allowed disabled:opacity-40`} /></label>
    </fieldset>
    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-2.5 text-sm"><input type="checkbox" checked={Boolean(draft.inviteClientToCalendar)} onChange={(e) => patch('inviteClientToCalendar', e.target.checked)} disabled={!draft.email} />Invitar al cliente por correo</label>
    <select value={draft.status || 'Nuevo'} onChange={(e) => patch('status', e.target.value)} className={inputClass}>{['Nuevo','Contactado','Cotización enviada','Esperando respuesta','Seguimiento pendiente','Interesado','Negociación','Por cerrar','Seguimiento','Cierre prioritario','Contratado','No interesado','Sin interés','No responde','Archivado'].map((item) => <option key={item}>{item}</option>)}</select>
    <input value={draft.source || ''} onChange={(e) => patch('source', e.target.value)} placeholder="Fuente / anuncio" className={inputClass} />
    <input value={draft.campaign || ''} onChange={(e) => patch('campaign', e.target.value)} placeholder="Campaña publicitaria" className={inputClass} />
    <input type="date" value={(draft.firstContactAt || '').slice(0,10)} onChange={(e) => patch('firstContactAt', e.target.value)} className={inputClass} />
    <input type="date" value={(draft.lastContactAt || '').slice(0,10)} onChange={(e) => patch('lastContactAt', e.target.value)} className={inputClass} />
    <input value={draft.nextAction || ''} onChange={(e) => patch('nextAction', e.target.value)} placeholder="Próxima acción" className={inputClass} />
    <input type="datetime-local" value={(draft.nextActionAt || '').slice(0,16)} onChange={(e) => patch('nextActionAt', e.target.value)} className={inputClass} />
    <input type="number" min="0" step="1" value={draft.followUpAttempts || 0} onChange={(e) => patch('followUpAttempts', Number(e.target.value))} placeholder="Intentos de seguimiento" className={inputClass} />
    <input value={draft.objection || ''} onChange={(e) => patch('objection', e.target.value)} placeholder="Objeción o situación del cliente" className={inputClass} />
    <textarea value={draft.suggestedMessage || ''} onChange={(e) => patch('suggestedMessage', e.target.value)} placeholder="Mensaje de seguimiento sugerido" className={`${inputClass} min-h-24 sm:col-span-2`} />
    <textarea value={draft.lossReason || ''} onChange={(e) => patch('lossReason', e.target.value)} placeholder="Motivo de pérdida o archivo" className={`${inputClass} min-h-24 sm:col-span-2`} />
    <textarea value={draft.notes || ''} onChange={(e) => patch('notes', e.target.value)} placeholder="Notas" className={`${inputClass} min-h-24 sm:col-span-2 lg:col-span-4`} />
    <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button type="button" onClick={onCancel} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">Cancelar</button><button type="submit" disabled={busy} className="rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40">Guardar</button></div>
  </form>;
};

const expenseSuggestions: Record<ExpenseCategory, string[]> = {
  'Equipo y fotografía': ['Cámara', 'Lente', 'Memoria', 'Batería', 'Iluminación', 'Accesorio', 'Reparación de equipo'],
  'Maquillaje e insumos': ['Base', 'Sombras', 'Pestañas', 'Brochas', 'Desechables', 'Cabello y peinado'],
  'Transporte': ['Gasolina', 'Mantenimiento de motocicleta', 'Refacciones', 'Estacionamiento', 'Casetas', 'Taxi o aplicación'],
  'Comida': ['Alimentos en evento', 'Agua y bebidas', 'Comida de trabajo'],
  'Gastos personales': ['Retiro personal', 'Compra personal', 'Servicio personal'],
  'Publicidad': ['Meta Ads', 'Facebook Ads', 'Instagram Ads', 'Google Ads', 'Diseño publicitario'],
  'Otros del negocio': ['Impresiones', 'Proveedor', 'Software', 'Comisión', 'Otro'],
};

const ExpenseForm = ({ draft, clients, onChange, onSubmit, onCancel, busy }: { draft: Partial<BusinessExpense>; clients: CrmClient[]; onChange: (value: Partial<BusinessExpense>) => void; onSubmit: (event: React.FormEvent) => void; onCancel: () => void; busy: boolean }) => {
  const patch = (key: keyof BusinessExpense, value: unknown) => onChange({ ...draft, [key]: value, updatedAt: now() });
  return <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#161C28] p-5 sm:grid-cols-2 lg:grid-cols-4">
    <input type="date" value={draft.date || today()} onChange={(e) => patch('date', e.target.value)} className={inputClass} required />
    <select value={draft.category || 'Equipo y fotografía'} onChange={(e) => patch('category', e.target.value)} className={inputClass}>{expenseCategories.map((item) => <option key={item}>{item}</option>)}</select>
    <input list="xph-expense-subcategories" value={draft.subcategory || ''} onChange={(e) => patch('subcategory', e.target.value)} placeholder="Subcategoría" className={inputClass} />
    <datalist id="xph-expense-subcategories">{expenseSuggestions[(draft.category || 'Equipo y fotografía') as ExpenseCategory].map((item) => <option key={item} value={item} />)}</datalist>
    <input value={draft.concept || ''} onChange={(e) => patch('concept', e.target.value)} placeholder="Concepto" className={inputClass} required />
    <input value={draft.supplier || ''} onChange={(e) => patch('supplier', e.target.value)} placeholder="Proveedor" className={inputClass} />
    <input value={draft.paymentMethod || ''} onChange={(e) => patch('paymentMethod', e.target.value)} placeholder="Forma de pago" className={inputClass} />
    <select value={draft.account || 'Banco'} onChange={(e) => patch('account', e.target.value)} className={inputClass}><option>Banco</option><option>Efectivo</option><option>Bote de reserva</option><option>Otro</option></select>
    <select value={draft.paymentStatus || 'Pagado'} onChange={(e) => patch('paymentStatus', e.target.value)} className={inputClass}><option>Pagado</option><option>Pendiente</option></select>
    <input type="number" min="0.01" step="0.01" value={draft.amount || 0} onChange={(e) => patch('amount', Number(e.target.value))} placeholder="Monto" className={inputClass} required />
    <select value={draft.relatedClientId || ''} onChange={(e) => patch('relatedClientId', e.target.value)} className={inputClass}><option value="">Sin cliente relacionado</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name || client.phone}</option>)}</select>
    <input value={draft.receiptReference || ''} onChange={(e) => patch('receiptReference', e.target.value)} placeholder="Folio de ticket o factura" className={inputClass} />
    <textarea value={draft.notes || ''} onChange={(e) => patch('notes', e.target.value)} placeholder="Notas" className={`${inputClass} min-h-24 sm:col-span-2 lg:col-span-4`} />
    <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button type="button" onClick={onCancel} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">Cancelar</button><button type="submit" disabled={busy} className="rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40">{draft.id ? 'Actualizar gasto' : 'Guardar gasto'}</button></div>
  </form>;
};

const PaymentForm = ({ draft, receipt, clients, contracts, onChange, onReceipt, onSubmit, onCancel, busy }: { draft: Partial<BusinessPayment>; receipt: File | null; clients: CrmClient[]; contracts: BusinessContract[]; onChange: (value: Partial<BusinessPayment>) => void; onReceipt: (file: File | null) => void; onSubmit: (event: React.FormEvent) => void; onCancel: () => void; busy: boolean }) => {
  const patch = (key: keyof BusinessPayment, value: unknown) => onChange({ ...draft, [key]: value, updatedAt: now() });
  const clientContracts = contracts.filter((contract) => contract.clientId === draft.clientId);
  const selectedClient = clients.find((client) => client.id === draft.clientId);
  const packageTotal = Number(selectedClient?.totalAmount || 0);
  const applyInstallment = (installmentNumber: 1 | 2 | 3, percentage?: number) => {
    const nextPercentage = percentage ?? (installmentNumber === 3 ? 40 : 30);
    onChange({
      ...draft,
      installmentNumber,
      percentage: nextPercentage,
      concept: `Pago ${installmentNumber} de 3`,
      plannedAmount: Number(((packageTotal * nextPercentage) / 100).toFixed(2)),
      updatedAt: now(),
    });
  };
  return <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#161C28] p-5 sm:grid-cols-2 lg:grid-cols-4">
    <select value={draft.clientId || ''} onChange={(e) => { const client = clients.find((item) => item.id === e.target.value); const contract = contracts.find((item) => item.clientId === e.target.value); const percentage = Number(draft.percentage || 30); onChange({ ...draft, clientId: e.target.value, contractId: contract?.id || '', plannedAmount: Number((((Number(client?.totalAmount) || 0) * percentage) / 100).toFixed(2)) }); }} className={inputClass} required><option value="">Selecciona cliente</option>{clients.filter((client) => client.recordType === 'Cliente' || client.status === 'Contratado').map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
    <select value={draft.contractId || ''} onChange={(e) => patch('contractId', e.target.value)} className={inputClass}><option value="">Sin contrato relacionado</option>{clientContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.folio}</option>)}</select>
    <select value={draft.installmentNumber || 1} onChange={(e) => applyInstallment(Number(e.target.value) as 1 | 2 | 3)} className={inputClass} required><option value="1">Pago 1 de 3</option><option value="2">Pago 2 de 3</option><option value="3">Pago 3 de 3</option></select>
    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-gray-300"><input type="number" min="0.01" max="100" step="0.01" value={draft.percentage || 0} onChange={(e) => applyInstallment((draft.installmentNumber || 1) as 1 | 2 | 3, Number(e.target.value))} className="w-full bg-transparent py-2 outline-none" required /><span>%</span></label>
    <div className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 px-3 py-2 text-xs text-gray-300"><div>Paquete: <strong className="text-white">{money(packageTotal)}</strong></div><div>Este pago: <strong className="text-[#D4AF37]">{money(Number(draft.plannedAmount || 0))}</strong></div><div className="mt-1 text-gray-500">Sugerido: 30% · 30% · 40%</div></div>
    <input type="date" value={draft.date || today()} onChange={(e) => patch('date', e.target.value)} className={inputClass} required />
    <input type="date" value={draft.dueDate || ''} onChange={(e) => patch('dueDate', e.target.value)} className={inputClass} title="Fecha límite" />
    <input value={draft.concept || ''} onChange={(e) => patch('concept', e.target.value)} placeholder="Concepto: apartado, segundo pago, finiquito" className={inputClass} required />
    <input type="number" min="0.01" step="0.01" value={draft.plannedAmount || 0} readOnly placeholder="Monto programado" className={`${inputClass} opacity-80`} required />
    <input type="number" min="0" step="0.01" value={draft.receivedAmount || 0} onChange={(e) => patch('receivedAmount', Number(e.target.value))} placeholder="Monto recibido" className={inputClass} />
    <select value={draft.status || 'Pendiente'} onChange={(e) => patch('status', e.target.value)} className={inputClass}><option>Pendiente</option><option>Liquidado</option><option>Anulado</option></select>
    <input value={draft.method || ''} onChange={(e) => patch('method', e.target.value)} placeholder="Método de pago" className={inputClass} />
    <input value={draft.reference || ''} onChange={(e) => patch('reference', e.target.value)} placeholder="Referencia / folio" className={inputClass} />
    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-sm text-gray-300">{receipt?.name || draft.receiptFileName || 'Comprobante JPG, PNG o PDF'}<input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => onReceipt(e.target.files?.[0] || null)} /></label>
    <textarea value={draft.notes || ''} onChange={(e) => patch('notes', e.target.value)} placeholder="Notas" className={`${inputClass} min-h-20 lg:col-span-1`} />
    <p className="text-xs leading-5 text-gray-400 sm:col-span-2 lg:col-span-4">Los movimientos pendientes no aumentan el ingreso. Al cambiar a Liquidado se contabiliza únicamente el monto recibido; Anulado conserva el historial y revierte su efecto financiero.</p>
    <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button type="button" onClick={onCancel} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">Limpiar</button><button type="submit" disabled={busy} className="rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40">{draft.id ? 'Actualizar pago' : 'Registrar pago'}</button></div>
  </form>;
};
