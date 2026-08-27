import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCopy,
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
  finalizeBusinessContract,
  loadBusinessSnapshot,
  saveBusinessExpense,
  saveCrmClient,
  saveOwnerSignature,
  uploadBusinessContract,
  adminContractPdfUrl,
} from '../utils/adminApi';
import {
  BusinessContract,
  BusinessExpense,
  BusinessSnapshot,
  CrmClient,
  ExpenseCategory,
} from '../types/business';
import { SignaturePad } from './SignaturePad';

type BusinessTab = 'overview' | 'clients' | 'expenses' | 'contracts';

const emptySnapshot: BusinessSnapshot = { clients: [], expenses: [], contracts: [], ownerSignatureConfigured: false };
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
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
  const [clientDraft, setClientDraft] = useState<Partial<CrmClient>>(blankClient);
  const [expenseDraft, setExpenseDraft] = useState<Partial<BusinessExpense>>(blankExpense);
  const [contractDraft, setContractDraft] = useState({ clientId: '', folio: '', eventType: '', eventDate: '', file: null as File | null });
  const [latestLink, setLatestLink] = useState('');
  const [ownerSignature, setOwnerSignature] = useState('');
  const [query, setQuery] = useState('');

  const refresh = async () => {
    setBusy(true);
    try {
      setSnapshot(await loadBusinessSnapshot());
    } catch (error: any) {
      notify(error?.message || 'No se pudo cargar el control del negocio.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return snapshot.clients;
    return snapshot.clients.filter((client) => [client.name, client.phone, client.eventType, client.packageName, client.status]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [query, snapshot.clients]);

  const totals = useMemo(() => snapshot.clients.reduce((acc, client) => {
    acc.sales += Number(client.totalAmount) || 0;
    acc.paid += Number(client.paidAmount) || 0;
    return acc;
  }, { sales: 0, paid: 0 }), [snapshot.clients]);

  const financials = useMemo(() => {
    const contractedClients = snapshot.clients.filter((client) => client.recordType === 'Cliente' || client.status === 'Contratado');
    const contracted = contractedClients.reduce((sum, client) => sum + (Number(client.totalAmount) || 0), 0);
    const collected = contractedClients.reduce((sum, client) => sum + Math.min(Number(client.paidAmount) || 0, Number(client.totalAmount) || 0), 0);
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
  }, [snapshot.clients, snapshot.expenses]);

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
      setSnapshot((prev) => ({ ...prev, clients: [saved, ...prev.clients.filter((item) => item.id !== saved.id)] }));
      setClientDraft(blankClient());
      setShowClientForm(false);
      notify('Registro guardado en el CRM.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar el registro.'); }
    finally { setBusy(false); }
  };

  const saveExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await saveBusinessExpense(expenseDraft);
      setSnapshot((prev) => ({ ...prev, expenses: [saved, ...prev.expenses.filter((item) => item.id !== saved.id)] }));
      setExpenseDraft(blankExpense());
      setShowExpenseForm(false);
      notify(expenseDraft.id ? 'Gasto actualizado.' : 'Gasto registrado.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar el gasto.'); }
    finally { setBusy(false); }
  };

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
          { id: 'clients' as const, label: 'Clientes y prospectos', icon: Users },
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

      {tab === 'clients' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, teléfono, evento o estado" className="w-full max-w-xl rounded-xl border border-white/10 bg-[#161C28] px-4 py-3 text-sm" />
            <button onClick={() => { setClientDraft(blankClient()); setShowClientForm(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black"><Plus className="h-4 w-4" />Nuevo registro</button>
          </div>
          {showClientForm && <ClientForm draft={clientDraft} onChange={setClientDraft} onSubmit={saveClient} onCancel={() => setShowClientForm(false)} busy={busy} />}
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#161C28]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-black/20 text-xs uppercase tracking-wider text-[#D4AF37]"><tr><th className="p-4">Contacto</th><th className="p-4">Evento</th><th className="p-4">Estado</th><th className="p-4">Importes</th><th className="p-4">Próxima acción</th><th className="p-4"></th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {filteredClients.map((client) => <tr key={client.id} className="align-top">
                  <td className="p-4"><div className="font-semibold text-white">{client.name || 'Sin nombre'}</div><div className="text-xs text-gray-400">{client.phone || 'Sin teléfono'} · {client.recordType}</div></td>
                  <td className="p-4"><div>{client.eventType || 'Por confirmar'}</div><div className="text-xs text-gray-400">{client.eventDate || 'Sin fecha'} · {client.eventLocation || 'Sin lugar'}</div></td>
                  <td className="p-4"><span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-xs text-[#F5D76E]">{client.status}</span></td>
                  <td className="p-4"><div>{money(client.totalAmount)}</div><div className="text-xs text-emerald-300">Pagado {money(client.paidAmount)}</div><div className="text-xs text-amber-300">Pendiente {money(Math.max(0, client.totalAmount - client.paidAmount))}</div></td>
                  <td className="p-4"><div>{client.nextAction || 'Sin acción'}</div><div className="text-xs text-gray-400">{client.nextActionAt || 'Sin fecha'}</div></td>
                  <td className="p-4"><button onClick={() => { setClientDraft(client); setShowClientForm(true); }} className="text-xs text-[#D4AF37]">Editar</button></td>
                </tr>)}
                {!filteredClients.length && <tr><td colSpan={6} className="p-10 text-center text-gray-500">Aún no hay registros. Agrega el primer prospecto o cliente.</td></tr>}
              </tbody>
            </table>
          </div>
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
    <input type="date" value={draft.eventDate || ''} onChange={(e) => patch('eventDate', e.target.value)} className={inputClass} />
    <input type="time" value={draft.eventTime || ''} onChange={(e) => patch('eventTime', e.target.value)} className={inputClass} />
    <input type="number" min="0" step="0.5" value={draft.serviceHours || 0} onChange={(e) => patch('serviceHours', Number(e.target.value))} placeholder="Horas de cobertura" className={inputClass} />
    <input value={draft.eventLocation || ''} onChange={(e) => patch('eventLocation', e.target.value)} placeholder="Lugar del evento" className={inputClass} />
    <input value={draft.packageName || ''} onChange={(e) => patch('packageName', e.target.value)} placeholder="Paquete" className={inputClass} />
    <input type="number" min="0" step="0.01" value={draft.totalAmount || 0} onChange={(e) => patch('totalAmount', Number(e.target.value))} placeholder="Total" className={inputClass} />
    <input type="number" min="0" step="0.01" value={draft.paidAmount || 0} onChange={(e) => patch('paidAmount', Number(e.target.value))} placeholder="Pagado" className={inputClass} />
    <input type="number" min="0" step="0.01" value={draft.estimatedCost || 0} onChange={(e) => patch('estimatedCost', Number(e.target.value))} placeholder="Costo estimado del evento" className={inputClass} />
    <input type="number" min="0" step="0.01" value={draft.allocatedAdCost || 0} onChange={(e) => patch('allocatedAdCost', Number(e.target.value))} placeholder="Publicidad asignada" className={inputClass} />
    <select value={draft.status || 'Nuevo'} onChange={(e) => patch('status', e.target.value)} className={inputClass}>{['Nuevo','Contactado','Cotización enviada','Seguimiento','Cierre prioritario','Contratado','No interesado','Archivado'].map((item) => <option key={item}>{item}</option>)}</select>
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
