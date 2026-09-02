import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  CreditCard,
  Eye,
  FileSignature,
  Loader2,
  Mail,
  PenLine,
  Plus,
  RefreshCw,
  Save,
  Send,
  TrendingUp,
  Trash2,
  Users,
  UserCog,
  UserCircle,
  X,
} from 'lucide-react';
import {
  createContractSigningLink,
  createGeneratedBusinessContract,
  deleteBusinessContract,
  cacheBusinessClients,
  cacheBusinessSnapshot,
  convertProspectToClient,
  createCrmFollowUp,
  finalizeBusinessContract,
  loadBusinessSnapshot,
  loadAdminContractDocument,
  readCachedBusinessSnapshot,
  saveBusinessExpense,
  saveBusinessPayment,
  saveFinancialAdjustment,
  saveCrmClient,
  syncClientCalendar,
  syncAllClientCalendars,
  saveOwnerSignature,
  saveInternalCalendarEvent,
  uploadBusinessContract,
  adminContractPdfUrl,
  markNotification,
  AdminSession,
} from '../utils/adminApi';
import {
  BusinessContract,
  BusinessExpense,
  BusinessPayment,
  BusinessSnapshot,
  CrmClient,
  CrmFollowUp,
  ExpenseCategory,
  FinancialAdjustment,
  FinancialAdjustmentCategory,
  InternalCalendarEvent,
  ContractDocumentSnapshot,
} from '../types/business';
import { SignaturePad } from './SignaturePad';
import { ClientOperationsPanel } from './ClientOperationsPanel';
import { TeamAdminPanel } from './TeamAdminPanel';
import { GmailAdminPanel } from './GmailAdminPanel';
import { calculateFinancialSummary, collectedForClient, collectedPaymentAmount, isOverduePayment, pendingPaymentAmount } from '../utils/financialRules.js';
import { ContractDocument } from './ContractDocument';

const SalesExecutionCenter = React.lazy(() => import('./SalesExecutionCenter'));

export type BusinessTab = 'overview' | 'execution' | 'prospects' | 'clients' | 'calendar' | 'payments' | 'expenses' | 'contracts' | 'email' | 'team' | 'account';

const emptySnapshot: BusinessSnapshot = { clients: [], followUps: [], expenses: [], payments: [], transactions: [], adjustments: [], packageSnapshots: [], services: [], addons: [], users: [], teamFunctions: [], assignments: [], gmailConfig: null, emailTemplates: [], emailHistory: [], notifications: [], auditLog: [], galleries: [], internalEvents: [], contracts: [], ownerSignatureConfigured: false };
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const dateValue = (value?: string) => String(value || '').slice(0, 10);
const dateTimeLocalValue = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00`;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  return match ? `${match[1]}T${match[2]}:${match[3]}` : '';
};
const dayDifference = (value?: string) => {
  const date = dateValue(value);
  if (!date) return Number.POSITIVE_INFINITY;
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - base.getTime()) / 86_400_000);
};
const timeValue = (value?: string) => {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  const parsed = new Date(raw.replace(/\.$/, 'Z'));
  if (Number.isNaN(parsed.getTime())) return '';
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
};
const timeDisplay = (value?: string) => {
  const normalized = timeValue(value);
  if (!normalized) return '';
  const [hourText, minute] = normalized.split(':');
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'p. m.' : 'a. m.'}`;
};
const dateTimeDisplay = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const isoDateTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (isoDateTime) {
    const [, year, month, day, hour, minute] = isoDateTime;
    return `${day}/${month}/${year} · ${timeDisplay(`${hour}:${minute}`)}`;
  }
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return `${day}/${month}/${year}`;
  }
  const englishDateTime = raw.match(/^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{4}) (\d{2}):(\d{2})/);
  if (englishDateTime) {
    const [, monthName, day, year, hour, minute] = englishDateTime;
    const month = String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(monthName) + 1).padStart(2, '0');
    return `${String(Number(day)).padStart(2, '0')}/${month}/${year} · ${timeDisplay(`${hour}:${minute}`)}`;
  }
  return raw.replace('T', ' · ');
};
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const localDateKey = (date: Date) => `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
const monthLabel = (date: Date) => new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(date);
const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);
const contractPdfRevision = (contract: BusinessContract) => contract.updatedAt || contract.finalDocumentHash || contract.status;
const contractViewLabel = (contract: BusinessContract) => contract.status === 'Finalizado'
  ? 'Ver contrato final con firmas'
  : contract.status === 'Firmado por cliente'
    ? 'Ver contrato con firma del cliente'
    : 'Ver contrato';

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
  internalNotes: '',
  providerNotes: '',
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
  status: 'Pendiente', method: '', reference: '', notes: '', paidAt: '', recordedBy: 'Admin XPH',
});

const blankInternalEvent = (): Partial<InternalCalendarEvent> => ({ title: '', activityType: 'Junta', startDate: today(), startTime: '', endDate: today(), endTime: '', location: '', notes: '', visibility: 'SUPER_ADMIN', userIds: [], status: 'ACTIVO' });

const adjustmentCategories: FinancialAdjustmentCategory[] = ['Gasto no registrado', 'Pendiente por identificar', 'Ajuste financiero', 'Otro'];

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
  session: AdminSession;
  refreshSignal?: number;
  activeTab?: BusinessTab;
  onActiveTabChange?: (tab: BusinessTab) => void;
}

export const BusinessAdminPanel: React.FC<Props> = ({ notify, session, refreshSignal = 0, activeTab, onActiveTabChange }) => {
  const snapshotCacheScope = `${session.role}:${session.userId || session.email || 'unknown'}`;
  const [internalTab, setInternalTab] = useState<BusinessTab>('overview');
  const tab = activeTab ?? internalTab;
  const setTab = (nextTab: BusinessTab) => {
    setInternalTab(nextTab);
    onActiveTabChange?.(nextTab);
  };
  const [snapshot, setSnapshot] = useState<BusinessSnapshot>(() => readCachedBusinessSnapshot(snapshotCacheScope) || emptySnapshot);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAllCalendars, setSyncingAllCalendars] = useState(false);
  const [syncingClientId, setSyncingClientId] = useState('');
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [focusedNotificationId, setFocusedNotificationId] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showInlinePayment, setShowInlinePayment] = useState(false);
  const [clientDraft, setClientDraft] = useState<Partial<CrmClient>>(blankClient);
  const [expenseDraft, setExpenseDraft] = useState<Partial<BusinessExpense>>(blankExpense);
  const [paymentDraft, setPaymentDraft] = useState<Partial<BusinessPayment>>(blankPayment);
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null);
  const [realBalance, setRealBalance] = useState('');
  const [adjustmentCategory, setAdjustmentCategory] = useState<FinancialAdjustmentCategory>('Pendiente por identificar');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [contractDraft, setContractDraft] = useState({ clientId: '', folio: '', eventType: '', eventDate: '', documentType: 'CONTRATO' as 'CONTRATO' | 'COTIZACION', paymentPolicy: '40-30-30' as '40-30-30' | 'PERSONALIZADA', file: null as File | null });
  const [latestLink, setLatestLink] = useState('');
  const [contractPreview, setContractPreview] = useState<BusinessContract | null>(null);
  const [ownerSignature, setOwnerSignature] = useState('');
  const [query, setQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [recordReturnTab, setRecordReturnTab] = useState<BusinessTab>('clients');
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [calendarAudience, setCalendarAudience] = useState<'clients' | 'prospects'>('clients');
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day' | 'upcoming'>('month');
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [modalNotice, setModalNotice] = useState('');
  const [notificationPendingId, setNotificationPendingId] = useState('');
  const [followUpDraft, setFollowUpDraft] = useState<Partial<CrmFollowUp>>({ occurredAt: now(), conversation: '', result: '', nextAction: '', nextActionAt: '' });
  const [internalEventDraft, setInternalEventDraft] = useState<Partial<InternalCalendarEvent> | null>(null);

  const refresh = async (force = true) => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const complete = await loadBusinessSnapshot(force);
      cacheBusinessClients(complete.clients);
      setSnapshot(complete);
    } catch (error: any) {
      notify(error?.message || 'No se pudo cargar el control del negocio.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { refresh(false); }, []);
  useEffect(() => { if (refreshSignal > 0) refresh(true); }, [refreshSignal]);
  useEffect(() => { cacheBusinessSnapshot(snapshot, snapshotCacheScope); }, [snapshot, snapshotCacheScope]);
  useEffect(() => {
    if (session.role === 'SUPER_ADMIN') return;
    if (session.permissions.includes('CALENDAR')) setTab('calendar');
    else if (session.permissions.includes('CLIENTS_READ') || session.permissions.includes('CRM_READ')) setTab('clients');
    else setTab('account');
  }, [session.role]);

  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    const records = snapshot.clients.filter((client) => tab === 'prospects' ? client.recordType === 'Prospecto' : client.recordType === 'Cliente');
    if (!term) return records;
    return records.filter((client) => [client.name, client.phone, client.eventType, client.packageName, client.status]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [query, snapshot.clients, tab]);

  const financials = useMemo(() => calculateFinancialSummary(snapshot), [snapshot]);
  const dashboardStats = useMemo(() => {
    const prospects = snapshot.clients.filter((item) => item.recordType === 'Prospecto' && !['Contratado', 'Sin interés', 'No interesado', 'Archivado'].includes(item.status));
    const clients = snapshot.clients.filter((item) => item.recordType === 'Cliente' && item.status !== 'Archivado');
    const assignmentConflicts = snapshot.assignments.filter((item) => item.status !== 'CANCELADA').reduce((count, item, index, list) => count + list.slice(index + 1).filter((other) => other.status !== 'CANCELADA' && other.userId === item.userId && `${other.startDate}T${other.startTime || '00:00'}` < `${item.endDate || item.startDate}T${item.endTime || '23:59'}` && `${other.endDate || other.startDate}T${other.endTime || '23:59'}` > `${item.startDate}T${item.startTime || '00:00'}`).length, 0);
    return {
      prospectsActive: prospects.length,
      followUpsToday: prospects.filter((item) => dateValue(item.nextActionAt) === today()).length,
      followUpsOverdue: prospects.filter((item) => dateValue(item.nextActionAt) && dateValue(item.nextActionAt) < today()).length,
      prospectsClosing: prospects.filter((item) => ['Negociación', 'Por cerrar', 'Cierre prioritario'].includes(item.status)).length,
      clientsActive: clients.length,
      upcomingEvents: clients.filter((item) => dayDifference(item.eventDate) >= 0).length,
      sessionsPending: clients.filter((item) => item.preSessionApplies && (!item.preSessionDate || item.preSessionStatus === 'Pendiente por agendar')).length,
      servicesPending: snapshot.services.filter((item) => item.included && ['Pendiente', 'Programado'].includes(item.status)).length,
      eventsToday: clients.filter((item) => dateValue(item.eventDate) === today()).length + snapshot.internalEvents.filter((item) => item.status === 'ACTIVO' && dateValue(item.startDate) === today()).length,
      eventsWeek: clients.filter((item) => { const diff = dayDifference(item.eventDate); return diff >= 0 && diff <= 7; }).length,
      conflicts: assignmentConflicts,
    };
  }, [snapshot]);

  const paidForClient = (client: CrmClient) => {
    return collectedForClient(client, snapshot.payments, snapshot.transactions);
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
      setModalNotice('Registro guardado en el CRM.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo guardar el registro.'); }
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
      setModalNotice(isEditing ? 'Gasto actualizado correctamente' : 'Gasto registrado correctamente');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo guardar el gasto.'); }
    finally { setBusy(false); }
  };

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await saveBusinessPayment(paymentDraft, paymentReceipt);
      setSnapshot((prev) => ({
        ...prev,
        clients: result.client ? prev.clients.map((item) => item.id === result.client.id ? result.client : item) : prev.clients,
        payments: [result.payment, ...prev.payments.filter((item) => item.id !== result.payment.id)],
        transactions: result.transaction ? [result.transaction, ...prev.transactions.filter((item) => item.id !== result.transaction.id)] : prev.transactions,
      }));
      setPaymentDraft(blankPayment());
      setPaymentReceipt(null);
      setShowInlinePayment(false);
      setModalNotice(paymentDraft.id ? 'Pago actualizado y conciliado.' : 'Pago registrado y conciliado.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo guardar el pago.'); }
    finally { setBusy(false); }
  };

  const reconcileBalance = async (event: React.FormEvent) => {
    event.preventDefault();
    const actual = Number(realBalance);
    if (!Number.isFinite(actual)) return setModalNotice('Captura el balance real de banco o efectivo.');
    const difference = Number((actual - financials.balanceCalculated).toFixed(2));
    if (Math.abs(difference) < 0.005) return setModalNotice('El balance real ya coincide con el balance calculado; no hace falta crear un ajuste.');
    setBusy(true);
    try {
      const saved = await saveFinancialAdjustment({
        date: today(),
        category: adjustmentCategory,
        concept: `Conciliación: balance real ${money(actual)}`,
        amount: difference,
        notes: adjustmentNotes,
        status: 'ACTIVO',
        createdBy: 'Admin XPH',
      });
      setSnapshot((previous) => ({ ...previous, adjustments: [saved, ...previous.adjustments.filter((item) => item.id !== saved.id)] }));
      setRealBalance('');
      setAdjustmentNotes('');
      setModalNotice(`Ajuste de conciliación ${money(difference)} registrado sin alterar movimientos anteriores.`);
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo guardar la conciliación.'); }
    finally { setBusy(false); }
  };

  const updateAdjustment = async (adjustment: FinancialAdjustment, status: FinancialAdjustment['status']) => {
    setBusy(true);
    try {
      const saved = await saveFinancialAdjustment({ ...adjustment, status });
      setSnapshot((previous) => ({ ...previous, adjustments: previous.adjustments.map((item) => item.id === saved.id ? saved : item) }));
      setModalNotice(status === 'ANULADO' ? 'Ajuste anulado; el historial se conserva.' : 'Ajuste reactivado.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo actualizar el ajuste.'); }
    finally { setBusy(false); }
  };

  const updateNotificationStatus = async (notificationId: string, status: 'PENDIENTE' | 'LEIDA' | 'RESUELTA' = 'LEIDA') => {
    if (notificationPendingId) return;
    setNotificationPendingId(notificationId);
    try {
      const saved = await markNotification(notificationId, status);
      setSnapshot((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === saved.id ? saved : item) }));
    } catch (error: any) {
      setModalNotice(error?.message || 'No se pudo actualizar la notificación.');
    } finally {
      setNotificationPendingId('');
    }
  };

  const syncCalendar = async (client: CrmClient) => {
    if (syncingClientId) return;
    setSyncingClientId(client.id);
    try {
      const saved = await syncClientCalendar(client);
      setSnapshot((prev) => ({ ...prev, clients: prev.clients.map((item) => item.id === saved.id ? saved : item) }));
      setModalNotice('Calendar fue rectificado: se actualizó el evento válido y se eliminaron duplicados verificados.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo sincronizar Google Calendar.'); }
    finally { setSyncingClientId(''); }
  };

  const syncAllCalendars = async () => {
    const records = snapshot.clients.filter((item) => item.recordType === 'Cliente' && (dateValue(item.eventDate) || dateValue(item.preSessionDate) || item.calendarEventId || item.preSessionCalendarEventId));
    if (!records.length) return setModalNotice('No hay eventos o sesiones con fecha para sincronizar.');
    if (syncingAllCalendars) return;
    setSyncingAllCalendars(true);
    try {
      const result = await syncAllClientCalendars();
      setSnapshot((current) => ({ ...current, clients: current.clients.map((item) => result.clients.find((saved) => saved.id === item.id) || item) }));
      const summary = result.summary;
      setModalNotice(`${summary.synchronized} expediente(s) reconciliados. ${summary.created} evento(s) creados, ${summary.updated} actualizados y ${summary.duplicatesDeleted} duplicado(s) verificado(s) eliminados.${summary.failed ? ` ${summary.failed} operación(es) requieren revisión.` : ''}`);
    } catch (error: any) {
      setModalNotice(error?.message || 'No se pudo reconciliar Google Calendar.');
    } finally {
      setSyncingAllCalendars(false);
    }
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
      const currentIndex = followUpQueue.findIndex((item) => item.id === selectedClient.id);
      const nextRecord = followUpQueue[currentIndex + 1] || followUpQueue[0];
      if (nextRecord && nextRecord.id !== selectedClient.id) setSelectedClientId(nextRecord.id);
      notify(nextRecord && nextRecord.id !== selectedClient.id ? 'Seguimiento guardado. Mostrando el siguiente prospecto.' : 'Seguimiento agregado al historial.');
    } catch (error: any) { notify(error?.message || 'No se pudo registrar el seguimiento.'); }
    finally { setBusy(false); }
  };

  const saveInlineClient = async (patch: Partial<CrmClient>) => {
    if (!selectedClient) return;
    const before = selectedClient;
    const optimistic = { ...selectedClient, ...patch, updatedAt: now() };
    setSnapshot((previous) => {
      const clients = previous.clients.map((item) => item.id === optimistic.id ? optimistic : item);
      cacheBusinessClients(clients);
      return { ...previous, clients };
    });
    try {
      const saved = await saveCrmClient(optimistic);
      let confirmed = saved;
      const calendarFields = ['eventDate', 'eventTime', 'eventLocation', 'preSessionApplies', 'preSessionDate', 'preSessionTime', 'preSessionEndTime', 'preSessionLocation', 'preSessionAddress', 'preSessionType', 'preSessionStatus', 'preSessionNotes'];
      const affectsCalendar = Object.keys(patch).some((key) => calendarFields.includes(key));
      setSnapshot((previous) => {
        const clients = previous.clients.map((item) => item.id === saved.id ? saved : item);
        cacheBusinessClients(clients);
        return { ...previous, clients };
      });
      if (affectsCalendar) {
        try {
          confirmed = await syncClientCalendar(saved);
        } catch (calendarError: any) {
          setModalNotice(`Los cambios sí se guardaron en el CRM, pero Google Calendar no pudo actualizarse: ${calendarError?.message || 'error de sincronización'}`);
          return;
        }
      }
      setSnapshot((previous) => {
        const clients = previous.clients.map((item) => item.id === confirmed.id ? confirmed : item);
        cacheBusinessClients(clients);
        return { ...previous, clients };
      });
      setModalNotice(affectsCalendar ? 'Cambios guardados y sincronizados con Google Calendar.' : 'Cambios guardados correctamente.');
    } catch (error: any) {
      setSnapshot((previous) => {
        const clients = previous.clients.map((item) => item.id === before.id ? before : item);
        cacheBusinessClients(clients);
        return { ...previous, clients };
      });
      setModalNotice(error?.message || 'No se pudieron actualizar los datos.');
    }
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
    const nextNumber = Math.max(0, ...existing.map((payment) => Number(payment.installmentNumber) || 0)) + 1;
    const plannedAlready = existing.reduce((sum, payment) => sum + Number(payment.plannedAmount || 0), 0);
    const remainingPlan = Math.max(0, Number(client.totalAmount || 0) - plannedAlready);
    const percentage = Number(client.totalAmount || 0) > 0 ? Number(((remainingPlan / Number(client.totalAmount)) * 100).toFixed(2)) : 0;
    const contract = snapshot.contracts.find((item) => item.clientId === client.id);
    setPaymentDraft({ ...blankPayment(client.id, contract?.id || ''), installmentNumber: nextNumber, percentage, concept: `Pago ${nextNumber}`, plannedAmount: remainingPlan });
    setShowInlinePayment(true);
  };

  const editClientPayment = (payment: BusinessPayment) => {
    setPaymentDraft({ ...payment });
    setPaymentReceipt(null);
    setShowInlinePayment(true);
  };

  const preparePaymentStatus = (payment: BusinessPayment, status: BusinessPayment['status']) => {
    setPaymentDraft({
      ...payment,
      status,
      receivedAmount: status === 'Pendiente' ? 0 : status === 'Liquidado' ? Number(payment.plannedAmount || 0) : payment.receivedAmount,
      paidAt: status === 'Pendiente' ? '' : payment.paidAt || now().slice(0, 16),
    });
    setPaymentReceipt(null);
    setTab('payments');
  };

  const openClientDetails = (client: CrmClient) => {
    setRecordReturnTab(tab);
    setSelectedClientId(client.id);
    setShowClientForm(false);
    setShowInlinePayment(false);
    setTab(client.recordType === 'Prospecto' ? 'prospects' : 'clients');
  };

  const closeClientDetails = () => {
    setSelectedClientId('');
    setShowClientForm(false);
    setShowInlinePayment(false);
    setPaymentDraft(blankPayment());
    setPaymentReceipt(null);
    setTab(recordReturnTab);
  };

  const openNotificationAction = async (notificationId: string) => {
    const notification = snapshot.notifications.find((item) => item.id === notificationId);
    if (!notification) return;
    const relatedPayment = snapshot.payments.find((item) => item.id === notification.relatedId);
    const client = snapshot.clients.find((item) => item.id === notification.relatedId || item.id === relatedPayment?.clientId);
    setNotificationMenuOpen(false);
    setFocusedNotificationId(notification.id);
    if (client) openClientDetails(client);
    else setTab(notification.type.startsWith('PAGO_') ? 'payments' : 'overview');
    if (notification.status === 'PENDIENTE') await updateNotificationStatus(notification.id, 'LEIDA');
  };

  const updateProspectStage = async (client: CrmClient, status: CrmClient['status']) => {
    if (client.recordType !== 'Prospecto' || client.status === status) return;
    setBusy(true);
    try {
      const saved = await saveCrmClient({ ...client, status });
      setSnapshot((current) => ({ ...current, clients: current.clients.map((item) => item.id === saved.id ? saved : item) }));
      setModalNotice(`${client.name || 'El prospecto'} ahora está en “${status}”.`);
    } catch (error: any) {
      setModalNotice(error?.message || 'No se pudo actualizar la etapa comercial.');
    } finally {
      setBusy(false);
    }
  };

  const selectedClient = snapshot.clients.find((client) => client.id === selectedClientId);
  const followUpQueue = [...snapshot.clients]
    .filter((client) => client.recordType === 'Prospecto' && !['Contratado', 'Sin interés', 'No interesado', 'Archivado'].includes(client.status))
    .sort((a, b) => String(a.nextActionAt || '9999').localeCompare(String(b.nextActionAt || '9999')) || String(a.name || '').localeCompare(String(b.name || '')));
  const selectedFollowUpIndex = selectedClient ? followUpQueue.findIndex((item) => item.id === selectedClient.id) : -1;
  const openQueuedFollowUp = (offset: number) => {
    if (selectedFollowUpIndex < 0 || !followUpQueue.length) return;
    const nextIndex = (selectedFollowUpIndex + offset + followUpQueue.length) % followUpQueue.length;
    setSelectedClientId(followUpQueue[nextIndex].id);
    setFollowUpDraft({ occurredAt: now(), conversation: '', result: '', nextAction: '', nextActionAt: '' });
  };
  const currentTeamUser = snapshot.users.find((user) => user.id === session.userId);
  const canEditSelected = Boolean(selectedClient && (session.role === 'SUPER_ADMIN' || (selectedClient.recordType === 'Prospecto' ? session.permissions.includes('CRM_WRITE') : session.permissions.includes('CLIENTS_WRITE'))));
  const canCreateCurrentType = session.role === 'SUPER_ADMIN' || (tab === 'prospects' ? session.permissions.includes('CRM_WRITE') : session.permissions.includes('CLIENTS_WRITE'));
  const canManageFinance = session.role === 'SUPER_ADMIN';
  const pendingNotificationCount = snapshot.notifications.filter((item) => item.status === 'PENDIENTE').length;
  const visibleNotifications = snapshot.notifications.filter((item) => item.status !== 'ANULADA').slice(0, 20);
  const selectedClientPayments = selectedClient ? snapshot.payments
    .filter((payment) => payment.clientId === selectedClient.id)
    .sort((a, b) => String(b.paidAt || b.date || b.updatedAt).localeCompare(String(a.paidAt || a.date || a.updatedAt))) : [];
  const returnLabel = recordReturnTab === 'execution'
    ? 'Centro de ejecución'
    : recordReturnTab === 'prospects'
      ? 'Prospectos'
      : recordReturnTab === 'calendar'
        ? 'Calendario'
        : recordReturnTab === 'payments'
          ? 'Pagos'
          : 'Clientes';
  const selectedClientContract = selectedClient ? snapshot.contracts.find((contract) => contract.clientId === selectedClient.id) : undefined;
  const selectedFollowUps = selectedClient ? snapshot.followUps.filter((item) => item.prospectId === selectedClient.id || item.clientId === selectedClient.id).sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))) : [];
  const calendarRecords = [...snapshot.clients]
    .filter((client) => calendarAudience === 'clients'
      ? client.recordType === 'Cliente' && (dateValue(client.eventDate) || (client.preSessionApplies && dateValue(client.preSessionDate)))
      : client.recordType === 'Prospecto' && dateValue(client.nextActionAt))
    .sort((a, b) => {
      const aDate = calendarAudience === 'clients' ? dateValue(a.eventDate || a.preSessionDate) : dateValue(a.nextActionAt);
      const bDate = calendarAudience === 'clients' ? dateValue(b.eventDate || b.preSessionDate) : dateValue(b.nextActionAt);
      return aDate.localeCompare(bDate);
    });
  const calendarEntries = useMemo(() => snapshot.clients.flatMap((client) => {
    const entries: Array<{ client: CrmClient; kind: 'event' | 'session' | 'followup'; date: string; time: string }> = [];
    if (calendarAudience === 'prospects') {
      if (client.recordType === 'Prospecto' && dateValue(client.nextActionAt)) entries.push({ client, kind: 'followup', date: dateValue(client.nextActionAt), time: timeValue(client.nextActionAt) });
      return entries;
    }
    if (client.recordType !== 'Cliente') return entries;
    if (dateValue(client.eventDate)) entries.push({ client, kind: 'event', date: dateValue(client.eventDate), time: timeValue(client.eventTime) });
    if (client.preSessionApplies && dateValue(client.preSessionDate)) entries.push({ client, kind: 'session', date: dateValue(client.preSessionDate), time: timeValue(client.preSessionTime) });
    return entries;
  }).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [snapshot.clients, calendarAudience]);
  const calendarDays = useMemo(() => {
    const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = localDateKey(date);
      return { date, key, currentMonth: date.getMonth() === calendarCursor.getMonth(), entries: calendarEntries.filter((entry) => entry.date === key), internalEntries: snapshot.internalEvents.filter((entry) => entry.status === 'ACTIVO' && dateValue(entry.startDate) === key) };
    });
  }, [calendarCursor, calendarEntries, snapshot.internalEvents]);
  const mobileMonthEntries = calendarEntries.filter((entry) => entry.date.startsWith(monthKey(calendarCursor)));
  const visibleCalendarEntries = useMemo(() => {
    if (calendarView === 'month') return mobileMonthEntries;
    if (calendarView === 'day') return calendarEntries.filter((entry) => entry.date === localDateKey(calendarCursor));
    if (calendarView === 'upcoming') return calendarEntries.filter((entry) => entry.date >= localDateKey(new Date()));
    const start = new Date(calendarCursor);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    return calendarEntries.filter((entry) => entry.date >= startKey && entry.date <= endKey);
  }, [calendarEntries, calendarCursor, calendarView]);
  const visibleInternalEvents = useMemo(() => snapshot.internalEvents.filter((entry) => {
    if (entry.status !== 'ACTIVO') return false;
    const date = dateValue(entry.startDate);
    if (calendarView === 'month') return date.startsWith(monthKey(calendarCursor));
    if (calendarView === 'day') return date === localDateKey(calendarCursor);
    if (calendarView === 'upcoming') return date >= localDateKey(new Date());
    const start = new Date(calendarCursor); start.setDate(start.getDate() - start.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return date >= localDateKey(start) && date <= localDateKey(end);
  }).sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`)), [snapshot.internalEvents, calendarCursor, calendarView]);
  const moveCalendar = (direction: -1 | 1) => setCalendarCursor((value) => {
    const next = new Date(value);
    if (calendarView === 'month') return new Date(value.getFullYear(), value.getMonth() + direction, 1);
    next.setDate(value.getDate() + direction * (calendarView === 'week' ? 7 : 1));
    return next;
  });

  const persistInternalEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!internalEventDraft) return;
    setBusy(true);
    try {
      const saved = await saveInternalCalendarEvent(internalEventDraft);
      setSnapshot((current) => ({ ...current, internalEvents: [saved, ...current.internalEvents.filter((item) => item.id !== saved.id)] }));
      setInternalEventDraft(null);
      setModalNotice('Evento interno guardado y sincronizado con Google Calendar.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo guardar el evento interno.'); }
    finally { setBusy(false); }
  };

  const getContractDataChecklist = (client?: CrmClient) => {
    if (!client) return [];
    const activePackage = snapshot.packageSnapshots.find((item) => item.clientId === client.id && item.status === 'ACTIVO');
    const activeServices = snapshot.services.filter((item) => item.clientId === client.id && item.included && item.status !== 'Anulado');
    const activePayments = snapshot.payments.filter((item) => item.clientId === client.id && item.status !== 'Anulado');
    const isContract = contractDraft.documentType === 'CONTRATO';
    return [
      { key: 'name', label: 'Nombre completo del contratante', complete: Boolean(String(client.name || '').trim()), required: true },
      { key: 'phone', label: 'Teléfono', complete: Boolean(String(client.phone || '').trim()), required: true },
      { key: 'email', label: 'Correo electrónico', complete: Boolean(String(client.email || '').trim()), required: true },
      { key: 'address', label: 'Domicilio del contratante', complete: Boolean(String(client.address || '').trim()), required: isContract },
      { key: 'eventType', label: 'Tipo de evento', complete: Boolean(String(contractDraft.eventType || client.eventType || '').trim()), required: true },
      { key: 'eventDate', label: 'Fecha del evento', complete: Boolean(dateValue(contractDraft.eventDate || client.eventDate)), required: true },
      { key: 'eventTime', label: 'Horario del evento', complete: Boolean(timeValue(client.eventTime)), required: isContract },
      { key: 'eventLocation', label: 'Lugar o dirección del evento', complete: Boolean(String(client.eventLocation || '').trim()), required: isContract },
      { key: 'packageName', label: 'Paquete contratado', complete: Boolean(String(activePackage?.packageName || client.packageName || '').trim()), required: true },
      { key: 'totalAmount', label: 'Total contratado', complete: Number(client.totalAmount || 0) > 0, required: true },
      { key: 'services', label: 'Servicios incluidos', complete: activeServices.length > 0, required: true },
      { key: 'payments', label: contractDraft.paymentPolicy === 'PERSONALIZADA' ? 'Plan de pagos personalizado' : 'Plan 40% / 30% / 30%', complete: contractDraft.paymentPolicy === '40-30-30' || activePayments.length > 0, required: true },
    ];
  };

  const buildContractSnapshot = (client: CrmClient): ContractDocumentSnapshot => {
    const packageSnapshot = snapshot.packageSnapshots.find((item) => item.clientId === client.id && item.status === 'ACTIVO');
    const services = snapshot.services.filter((item) => item.clientId === client.id && item.included && item.status !== 'Anulado');
    const addons = snapshot.addons.filter((item) => item.clientId === client.id && item.status !== 'Anulado');
    const registeredPayments = snapshot.payments.filter((item) => item.clientId === client.id && item.status !== 'Anulado').sort((a, b) => Number(a.installmentNumber || 0) - Number(b.installmentNumber || 0));
    const packageBase = Number(packageSnapshot?.basePrice || Math.max(0, Number(client.totalAmount || 0) - addons.reduce((sum, item) => sum + Number(item.total || 0), 0)));
    const additions = addons.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const discount = Number(packageSnapshot?.discount || 0);
    const total = Number(client.totalAmount || packageBase + additions - discount);
    const defaultPlan = [
      { concept: '1er pago (Apartado)', percentage: 40, amount: total * .4, dueDate: '', status: 'Pendiente' },
      { concept: '2do pago (Intermedio)', percentage: 30, amount: total * .3, dueDate: contractDraft.eventDate || client.eventDate || '', status: 'Pendiente' },
      { concept: '3er pago (Finiquito)', percentage: 30, amount: total * .3, dueDate: '', status: 'Pendiente' },
    ];
    const payments = registeredPayments.length ? registeredPayments.map((item) => ({ concept: item.concept || `Pago ${item.installmentNumber || ''}`.trim(), percentage: Number(item.percentage || 0), amount: Number(item.plannedAmount || 0), dueDate: item.dueDate || '', status: item.status })) : defaultPlan;
    return {
      documentType: contractDraft.documentType,
      templateVersion: 'contrato-xph-fiel-v2',
      issuedAt: now(),
      client: { name: client.name, phone: client.phone, email: client.email, address: client.address, honoreeName: client.honoreeName },
      event: { type: contractDraft.eventType || client.eventType, date: contractDraft.eventDate || client.eventDate, time: client.eventTime, location: client.eventLocation, serviceHours: Number(client.serviceHours || 0) },
      commercial: { packageName: packageSnapshot?.packageName || client.packageName, packageBase, additions, discount, total, promotion: packageSnapshot?.promotion || '' },
      services: services.map((item) => ({ concept: item.concept, quantity: Number(item.quantity || 0), notes: item.notes || '' })),
      addons: addons.map((item) => ({ concept: item.concept, quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0), total: Number(item.total || 0), notes: item.notes || '' })),
      payments,
      paymentPolicy: contractDraft.paymentPolicy,
      terms: [
        'Reserva y calendario de pagos: La fecha del evento queda formalmente reservada únicamente tras el pago del 40% inicial y la firma del contrato. El segundo pago del 30% deberá cubrirse, como fecha límite, antes de iniciar la cobertura el día del evento. El 30% restante se pagará contra entrega de los materiales contratados.',
        'Entregables: Se entregarán exclusivamente las fotografías editadas, la galería digital privada, el video resumen y los demás productos expresamente incluidos en el paquete. La entrega será digital y en alta resolución, dentro del plazo acordado entre ambas partes.',
        'Edición y colorimetría: La selección final, corrección de exposición, balance de blancos, contraste, colorimetría y estilo de edición forman parte del criterio creativo de XPH. El resultado conservará la línea visual mostrada en su portafolio. No se entregan archivos RAW ni proyectos editables. Las diferencias de color producidas por pantallas, impresoras o laboratorios externos no se consideran defectos del material.',
        'Puntualidad y cobertura: La cobertura inicia a la hora acordada y comprende únicamente las horas continuas indicadas en el paquete. Los retrasos imputables al itinerario, ceremonia, recepción o participantes no extienden el tiempo contratado; las horas adicionales requieren disponibilidad, cotización y autorización.',
        'Cambios al servicio: Cualquier modificación de fecha, horario, sede, itinerario, cobertura, paquete o servicio adicional deberá solicitarse y aprobarse por escrito antes del evento. Los cargos de traslado, permisos o accesos no contemplados serán cubiertos por EL CLIENTE.',
        'Fuerza mayor, reprogramación y cancelación: En una cancelación unilateral de EL CLIENTE, el apartado inicial del 40% no será reembolsable por la reserva de fecha y gastos administrativos. Cuando exista fuerza mayor o caso fortuito comprobable, podrá reasignarse la fecha sujeto a disponibilidad y a los gastos ya realizados.',
        'Conservación y respaldo: EL CLIENTE deberá descargar y respaldar sus entregables dentro del periodo comunicado. La galería privada y los respaldos de producción no constituyen almacenamiento indefinido.',
        'Aceptación electrónica: La firma electrónica, la fecha y hora de aceptación, la versión congelada del documento y sus identificadores se conservarán como evidencia del acuerdo entre las partes.',
      ],
    };
  };

  const generateContractDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = snapshot.clients.find((item) => item.id === contractDraft.clientId);
    if (!client || !contractDraft.folio) return setModalNotice('Selecciona un prospecto o cliente y registra el folio.');
    const missingFields = getContractDataChecklist(client).filter((item) => item.required && !item.complete);
    if (missingFields.length) return setModalNotice(`Completa antes de generar: ${missingFields.map((item) => item.label).join(', ')}.`);
    setBusy(true);
    try {
      const documentSnapshot = buildContractSnapshot(client);
      const saved = await createGeneratedBusinessContract({ clientId: client.id, folio: contractDraft.folio, documentType: contractDraft.documentType, paymentPolicy: contractDraft.paymentPolicy, snapshot: documentSnapshot });
      setSnapshot((prev) => ({ ...prev, contracts: [saved, ...prev.contracts.filter((item) => item.id !== saved.id)] }));
      setContractPreview(saved);
      setModalNotice(`${contractDraft.documentType === 'COTIZACION' ? 'Cotización' : 'Contrato'} generado con la información congelada del CRM.`);
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo generar el documento.'); }
    finally { setBusy(false); }
  };

  const previewContractDocument = async (contract: BusinessContract) => {
    setBusy(true);
    try { setContractPreview(await loadAdminContractDocument(contract.id)); }
    catch (error: any) { setModalNotice(error?.message || 'No se pudo abrir el documento.'); }
    finally { setBusy(false); }
  };

  const uploadContract = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = snapshot.clients.find((item) => item.id === contractDraft.clientId);
    if (!client || !contractDraft.file) return setModalNotice('Selecciona un cliente y el PDF del contrato.');
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
      setContractDraft({ clientId: '', folio: '', eventType: '', eventDate: '', documentType: 'CONTRATO', paymentPolicy: '40-30-30', file: null });
      setModalNotice('Contrato guardado de forma privada.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo guardar el contrato.'); }
    finally { setBusy(false); }
  };

  const createLink = async (contract: BusinessContract) => {
    setBusy(true);
    try {
      const result = await createContractSigningLink(contract.id);
      setLatestLink(result.url);
      await navigator.clipboard.writeText(result.url).catch(() => null);
      await refresh();
      setModalNotice('Liga privada creada y copiada. Funciona en computadora y celular, y caduca en 72 horas.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo crear la liga.'); }
    finally { setBusy(false); }
  };

  const finalize = async (contract: BusinessContract) => {
    setBusy(true);
    try {
      const saved = await finalizeBusinessContract(contract.id);
      setSnapshot((prev) => ({ ...prev, contracts: prev.contracts.map((item) => item.id === saved.id ? saved : item) }));
      setModalNotice('Contrato autorizado y finalizado con tu firma.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo finalizar el contrato.'); }
    finally { setBusy(false); }
  };

  const removeContract = async (contract: BusinessContract) => {
  const label = contract.documentType === 'COTIZACION' ? 'la cotización' : 'el contrato';
  const confirmed = window.confirm('¿Eliminar ' + label + ' ' + (contract.folio || contract.id) + ' de ' + contract.clientName + '?\n\nSe quitará del panel y dejará de aparecer en la lista. El PDF original permanecerá resguardado en Drive.');
  if (!confirmed) return;
  setBusy(true);
  try {
    await deleteBusinessContract(contract.id);
    setSnapshot((prev) => ({ ...prev, contracts: prev.contracts.filter((item) => item.id !== contract.id) }));
    if (contractPreview?.id === contract.id) setContractPreview(null);
    setLatestLink('');
    setModalNotice('Contrato eliminado del panel. El archivo original permanece resguardado en Drive.');
  } catch (error: any) {
    setModalNotice(error?.message || 'No se pudo eliminar el contrato.');
  } finally {
    setBusy(false);
  }
};

  const persistOwnerSignature = async () => {
    if (!ownerSignature) return setModalNotice('Firma dentro del recuadro antes de guardar.');
    setBusy(true);
    try {
      await saveOwnerSignature(ownerSignature);
      setSnapshot((prev) => ({ ...prev, ownerSignatureConfigured: true }));
      setOwnerSignature('');
      setModalNotice('Firma de Javier guardada de forma privada.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo guardar la firma.'); }
    finally { setBusy(false); }
  };

  const selectedContractClient = snapshot.clients.find((client) => client.id === contractDraft.clientId);
  const contractDataChecklist = getContractDataChecklist(selectedContractClient);
  const missingContractData = contractDataChecklist.filter((item) => item.required && !item.complete);

  return (
    <section className="space-y-5">
      {modalNotice && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="business-notice-title"><div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#161C28] p-6 text-center shadow-2xl"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /><h3 id="business-notice-title" className="mt-4 text-lg font-bold text-white">Aviso</h3><p className="mt-2 break-words text-sm leading-6 text-gray-200">{modalNotice}</p><button type="button" autoFocus onClick={() => setModalNotice('')} className="mt-6 w-full rounded-xl bg-[#D4AF37] px-5 py-3 font-bold text-black">OK</button></div></div>}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{session.role === 'SUPER_ADMIN' ? 'Clientes, gastos y contratos' : 'Operación asignada'}</h2>
          <p className="mt-1 text-sm text-gray-400">{session.role === 'SUPER_ADMIN' ? 'Información privada del negocio. Los registros nuevos comienzan vacíos.' : 'Solo aparecen tus clientes, actividades y datos operativos autorizados.'}</p>
        </div>
        <div className="relative flex items-center justify-end gap-2">
          <button type="button" onClick={() => setNotificationMenuOpen((open) => !open)} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#161C28] text-white hover:bg-white/10" aria-label={`Notificaciones${pendingNotificationCount ? `, ${pendingNotificationCount} pendientes` : ''}`} aria-expanded={notificationMenuOpen} aria-haspopup="menu">
            <Bell className="h-5 w-5" />
            {pendingNotificationCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white ring-2 ring-[#0B0F17]">{pendingNotificationCount > 99 ? '99+' : pendingNotificationCount}</span>}
          </button>
          <button onClick={() => refresh(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm disabled:opacity-40">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {refreshing ? 'Actualizando…' : 'Actualizar datos'}
          </button>
          {notificationMenuOpen && <div role="menu" aria-label="Notificaciones" className="absolute right-0 top-14 z-[90] w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-white/15 bg-[#161C28] text-left shadow-2xl shadow-black/60"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><h3 className="font-bold text-white">Notificaciones</h3><p className="text-xs text-gray-400">Selecciona un aviso para atenderlo</p></div>{pendingNotificationCount > 0 && <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-300">{pendingNotificationCount} nuevas</span>}</div><div className="max-h-[min(65vh,520px)] overflow-y-auto">{visibleNotifications.map((item) => <button key={item.id} type="button" role="menuitem" disabled={notificationPendingId === item.id} onClick={() => openNotificationAction(item.id)} className={`block w-full border-b border-white/5 px-4 py-3 text-left hover:bg-white/5 disabled:opacity-60 ${item.status === 'PENDIENTE' ? 'bg-sky-400/5' : ''}`}><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.status === 'PENDIENTE' ? 'bg-sky-400' : item.status === 'RESUELTA' ? 'bg-emerald-400' : 'bg-gray-600'}`} /><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><strong className="text-sm text-white">{item.title}</strong><span className="shrink-0 text-[10px] text-gray-500">{item.status === 'RESUELTA' ? 'Resuelta' : item.status === 'LEIDA' ? 'Vista' : 'Nueva'}</span></span><span className="mt-1 block text-xs leading-5 text-gray-300">{item.message}</span>{item.dueAt && <span className="mt-1 block text-[11px] text-amber-200">{dateTimeDisplay(item.dueAt)}</span>}</span></div></button>)}{!visibleNotifications.length && <div className="px-5 py-10 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" /><p className="mt-3 text-sm text-gray-300">No hay notificaciones.</p></div>}</div></div>}
        </div>
      </div>

      {session.role === 'SUPER_ADMIN' ? <div className="grid gap-3 sm:grid-cols-3"><Metric label="Prospectos y clientes" value={String(snapshot.clients.length)} icon={Users} /><Metric label="Contratos" value={String(snapshot.contracts.length)} icon={FileSignature} /><Metric label="Cobrado / contratado" value={`${money(financials.collected)} / ${money(financials.contracted)}`} icon={BadgeDollarSign} /></div> : <div className="grid gap-3 sm:grid-cols-3"><Metric label="Clientes asignados" value={String(snapshot.clients.filter((item) => item.recordType === 'Cliente').length)} icon={Users} /><Metric label="Actividades asignadas" value={String(snapshot.assignments.length)} icon={CalendarDays} /><Metric label="Próximos 7 días" value={String(snapshot.assignments.filter((item) => { const diff = dayDifference(item.startDate); return diff >= 0 && diff <= 7; }).length)} icon={BriefcaseBusiness} /></div>}

      <div className="min-w-0 space-y-5">

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-4"><DashboardGroup title="Comercial" rows={[['Prospectos activos', dashboardStats.prospectsActive], ['Seguimientos de hoy', dashboardStats.followUpsToday], ['Seguimientos vencidos', dashboardStats.followUpsOverdue], ['Por cerrar', dashboardStats.prospectsClosing]]} /><DashboardGroup title="Clientes" rows={[['Clientes activos', dashboardStats.clientsActive], ['Próximos eventos', dashboardStats.upcomingEvents], ['Sesiones pendientes', dashboardStats.sessionsPending], ['Servicios pendientes', dashboardStats.servicesPending]]} /><DashboardGroup title="Pagos" rows={[['Cobrado', money(financials.collected)], ['Por cobrar', money(financials.receivable)], ['Pagos vencidos', money(financials.overdueAmount)], ['Próximos pagos', snapshot.payments.filter((item) => { const diff = dayDifference(item.dueDate); return pendingPaymentAmount(item) > 0 && diff >= 0 && diff <= 7; }).length]]} /><DashboardGroup title="Calendario" rows={[['Eventos de hoy', dashboardStats.eventsToday], ['Esta semana', dashboardStats.eventsWeek], ['Próximos eventos', dashboardStats.upcomingEvents], ['Conflictos', dashboardStats.conflicts]]} /></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Bote acumulado cobrado" value={money(financials.collected)} icon={BadgeDollarSign} />
            <Metric label="Por cobrar a clientes" value={money(financials.receivable)} icon={Users} />
            <Metric label="Gastos pagados" value={money(financials.paidExpenses)} icon={BriefcaseBusiness} />
            <Metric label="Balance calculado" value={money(financials.balanceCalculated)} icon={TrendingUp} />
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
                <FinancialRow label="Ajustes activos" value={financials.activeAdjustments} detail="Nunca modifican silenciosamente pagos o gastos anteriores" />
                <FinancialRow label="Pagos vencidos" value={financials.overdueAmount} detail={`${financials.overduePayments.length} pago(s) con fecha límite vencida`} />
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
          <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5">
            <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
              <form onSubmit={reconcileBalance} className="space-y-3">
                <div><h3 className="font-semibold">Actualizar balance real</h3><p className="mt-1 text-xs leading-5 text-gray-400">Captura lo que realmente hay en banco/efectivo. La diferencia se guarda como ajuste auditable.</p></div>
                <label className="block text-xs text-gray-300">Balance real<input type="number" step="0.01" value={realBalance} onChange={(event) => setRealBalance(event.target.value)} placeholder="0.00" className={`${inputClass} mt-1`} required /></label>
                <select value={adjustmentCategory} onChange={(event) => setAdjustmentCategory(event.target.value as FinancialAdjustmentCategory)} className={inputClass}>{adjustmentCategories.map((category) => <option key={category}>{category}</option>)}</select>
                <textarea value={adjustmentNotes} onChange={(event) => setAdjustmentNotes(event.target.value)} placeholder="Explicación o referencia" className={`${inputClass} min-h-20`} />
                {realBalance !== '' && Number.isFinite(Number(realBalance)) && <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-3 text-sm"><div className="text-gray-400">Diferencia por conciliar</div><div className={`mt-1 text-lg font-bold ${Number(realBalance) - financials.balanceCalculated < 0 ? 'text-red-300' : 'text-emerald-300'}`}>{money(Number(realBalance) - financials.balanceCalculated)}</div></div>}
                <button type="submit" disabled={busy || realBalance === ''} className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black disabled:opacity-40">Registrar ajuste de conciliación</button>
              </form>
              <div><h3 className="font-semibold">Historial de conciliaciones</h3><div className="mt-3 max-h-80 divide-y divide-white/10 overflow-y-auto rounded-xl border border-white/10">{snapshot.adjustments.map((adjustment) => <div key={adjustment.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-white">{money(adjustment.amount)}</span><span className={adjustment.status === 'ACTIVO' ? 'text-xs text-emerald-300' : 'text-xs text-gray-500'}>{adjustment.status}</span></div><div className="text-xs text-gray-400">{adjustment.date} · {adjustment.category}</div><div className="mt-1 text-xs text-gray-300">{adjustment.concept}</div></div><button type="button" onClick={() => updateAdjustment(adjustment, adjustment.status === 'ACTIVO' ? 'ANULADO' : 'ACTIVO')} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#D4AF37]">{adjustment.status === 'ACTIVO' ? 'Anular' : 'Reactivar'}</button></div>)}{!snapshot.adjustments.length && <p className="p-6 text-center text-sm text-gray-500">Aún no hay ajustes; el balance se calcula con ingresos liquidados menos gastos.</p>}</div></div>
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Auditoría reciente</h3><p className="mt-1 text-xs text-gray-400">Cambios importantes con fecha, usuario, elemento y estado; el historial no se elimina.</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-400">{snapshot.auditLog.length} registros cargados</span></div>
            <div className="mt-4 max-h-80 divide-y divide-white/10 overflow-y-auto rounded-xl border border-white/10">{snapshot.auditLog.slice(0, 40).map((entry, index) => <div key={`${entry.Fecha_Hora}-${entry.ID_Elemento}-${index}`} className="grid gap-1 p-3 text-xs sm:grid-cols-[170px_220px_1fr]"><div className="text-gray-400">{dateTimeDisplay(entry.Fecha_Hora) || entry.Fecha_Hora}</div><div><span className="font-semibold text-[#F5D76E]">{entry.Accion}</span><div className="mt-1 text-gray-500">{entry.Usuario || 'Sistema'} · {entry.ID_Elemento}</div></div><div className="break-words text-gray-300">{String(entry.Detalles_Cambio || '').slice(0, 500)}</div></div>)}{!snapshot.auditLog.length && <p className="p-6 text-center text-sm text-gray-500">El historial aparecerá aquí después de sincronizar la migración compatible.</p>}</div>
          </section>
        </div>
      )}

      {tab === 'execution' && <React.Suspense fallback={<div className="flex min-h-64 items-center justify-center rounded-2xl border border-white/10 bg-[#161C28]"><Loader2 className="h-7 w-7 animate-spin text-[#D4AF37]" /><span className="ml-3 text-sm text-gray-300">Preparando centro de ejecución…</span></div>}><SalesExecutionCenter snapshot={snapshot} onOpenRecord={openClientDetails} onOpenNotification={openNotificationAction} onUpdateStage={updateProspectStage} /></React.Suspense>}

      {(tab === 'prospects' || tab === 'clients') && (
        <div className="space-y-4">
          {selectedClient ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111722] shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-3 border-b border-white/10 bg-[#161C28] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><button onClick={closeClientDetails} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-200 hover:bg-white/5">← {returnLabel}</button><span className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" />{selectedClient.status}</span></div>
                <div className="flex flex-wrap gap-2">{canEditSelected && selectedClient.recordType === 'Prospecto' && <button onClick={convertSelectedProspect} disabled={busy} className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">Convertir en cliente</button>}{canManageFinance && selectedClient.recordType === 'Cliente' && <button onClick={() => prepareNextPayment(selectedClient)} className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">Agregar pago al plan</button>}{canManageFinance && selectedClientContract && <a href={adminContractPdfUrl(selectedClientContract.id, 'latest', contractPdfRevision(selectedClientContract))} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white">{contractViewLabel(selectedClientContract)}</a>}{canEditSelected && <button onClick={() => { setClientDraft(selectedClient); setShowClientForm(true); }} className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black">Editar seguimiento</button>}{canEditSelected && selectedClient.recordType === 'Cliente' && <button onClick={() => syncCalendar(selectedClient)} disabled={Boolean(syncingClientId)} className="inline-flex items-center gap-2 rounded-lg border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-100 disabled:border-white/10 disabled:bg-transparent disabled:text-gray-600">{syncingClientId === selectedClient.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{syncingClientId === selectedClient.id ? 'Rectificando…' : 'Actualizar Calendar'}</button>}</div>
              </div>
              {showInlinePayment && <div className="border-b border-white/10 p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-white">{paymentDraft.id ? `Editar pago de ${selectedClient.name}` : `Registrar siguiente pago de ${selectedClient.name}`}</h3><button onClick={() => { setPaymentDraft(blankPayment()); setPaymentReceipt(null); setShowInlinePayment(false); }} className="text-xs text-gray-400">Cerrar</button></div><PaymentForm draft={paymentDraft} receipt={paymentReceipt} clients={snapshot.clients} contracts={snapshot.contracts} onChange={setPaymentDraft} onReceipt={setPaymentReceipt} onSubmit={savePayment} onCancel={() => { setPaymentDraft(blankPayment()); setPaymentReceipt(null); setShowInlinePayment(false); }} busy={busy} /></div>}
              {canManageFinance && selectedClient.recordType === 'Cliente' && <section className="border-b border-white/10 p-5">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold text-white">Pagos registrados</h3><p className="mt-1 text-xs text-gray-400">Edita cualquier pago sin perder su relación con el movimiento financiero ni su auditoría.</p></div><span className="text-xs text-gray-500">{selectedClientPayments.length} registro(s)</span></div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{selectedClientPayments.map((payment) => <article key={payment.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
                  <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-white">{payment.concept || `Pago ${payment.installmentNumber || ''}`}</div><div className="mt-1 text-xs text-gray-400">{payment.date || 'Sin fecha'} · {payment.method || 'Método pendiente'}</div></div><span className={`text-xs font-semibold ${payment.status === 'Liquidado' ? 'text-emerald-300' : payment.status === 'Parcial' ? 'text-sky-300' : payment.status === 'Pendiente' ? 'text-amber-300' : 'text-gray-500'}`}>{payment.status}</span></div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><span className="block text-gray-500">Programado</span>{money(payment.plannedAmount)}</div><div><span className="block text-gray-500">Recibido</span>{money(payment.receivedAmount)}</div></div>
                  <button type="button" onClick={() => editClientPayment(payment)} className="mt-4 w-full rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-xs font-semibold text-[#F5D76E] hover:bg-[#D4AF37]/20">Editar pago</button>
                </article>)}{!selectedClientPayments.length && <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-gray-500 md:col-span-2 xl:col-span-3">Este cliente todavía no tiene pagos en el historial. Usa “Agregar pago al plan” para registrar el primero.</div>}</div>
              </section>}
              {session.role !== 'SUPER_ADMIN' && selectedClient.recordType === 'Cliente' ? <ProviderClientView client={selectedClient} snapshot={snapshot} /> : showClientForm && canEditSelected ? <ClientForm draft={clientDraft} onChange={setClientDraft} onSubmit={saveClient} onCancel={() => setShowClientForm(false)} busy={busy} /> : canEditSelected ? <><ClientDetails client={selectedClient} paid={paidForClient(selectedClient)} followUps={selectedFollowUps} followUpDraft={followUpDraft} onFollowUpChange={setFollowUpDraft} onFollowUpSubmit={saveFollowUp} onInlineSave={saveInlineClient} queuePosition={selectedFollowUpIndex} queueTotal={followUpQueue.length} onQueueMove={openQueuedFollowUp} busy={busy} /><ClientOperationsPanel client={selectedClient} snapshot={snapshot} onSnapshotChange={setSnapshot} onClientPatch={saveInlineClient} notify={notify} focusedNotificationId={focusedNotificationId} canAssignTeam={session.role === 'SUPER_ADMIN' && selectedClient.recordType === 'Cliente'} preContractMode={selectedClient.recordType === 'Prospecto'} /></> : <ProviderClientView client={selectedClient} snapshot={snapshot} />}
            </div>
          ) : <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar ${tab === 'prospects' ? 'prospectos' : 'clientes'} por nombre, teléfono, evento o estado`} className="w-full max-w-xl rounded-xl border border-white/10 bg-[#161C28] px-4 py-3 text-sm" />
            {canCreateCurrentType && <button onClick={() => { setSelectedClientId(''); setClientDraft({ ...blankClient(), recordType: tab === 'clients' ? 'Cliente' : 'Prospecto' }); setShowClientForm(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black"><Plus className="h-4 w-4" />{tab === 'prospects' ? 'Nuevo prospecto' : 'Nuevo cliente'}</button>}
          </div>
          {showClientForm && canCreateCurrentType && <ClientForm draft={clientDraft} onChange={setClientDraft} onSubmit={saveClient} onCancel={() => setShowClientForm(false)} busy={busy} />}
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#161C28]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-black/20 text-xs uppercase tracking-wider text-[#D4AF37]"><tr><th className="p-4">Contacto</th><th className="p-4">Evento</th><th className="p-4">Estado</th><th className="p-4">Importes</th><th className="p-4">Próxima acción</th><th className="p-4"></th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {filteredClients.map((client) => <tr key={client.id} className="align-top">
                  <td className="p-4"><button onClick={() => openClientDetails(client)} className="text-left font-semibold text-white hover:text-[#D4AF37]">{client.name || 'Sin nombre'}</button><div className="text-xs text-gray-400">{client.phone || 'Sin teléfono'} · {client.recordType}</div></td>
                  <td className="p-4"><div>{client.eventType || 'Por confirmar'}</div><div className="text-xs text-gray-400">{dateValue(client.eventDate) || 'Sin fecha'} · {client.eventLocation || 'Sin lugar'}</div></td>
                  <td className="p-4"><span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-xs text-[#F5D76E]">{client.status}</span></td>
                  <td className="p-4"><div>{money(client.totalAmount)}</div><div className="text-xs text-emerald-300">Pagado {money(paidForClient(client))}</div><div className="text-xs text-amber-300">Pendiente {money(Math.max(0, client.totalAmount - paidForClient(client)))}</div></td>
                  <td className="p-4"><div>{client.nextAction || 'Sin acción'}</div><div className="text-xs text-gray-400">{dateTimeDisplay(client.nextActionAt) || 'Sin fecha'}</div></td>
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
            <div className="relative"><button aria-label="Abrir mini calendario" title="Elegir fecha" onClick={() => setShowMiniCalendar((value) => !value)} className="rounded-full border border-sky-300/30 bg-sky-400/10 p-2 text-sky-100 hover:bg-sky-400/20"><CalendarDays className="h-5 w-5 stroke-[2.5]" /></button>{showMiniCalendar && <div className="absolute left-0 top-12 z-30 w-64 rounded-2xl border border-white/15 bg-[#161C28] p-4 shadow-2xl"><label className="text-xs font-semibold text-gray-300">Ir rápidamente a una fecha<input type="date" autoFocus value={localDateKey(calendarCursor)} onChange={(event) => { if (!event.target.value) return; const selected = new Date(`${event.target.value}T12:00:00`); setCalendarCursor(selected); setShowMiniCalendar(false); }} className="mt-2 w-full rounded-xl border border-white/15 bg-[#0B0F17] px-3 py-3 text-base text-white [color-scheme:dark]" /></label></div>}</div>
            <button aria-label="Periodo anterior" onClick={() => moveCalendar(-1)} className="rounded-full border border-white/15 bg-white/10 p-2 text-white hover:bg-white/20"><ChevronLeft className="h-5 w-5 stroke-[2.5]" /></button>
            <button aria-label="Periodo siguiente" onClick={() => moveCalendar(1)} className="rounded-full border border-white/15 bg-white/10 p-2 text-white hover:bg-white/20"><ChevronRight className="h-5 w-5 stroke-[2.5]" /></button>
            <h3 className="min-w-[190px] text-xl font-bold capitalize">{calendarView === 'day' ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(calendarCursor) : monthLabel(calendarCursor)}</h3>
            <div className="flex overflow-x-auto rounded-xl border border-white/10 p-1">{([['month','Mes'],['week','Semana'],['day','Día'],['upcoming','Próximos']] as const).map(([value, label]) => <button key={value} onClick={() => setCalendarView(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${calendarView === value ? 'bg-white text-black' : 'text-gray-400'}`}>{label}</button>)}</div>
            {session.role === 'SUPER_ADMIN' && <button onClick={syncAllCalendars} disabled={syncingAllCalendars} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-sky-300/30 px-3 py-2 text-xs text-sky-100 disabled:cursor-wait disabled:opacity-60">{syncingAllCalendars ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{syncingAllCalendars ? 'Rectificando calendarios…' : 'Rectificar y sincronizar'}</button>}
          </div>
          <div className={`${calendarView === 'month' ? 'hidden sm:grid' : 'hidden'} grid-cols-7 border-b border-white/10 bg-black/15 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400`}>{['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => <div key={day} className="py-2">{day}</div>)}</div>
          <div className={`${calendarView === 'month' ? 'hidden sm:grid' : 'hidden'} grid-cols-7`}>
            {calendarDays.map(({ date, key, currentMonth, entries, internalEntries }) => <div key={key} className={`min-h-28 border-b border-r border-white/10 p-2 sm:min-h-36 ${currentMonth ? 'bg-[#111722]' : 'bg-black/20 text-gray-600'}`}>
              <div className={`mb-2 text-center text-xs ${key === localDateKey(new Date()) ? 'mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-[#D4AF37] font-bold text-black' : ''}`}>{date.getDate()}</div>
              <div className="space-y-1">{entries.map((entry) => <button key={`${entry.client.id}-${entry.kind}`} onClick={() => openClientDetails(entry.client)} title={`${entry.kind === 'session' ? 'Sesión previa' : entry.kind === 'followup' ? 'Próximo seguimiento' : entry.client.eventType || 'Evento'} · ${entry.client.name}`} className={`block w-full truncate rounded-md border-l-4 px-1.5 py-1 text-left text-[10px] sm:text-xs ${entry.kind === 'session' ? 'border-red-400 bg-red-500/15 text-red-200 hover:bg-red-500/25' : entry.kind === 'followup' ? 'border-yellow-300 bg-yellow-300/15 text-yellow-100 hover:bg-yellow-300/25' : 'border-emerald-400 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'}`}><span className="font-semibold">{timeDisplay(entry.time) || '—'}</span> {entry.kind === 'session' ? 'Sesión · ' : entry.kind === 'followup' ? 'Seguimiento · ' : ''}{entry.client.name || (entry.kind === 'followup' ? 'Prospecto' : 'Cliente')}</button>)}{internalEntries.map((entry) => <button key={entry.id} onClick={() => session.role === 'SUPER_ADMIN' && setInternalEventDraft(entry)} className="block w-full truncate rounded-md border-l-4 border-violet-400 bg-violet-500/15 px-1.5 py-1 text-left text-[10px] text-violet-100 sm:text-xs"><span className="font-semibold">{timeDisplay(entry.startTime) || '—'}</span> {entry.activityType} · {entry.title}</button>)}</div>
            </div>)}
          </div>
          <div className={`space-y-3 p-4 ${calendarView === 'month' ? 'sm:hidden' : ''}`}>{visibleCalendarEntries.map((entry) => <button key={`${entry.client.id}-${entry.kind}-${entry.date}`} onClick={() => openClientDetails(entry.client)} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left ${entry.kind === 'session' ? 'border-red-400/30 bg-red-500/10' : entry.kind === 'followup' ? 'border-yellow-300/30 bg-yellow-300/10' : 'border-emerald-400/30 bg-emerald-500/10'}`}><div className={`min-w-14 rounded-lg px-2 py-2 text-center ${entry.kind === 'session' ? 'bg-red-500/20 text-red-100' : entry.kind === 'followup' ? 'bg-yellow-300/20 text-yellow-100' : 'bg-emerald-500/20 text-emerald-100'}`}><div className="text-lg font-bold">{entry.date.slice(8, 10)}</div><div className="text-[10px] uppercase">{new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(new Date(`${entry.date}T12:00:00`))}</div></div><div className="min-w-0 flex-1"><div className={`text-xs font-semibold uppercase tracking-wide ${entry.kind === 'session' ? 'text-red-200' : entry.kind === 'followup' ? 'text-yellow-100' : 'text-emerald-200'}`}>{entry.kind === 'session' ? 'Sesión previa' : entry.kind === 'followup' ? 'Próximo seguimiento' : entry.client.eventType || 'Evento'}</div><div className="mt-1 break-words font-semibold text-white">{entry.client.name || (entry.kind === 'followup' ? 'Prospecto sin nombre' : 'Cliente sin nombre')}</div><div className="mt-1 text-sm text-gray-300">{timeDisplay(entry.time) || 'Horario pendiente'}</div><div className="mt-1 break-words text-xs text-gray-400">{entry.kind === 'session' ? entry.client.preSessionLocation || 'Lugar pendiente' : entry.kind === 'followup' ? entry.client.nextAction || 'Acción de seguimiento pendiente' : entry.client.eventLocation || 'Lugar pendiente'}</div></div></button>)}{visibleInternalEvents.map((entry) => <button key={entry.id} onClick={() => session.role === 'SUPER_ADMIN' && setInternalEventDraft(entry)} className="flex w-full items-start gap-3 rounded-xl border border-violet-400/30 bg-violet-500/10 p-4 text-left"><div className="min-w-14 rounded-lg bg-violet-500/20 px-2 py-2 text-center text-violet-100"><div className="text-lg font-bold">{dateValue(entry.startDate).slice(8,10)}</div><div className="text-[10px] uppercase">Interno</div></div><div><div className="text-xs font-semibold uppercase tracking-wide text-violet-200">{entry.activityType}</div><div className="mt-1 font-semibold text-white">{entry.title}</div><div className="mt-1 text-sm text-gray-300">{timeDisplay(entry.startTime) || 'Todo el día'} · {entry.location || 'Sin lugar'}</div></div></button>)}{!visibleCalendarEntries.length && !visibleInternalEvents.length && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">No hay registros en esta vista.</div>}</div>
          </div>
          <aside className="border-t border-white/10 bg-[#161C28] xl:border-l xl:border-t-0">
            <div className="border-b border-white/10 p-4"><h4 className="font-semibold text-white">Ver calendario de</h4><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setCalendarAudience('clients')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${calendarAudience === 'clients' ? 'bg-emerald-500 text-white' : 'border border-white/10 text-gray-300'}`}>Clientes</button><button type="button" onClick={() => setCalendarAudience('prospects')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${calendarAudience === 'prospects' ? 'bg-yellow-300 text-black' : 'border border-white/10 text-gray-300'}`}>Prospectos</button></div><p className="mt-3 text-xs text-gray-400">{calendarAudience === 'clients' ? 'Eventos contratados y sesiones programadas' : 'Solo la fecha del próximo contacto'}</p><div className="mt-3 flex flex-wrap gap-3 text-[11px]">{calendarAudience === 'clients' ? <><span className="flex items-center gap-1.5 text-emerald-200"><i className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Cliente</span><span className="flex items-center gap-1.5 text-red-200"><i className="h-2.5 w-2.5 rounded-full bg-red-400" />Sesión</span></> : <span className="flex items-center gap-1.5 text-yellow-100"><i className="h-2.5 w-2.5 rounded-full bg-yellow-300" />Prospecto</span>}<span className="flex items-center gap-1.5 text-violet-200"><i className="h-2.5 w-2.5 rounded-full bg-violet-400" />Interno</span></div></div>
            <div className="max-h-[670px] divide-y divide-white/10 overflow-y-auto">{calendarRecords.map((client) => <button key={client.id} onClick={() => openClientDetails(client)} className="block w-full p-4 text-left hover:bg-white/5"><div className="font-semibold text-white">{client.name || (calendarAudience === 'prospects' ? 'Prospecto sin nombre' : 'Cliente sin nombre')}</div><div className="mt-1 text-xs text-gray-400">{calendarAudience === 'prospects' ? `${dateValue(client.nextActionAt)} · ${timeDisplay(client.nextActionAt) || 'Horario pendiente'}` : `${dateValue(client.eventDate) || 'Evento sin fecha'} · ${timeDisplay(client.eventTime) || 'Horario pendiente'}`}</div><div className={`mt-1 text-xs ${calendarAudience === 'prospects' ? 'text-yellow-100' : 'text-emerald-200'}`}>{calendarAudience === 'prospects' ? client.nextAction || 'Seguimiento pendiente' : client.eventType || 'Evento por confirmar'}</div>{calendarAudience === 'clients' && client.preSessionApplies && <div className="mt-2 rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-200">Sesión: {dateValue(client.preSessionDate) || 'Fecha pendiente'} · {timeDisplay(client.preSessionTime) || 'Hora pendiente'}</div>}</button>)}{!calendarRecords.length && <p className="p-6 text-center text-sm text-gray-500">{calendarAudience === 'prospects' ? 'No hay prospectos con próximo seguimiento registrado.' : 'No hay clientes con evento o sesión registrados.'}</p>}</div>
            <div className="border-t border-white/10 p-4"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-violet-100">Eventos internos</h4>{session.role === 'SUPER_ADMIN' && <button onClick={() => setInternalEventDraft(blankInternalEvent())} className="rounded-lg bg-violet-500/15 px-3 py-2 text-xs text-violet-100">+ Nuevo</button>}</div><div className="mt-3 space-y-2">{snapshot.internalEvents.filter((item) => item.status === 'ACTIVO').slice(0,6).map((item) => <button key={item.id} onClick={() => session.role === 'SUPER_ADMIN' && setInternalEventDraft(item)} className="block w-full rounded-lg border border-violet-400/20 p-2 text-left"><div className="text-xs font-semibold text-violet-100">{item.title}</div><div className="mt-1 text-[11px] text-gray-400">{item.startDate} · {timeDisplay(item.startTime) || 'Todo el día'}</div></button>)}</div></div>
          </aside>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-4">
          <PaymentForm draft={paymentDraft} receipt={paymentReceipt} clients={snapshot.clients} contracts={snapshot.contracts} onChange={setPaymentDraft} onReceipt={setPaymentReceipt} onSubmit={savePayment} onCancel={() => { setPaymentDraft(blankPayment()); setPaymentReceipt(null); }} busy={busy} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Cobrado / liquidado" value={money(financials.collected)} icon={CheckCircle2} />
            <Metric label="Pendiente por cobrar" value={money(financials.receivable)} icon={CreditCard} />
            <Metric label="Pagos vencidos" value={money(snapshot.payments.filter((item) => isOverduePayment(item)).reduce((sum, item) => sum + pendingPaymentAmount(item), 0))} icon={AlertTriangle} />
            <Metric label="Movimientos anulados" value={String(snapshot.payments.filter((item) => item.status === 'Anulado').length)} icon={RefreshCw} />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#161C28]"><table className="min-w-full text-left text-sm"><thead className="bg-black/20 text-xs uppercase tracking-wider text-[#D4AF37]"><tr><th className="p-4">Cliente</th><th className="p-4">Pago</th><th className="p-4">Fecha / concepto</th><th className="p-4">Fecha límite</th><th className="p-4">Programado</th><th className="p-4">Recibido</th><th className="p-4">Por cobrar</th><th className="p-4">Estado</th><th className="p-4">Comprobante</th><th className="p-4">Acciones</th></tr></thead><tbody className="divide-y divide-white/5">{snapshot.payments.map((payment) => { const client = snapshot.clients.find((item) => item.id === payment.clientId); const overdue = isOverduePayment(payment); return <tr key={payment.id} className={overdue ? 'bg-red-500/5' : ''}><td className="p-4">{client?.name || 'Cliente no localizado'}</td><td className="p-4">{payment.installmentNumber ? `Pago ${payment.installmentNumber}` : 'Histórico'}<div className="text-xs text-[#D4AF37]">{payment.percentage ? `${payment.percentage}%` : 'Monto libre'}</div></td><td className="p-4"><div>{payment.date}</div><div className="text-xs text-gray-400">{payment.concept}</div></td><td className="p-4"><div>{payment.dueDate || 'Sin límite'}</div>{overdue && <div className="mt-1 text-xs font-semibold text-red-300">Pago vencido</div>}</td><td className="p-4">{money(payment.plannedAmount)}</td><td className="p-4 text-emerald-300">{money(collectedPaymentAmount(payment))}</td><td className="p-4 text-amber-300">{money(pendingPaymentAmount(payment))}</td><td className="p-4"><span className={payment.status === 'Liquidado' ? 'text-emerald-300' : payment.status === 'Parcial' ? 'text-sky-300' : payment.status === 'Pendiente' ? 'text-amber-300' : 'text-gray-400'}>{overdue ? 'Vencido' : payment.status}</span></td><td className="p-4">{payment.receiptUrl ? <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-[#D4AF37]">Ver comprobante</a> : <span className="text-xs text-gray-500">Sin archivo</span>}</td><td className="p-4"><div className="flex min-w-36 flex-col items-start gap-2">{payment.status !== 'Liquidado' && payment.status !== 'Anulado' && <button onClick={() => preparePaymentStatus(payment, 'Liquidado')} className="text-xs font-semibold text-emerald-300">Marcar como liquidado</button>}{(payment.status === 'Liquidado' || payment.status === 'Parcial') && <button onClick={() => preparePaymentStatus(payment, 'Pendiente')} className="text-xs font-semibold text-amber-300">Revertir a pendiente</button>}<button onClick={() => { setPaymentDraft(payment); setPaymentReceipt(null); }} className="text-xs font-semibold text-[#D4AF37]">Editar</button></div></td></tr>; })}{!snapshot.payments.length && <tr><td colSpan={10} className="p-10 text-center text-gray-500">Aún no hay pagos en el historial. Los importes cobrados actuales se conservarán al registrar el primer movimiento de cada cliente.</td></tr>}</tbody></table></div>
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
          <form onSubmit={generateContractDocument} className="rounded-2xl border border-[#D4AF37]/30 bg-[#161C28] p-5">
            <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D4AF37]">Nuevo documento digital</p><h3 className="mt-1 text-xl font-bold">Generar desde el CRM</h3><p className="mt-1 text-sm text-gray-400">Crea una versión HTML rápida y congela los datos actuales sin modificar el paquete base.</p></div>
            <div className="grid gap-3 lg:grid-cols-3">
              <select value={contractDraft.documentType} onChange={(event) => setContractDraft((prev) => ({ ...prev, documentType: event.target.value as 'CONTRATO' | 'COTIZACION' }))} className={inputClass}><option value="CONTRATO">Contrato</option><option value="COTIZACION">Cotización</option></select>
              <select value={contractDraft.clientId} onChange={(event) => { const client = snapshot.clients.find((item) => item.id === event.target.value); setContractDraft((prev) => ({ ...prev, clientId: event.target.value, eventType: client?.eventType || '', eventDate: client?.eventDate || '' })); }} className={inputClass} required><option value="">Selecciona prospecto o cliente</option>{snapshot.clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.recordType}</option>)}</select>
              <input value={contractDraft.folio} onChange={(event) => setContractDraft((prev) => ({ ...prev, folio: event.target.value }))} placeholder="Folio" className={inputClass} required />
              <input value={contractDraft.eventType} onChange={(event) => setContractDraft((prev) => ({ ...prev, eventType: event.target.value }))} placeholder="Tipo de evento" className={inputClass} required />
              <input type="date" value={contractDraft.eventDate} onChange={(event) => setContractDraft((prev) => ({ ...prev, eventDate: event.target.value }))} className={inputClass} required />
              <select value={contractDraft.paymentPolicy} onChange={(event) => setContractDraft((prev) => ({ ...prev, paymentPolicy: event.target.value as '40-30-30' | 'PERSONALIZADA' }))} className={inputClass}><option value="40-30-30">Política normal 40% / 30% / 30%</option><option value="PERSONALIZADA">Excepción / plan personalizado registrado</option></select>
            </div>
            {selectedContractClient ? <section className={`mt-4 rounded-xl border p-4 ${missingContractData.length ? 'border-amber-400/30 bg-amber-400/[.06]' : 'border-emerald-400/30 bg-emerald-400/[.06]'}`} aria-live="polite">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="text-sm font-bold text-white">Datos necesarios para generar</h4><p className={`mt-1 text-xs ${missingContractData.length ? 'text-amber-200' : 'text-emerald-200'}`}>{missingContractData.length ? `Faltan ${missingContractData.length} ${missingContractData.length === 1 ? 'dato' : 'datos'}. Completa la ficha antes de continuar. Los adicionales son opcionales.` : 'La información obligatoria está completa. Puedes generar el documento sin adicionales.'}</p></div><button type="button" onClick={() => openClientDetails(selectedContractClient)} className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold text-black">{missingContractData.length ? 'Completar ficha' : 'Editar paquete y servicios'}</button></div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{contractDataChecklist.filter((item) => item.required).map((item) => <li key={item.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${item.complete ? 'border-emerald-400/15 bg-emerald-400/[.04] text-emerald-200' : 'border-red-400/20 bg-red-400/[.05] text-red-200'}`}>{item.complete ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}<span>{item.label}</span></li>)}</ul>
            </section> : <div className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-400">Selecciona un prospecto o cliente para revisar automáticamente qué información falta.</div>}
            <button type="submit" disabled={busy || !selectedContractClient || missingContractData.length > 0} className="mt-4 w-full rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-35"><FileSignature className="mr-2 inline h-4 w-4" />{missingContractData.length ? `Faltan ${missingContractData.length} datos` : 'Generar y revisar'}</button>
          </form>

          <details className="rounded-2xl border border-white/10 bg-[#161C28]"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-300">Compatibilidad: cargar un contrato PDF anterior</summary><form onSubmit={uploadContract} className="grid gap-3 border-t border-white/10 p-5 lg:grid-cols-5">
            <select value={contractDraft.clientId} onChange={(event) => { const client = snapshot.clients.find((item) => item.id === event.target.value); setContractDraft((prev) => ({ ...prev, clientId: event.target.value, eventType: client?.eventType || '', eventDate: client?.eventDate || '' })); }} className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm" required><option value="">Selecciona cliente</option>{snapshot.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
            <input value={contractDraft.folio} onChange={(event) => setContractDraft((prev) => ({ ...prev, folio: event.target.value }))} placeholder="Folio" className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm" required />
            <input value={contractDraft.eventType} onChange={(event) => setContractDraft((prev) => ({ ...prev, eventType: event.target.value }))} placeholder="Tipo de evento" className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm" required />
            <input type="date" value={contractDraft.eventDate} onChange={(event) => setContractDraft((prev) => ({ ...prev, eventDate: event.target.value }))} className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm" required />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#D4AF37]/50 px-3 py-3 text-sm text-[#F5D76E]"><BriefcaseBusiness className="h-4 w-4" />{contractDraft.file?.name || 'Elegir PDF (máx. 5 MB)'}<input type="file" accept="application/pdf" className="hidden" onChange={(event) => setContractDraft((prev) => ({ ...prev, file: event.target.files?.[0] || null }))} /></label>
            <button type="submit" disabled={busy} className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black lg:col-span-5"><Save className="mr-2 inline h-4 w-4" />Guardar contrato privado</button>
          </form></details>

          {latestLink && <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 sm:flex-row sm:items-center"><input readOnly value={latestLink} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-2 text-xs" /><button onClick={() => navigator.clipboard.writeText(latestLink)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"><ClipboardCopy className="h-4 w-4" />Copiar</button></div>}

          <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
            <div className="space-y-3">{snapshot.contracts.map((contract) => <article key={contract.id} className="rounded-2xl border border-white/10 bg-[#161C28] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">{contract.clientName}</div><div className="text-xs text-gray-400">{contract.folio} · {contract.eventType} · {contract.eventDate}</div><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="text-[#F5D76E]">{contract.status}</span>{contract.documentSnapshot && <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-sky-300">{contract.documentType === 'COTIZACION' ? 'Cotización HTML' : 'Contrato HTML'}</span>}{contract.documentSnapshot && <span className="text-gray-500">Cliente: {contract.clientOpenCount || 0}/{contract.maxClientOpens || 2} accesos</span>}</div>{contract.clientSignedAt && <div className="mt-1 text-[11px] text-emerald-300">Firma del cliente: {dateTimeDisplay(contract.clientSignedAt)}</div>}{contract.ownerAuthorizedAt && <div className="mt-1 text-[11px] text-emerald-300">Firma de Javier: {dateTimeDisplay(contract.ownerAuthorizedAt)}</div>}</div><div className="flex flex-wrap gap-2">{contract.documentSnapshot ? <button onClick={() => previewContractDocument(contract)} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs"><Eye className="h-4 w-4" />Revisar documento</button> : <a href={adminContractPdfUrl(contract.id, 'latest', contractPdfRevision(contract))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs"><Eye className="h-4 w-4" />{contractViewLabel(contract)}</a>}<button onClick={() => createLink(contract)} disabled={busy || contract.status === 'Finalizado' || contract.documentType === 'COTIZACION'} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs disabled:opacity-40"><Send className="h-4 w-4" />Crear liga privada</button>{contract.status === 'Firmado por cliente' && <button onClick={() => finalize(contract)} disabled={busy || !snapshot.ownerSignatureConfigured} className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-3 py-2 text-xs font-bold text-black disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Autorizar y finalizar</button>}{session.role === 'SUPER_ADMIN' && <button onClick={() => removeContract(contract)} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/5 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"><Trash2 className="h-4 w-4" />Eliminar</button>}</div></div></article>)}{!snapshot.contracts.length && <div className="rounded-2xl border border-white/10 bg-[#161C28] p-10 text-center text-gray-500">Aún no hay contratos ni cotizaciones.</div>}</div>
            <aside className="rounded-2xl border border-white/10 bg-[#161C28] p-5 space-y-4"><div><div className="flex items-center gap-2 font-semibold"><PenLine className="h-4 w-4 text-[#D4AF37]" />Firma de Javier</div><p className="mt-1 text-xs text-gray-400">Se guarda privada y nunca se aplica automáticamente.</p></div><SignaturePad onChange={setOwnerSignature} label="Firma de autorización" /><button onClick={persistOwnerSignature} disabled={busy || !ownerSignature} className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-40">{snapshot.ownerSignatureConfigured ? 'Reemplazar firma guardada' : 'Guardar firma'}</button>{snapshot.ownerSignatureConfigured && <p className="text-xs text-emerald-300">Firma privada configurada.</p>}</aside>
          </div>
        </div>
      )}

      {tab === 'team' && session.role === 'SUPER_ADMIN' && <TeamAdminPanel snapshot={snapshot} onSnapshotChange={setSnapshot} notify={notify} superAdminEmail={session.email} />}
      {tab === 'email' && session.role === 'SUPER_ADMIN' && <GmailAdminPanel snapshot={snapshot} onSnapshotChange={setSnapshot} onRefresh={refresh} notify={notify} />}
      {tab === 'account' && <section className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#161C28] p-6"><div className="flex items-center gap-3"><UserCircle className="h-10 w-10 text-[#D4AF37]" /><div><h3 className="text-xl font-bold">{session.role === 'SUPER_ADMIN' ? 'Javier García' : currentTeamUser?.displayName || `${currentTeamUser?.name || ''} ${currentTeamUser?.lastName || ''}`.trim() || session.email}</h3><p className="text-sm text-gray-400">{session.role === 'SUPER_ADMIN' ? 'Super Admin' : currentTeamUser?.functionName || 'Colaborador'}</p></div></div><dl className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/10 p-4"><dt className="text-xs text-gray-500">Correo</dt><dd className="mt-1 break-all text-sm">{session.email || currentTeamUser?.email || 'Sin correo'}</dd></div><div className="rounded-xl border border-white/10 p-4"><dt className="text-xs text-gray-500">Estado de Google Calendar</dt><dd className={`mt-1 text-sm font-semibold ${session.role === 'SUPER_ADMIN' || currentTeamUser?.calendarConnected ? 'text-emerald-300' : 'text-amber-300'}`}>{session.role === 'SUPER_ADMIN' ? 'Cuenta principal administrada' : currentTeamUser?.calendarConnected ? 'Conectado' : 'Pendiente de conectar mediante invitación'}</dd></div><div className="rounded-xl border border-white/10 p-4 sm:col-span-2"><dt className="text-xs text-gray-500">Permisos vigentes</dt><dd className="mt-2 flex flex-wrap gap-2">{session.role === 'SUPER_ADMIN' ? <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">Acceso completo</span> : session.permissions.map((permission) => <span key={permission} className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-300">{permission}</span>)}</dd></div></dl><p className="mt-5 text-xs leading-5 text-gray-500">Los permisos solo los puede cambiar el Super Admin. La función visible del colaborador no concede privilegios administrativos.</p></section>}
      </div>
      {contractPreview?.documentSnapshot && <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`Vista previa ${contractPreview.folio}`}><div className="mx-auto mb-6 flex max-w-[850px] items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#161C28] p-3 text-white"><div><p className="text-xs text-[#D4AF37]">Revisión administrativa</p><p className="font-semibold">{contractPreview.folio} · versión congelada</p></div><button type="button" onClick={() => setContractPreview(null)} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm"><X className="h-4 w-4" />Cerrar</button></div><ContractDocument snapshot={contractPreview.documentSnapshot} folio={contractPreview.folio} /></div>}
      {internalEventDraft && session.role === 'SUPER_ADMIN' && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4"><form onSubmit={persistInternalEvent} className="my-6 w-full max-w-2xl rounded-2xl border border-violet-400/25 bg-[#161C28] p-5 shadow-2xl"><h3 className="text-lg font-semibold text-violet-100">Evento interno</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={internalEventDraft.title || ''} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, title: event.target.value })} placeholder="Título" className={`${inputClass} sm:col-span-2`} required /><select value={internalEventDraft.activityType || 'Junta'} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, activityType: event.target.value })} className={inputClass}>{['Junta','Capacitación','Mantenimiento','Compra de equipo','Bloqueo personal','Día no disponible','Otro'].map((item) => <option key={item}>{item}</option>)}</select><select value={internalEventDraft.visibility || 'SUPER_ADMIN'} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, visibility: event.target.value as InternalCalendarEvent['visibility'] })} className={inputClass}><option value="SUPER_ADMIN">Solo Super Admin</option><option value="SELECTED">Usuarios seleccionados</option></select><label className="text-xs text-gray-400">Fecha inicial<input type="date" value={dateValue(internalEventDraft.startDate)} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, startDate: event.target.value })} className={`${inputClass} mt-1`} required /></label><label className="text-xs text-gray-400">Hora inicial<input type="time" value={timeValue(internalEventDraft.startTime)} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, startTime: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-400">Fecha final<input type="date" value={dateValue(internalEventDraft.endDate)} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, endDate: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-400">Hora final<input type="time" value={timeValue(internalEventDraft.endTime)} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, endTime: event.target.value })} className={`${inputClass} mt-1`} /></label><input value={internalEventDraft.location || ''} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, location: event.target.value })} placeholder="Lugar" className={`${inputClass} sm:col-span-2`} /><textarea value={internalEventDraft.notes || ''} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, notes: event.target.value })} placeholder="Notas" className={`${inputClass} min-h-24 sm:col-span-2`} />{internalEventDraft.visibility === 'SELECTED' && <fieldset className="grid gap-2 rounded-xl border border-white/10 p-3 sm:col-span-2 sm:grid-cols-2"><legend className="px-2 text-xs text-gray-300">Usuarios con visibilidad</legend>{snapshot.users.filter((item) => item.status === 'ACTIVO').map((user) => <label key={user.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(internalEventDraft.userIds || []).includes(user.id)} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, userIds: event.target.checked ? [...(internalEventDraft.userIds || []), user.id] : (internalEventDraft.userIds || []).filter((id) => id !== user.id) })} />{user.displayName || `${user.name} ${user.lastName}`}</label>)}</fieldset>}<select value={internalEventDraft.status || 'ACTIVO'} onChange={(event) => setInternalEventDraft({ ...internalEventDraft, status: event.target.value as InternalCalendarEvent['status'] })} className={inputClass}><option>ACTIVO</option><option>CANCELADO</option></select></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setInternalEventDraft(null)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">Cancelar</button><button disabled={busy} className="rounded-xl bg-violet-200 px-4 py-2.5 text-sm font-bold text-violet-950">Guardar y sincronizar</button></div></form></div>}
    </section>
  );
};

const Metric = ({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) => <div className="rounded-2xl border border-white/10 bg-[#161C28] p-4"><div className="flex items-center gap-2 text-xs text-gray-400"><Icon className="h-4 w-4 text-[#D4AF37]" />{label}</div><div className="mt-2 text-xl font-bold">{value}</div></div>;
const DashboardGroup = ({ title, rows }: { title: string; rows: Array<[string, string | number]> }) => <section className="rounded-2xl border border-white/10 bg-[#161C28] p-4"><h3 className="font-semibold text-[#F5D76E]">{title}</h3><dl className="mt-3 divide-y divide-white/10">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-2 text-sm"><dt className="text-gray-400">{label}</dt><dd className="font-semibold text-white">{value}</dd></div>)}</dl></section>;
const FinancialRow = ({ label, value, detail }: { label: string; value: number; detail?: string }) => <div className="rounded-xl border border-white/5 bg-black/15 p-3"><dt className="text-xs text-gray-400">{label}</dt><dd className="mt-1 text-lg font-semibold">{money(value)}</dd>{detail && <p className="mt-1 text-[11px] leading-4 text-gray-500">{detail}</p>}</div>;

const ProviderClientView = ({ client, snapshot }: { client: CrmClient; snapshot: BusinessSnapshot }) => {
  const services = snapshot.services.filter((item) => item.clientId === client.id && item.included && !['No incluido', 'Anulado'].includes(item.status));
  const assignments = snapshot.assignments.filter((item) => item.clientId === client.id && item.status !== 'CANCELADA');
  return <div className="mx-auto max-w-5xl space-y-5 p-5 sm:p-8"><section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-300">Información operativa asignada</p><h3 className="mt-2 text-2xl font-bold">{client.name}</h3><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p><span className="block text-xs text-gray-500">Evento</span>{client.eventType || 'Por confirmar'}</p><p><span className="block text-xs text-gray-500">Fecha y hora</span>{dateValue(client.eventDate) || 'Sin fecha'} · {timeDisplay(client.eventTime) || 'Sin horario'}</p><p className="sm:col-span-2"><span className="block text-xs text-gray-500">Lugar</span>{client.eventLocation || 'Lugar pendiente'}</p></div></section><section className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><h4 className="font-semibold">Notas para proveedores</h4><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-300">{client.providerNotes || 'Sin indicaciones operativas adicionales.'}</p></section>{client.preSessionApplies && <section className="rounded-2xl border border-red-400/20 bg-red-500/5 p-5"><h4 className="font-semibold text-red-100">Sesión previa</h4><p className="mt-2 text-sm text-red-100/80">{client.preSessionType || 'Sesión previa'} · {dateValue(client.preSessionDate) || 'Pendiente por agendar'} · {timeDisplay(client.preSessionTime) || 'Sin horario'}</p><p className="mt-1 text-sm text-gray-300">{client.preSessionAddress || client.preSessionLocation || 'Lugar pendiente'}</p></section>}<section className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><h4 className="font-semibold">Servicios aplicables</h4><div className="mt-3 space-y-2">{services.map((item) => <div key={item.id} className="rounded-lg border border-white/10 p-3 text-sm"><div>{item.concept}</div><div className="mt-1 text-xs text-gray-500">Cantidad {item.quantity} · {item.status}</div></div>)}{!services.length && <p className="text-sm text-gray-500">Sin servicios operativos publicados.</p>}</div></div><div className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><h4 className="font-semibold">Personal asignado</h4><div className="mt-3 space-y-2">{assignments.map((item) => <div key={item.id} className="rounded-lg border border-white/10 p-3 text-sm"><div>{item.functionName || item.activityType}</div><div className="mt-1 text-xs text-gray-500">{item.startDate} · {timeDisplay(item.startTime)}–{timeDisplay(item.endTime)}</div></div>)}{!assignments.length && <p className="text-sm text-gray-500">Sin otras asignaciones visibles.</p>}</div></div></section></div>;
};

const ClientDetails = ({ client, paid, followUps, followUpDraft, onFollowUpChange, onFollowUpSubmit, onInlineSave, queuePosition, queueTotal, onQueueMove, busy }: { client: CrmClient; paid: number; followUps: CrmFollowUp[]; followUpDraft: Partial<CrmFollowUp>; onFollowUpChange: (value: Partial<CrmFollowUp>) => void; onFollowUpSubmit: (event: React.FormEvent) => void; onInlineSave: (patch: Partial<CrmClient>) => Promise<void>; queuePosition: number; queueTotal: number; onQueueMove: (offset: number) => void; busy: boolean }) => {
  const [editKey, setEditKey] = useState('');
  const [messageCopied, setMessageCopied] = useState(false);
  const [inlineDraft, setInlineDraft] = useState<Partial<CrmClient>>(client);
  useEffect(() => {
    setInlineDraft(client);
    setMessageCopied(false);
  }, [client]);
  const patchInline = (key: keyof CrmClient, value: unknown) => setInlineDraft((current) => ({ ...current, [key]: value }));
  const commitInline = async (keys: Array<keyof CrmClient>) => {
    const patch: Partial<CrmClient> = {};
    keys.forEach((key) => { (patch as Record<string, unknown>)[key] = inlineDraft[key]; });
    await onInlineSave(patch);
    setEditKey('');
  };
  const fields = [
    ['Responsable', 'Javier García'], ['Fecha de seguimiento', dateTimeDisplay(client.nextActionAt) || 'Sin programar'], ['Proyecto', client.status],
    ['Tipo de servicio', client.eventType || 'Por confirmar'], ['Origen del cliente', client.source || 'Sin registrar'], ['Campaña', client.campaign || 'Sin campaña'],
  ];
  const pending: Array<[string, boolean, string, Array<keyof CrmClient>]> = [
    ['Datos de contacto', Boolean(client.phone || client.email), 'contact', ['phone', 'email']], ['Fecha y horario del evento', Boolean(dateValue(client.eventDate) && timeValue(client.eventTime)), 'eventDate', ['eventDate', 'eventTime']],
    ['Lugar del evento', Boolean(client.eventLocation), 'location', ['eventLocation']], ['Paquete y total', Boolean(client.packageName && client.totalAmount > 0), 'package', ['packageName', 'totalAmount']],
    ['Sesión previa', !client.preSessionApplies || Boolean(dateValue(client.preSessionDate) && timeValue(client.preSessionTime) && client.preSessionLocation), 'session', ['preSessionApplies', 'preSessionDate', 'preSessionTime', 'preSessionLocation']],
  ];
  return <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
    <div className="border-b border-white/10 pb-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">Seguimiento de cliente</p><h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{client.nextAction || client.name || 'Cliente sin nombre'}</h3><p className="mt-2 text-sm text-gray-400">{client.name || 'Sin nombre'} · {client.recordType} · {client.phone || 'Sin teléfono'}</p></div>{queuePosition >= 0 && <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2"><button type="button" onClick={() => onQueueMove(-1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-200">← Anterior</button><span className="px-2 text-xs font-semibold text-[#F5D76E]">{queuePosition + 1} de {queueTotal}</span><button type="button" onClick={() => onQueueMove(1)} className="rounded-lg bg-[#D4AF37] px-3 py-2 text-xs font-bold text-black">Siguiente →</button></div>}</div></div>
    <dl className="divide-y divide-white/10 py-3">{fields.map(([label, value], index) => <div key={label} className="grid gap-2 py-3 text-sm sm:grid-cols-[180px_1fr]"><dt className="text-gray-400">{label}</dt><dd><span className={`inline-flex rounded-md px-2.5 py-1 ${index >= 2 ? 'bg-[#D4AF37]/15 text-[#F5D76E]' : 'text-gray-100'}`}>{String(value)}</span></dd></div>)}</dl>
    <section className="border-t border-white/10 py-6"><div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/[0.06] p-4 sm:p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Etapa y seguimiento</p><h4 className="mt-1 text-sm font-semibold text-white">Actualiza aquí el estado que también aparece en el Centro de ejecución</h4></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-gray-300">Etapa actual<select value={inlineDraft.status || 'Nuevo'} onChange={(event) => patchInline('status', event.target.value)} className={`${inputClass} mt-1`}><option>Nuevo</option><option>Contactado</option><option>Cotización enviada</option><option>Esperando respuesta</option><option>Seguimiento pendiente</option><option>Interesado</option><option>Negociación</option><option>Por cerrar</option><option>Cierre prioritario</option><option>Contratado</option><option>No responde</option><option>No interesado</option><option>Sin interés</option><option>Archivado</option></select></label><label className="text-xs text-gray-300">Fecha del próximo seguimiento<input type="datetime-local" value={dateTimeLocalValue(inlineDraft.nextActionAt)} onChange={(event) => patchInline('nextActionAt', event.target.value)} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-300 sm:col-span-2">Seguimiento que corresponde<input value={inlineDraft.nextAction || ''} onChange={(event) => patchInline('nextAction', event.target.value)} placeholder="Ej. Enviar cotización, llamar, confirmar apartado…" className={`${inputClass} mt-1`} /></label><button type="button" disabled={busy} onClick={() => commitInline(['status', 'nextAction', 'nextActionAt'])} className="w-fit rounded-lg bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">Guardar etapa y seguimiento</button></div></div></section>
    <section className="border-t border-white/10 py-6"><h4 className="text-sm font-semibold text-gray-200">Descripción</h4><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-300">{client.notes || client.objection || 'Sin descripción registrada. Usa “Editar seguimiento” para agregar contexto, acuerdos y observaciones.'}</p></section>
    {client.suggestedMessage && <section className="border-t border-white/10 py-6"><div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/[0.07] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Mensaje propuesto</p><h4 className="mt-1 text-sm font-semibold text-white">Listo para revisar y enviar por WhatsApp</h4></div><button type="button" onClick={async () => { await navigator.clipboard.writeText(client.suggestedMessage || ''); setMessageCopied(true); window.setTimeout(() => setMessageCopied(false), 1800); }} className="inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/40 bg-black/20 px-3 py-2 text-xs font-semibold text-[#F5D76E] hover:bg-[#D4AF37]/10"><ClipboardCopy className="h-4 w-4" />{messageCopied ? 'Copiado' : 'Copiar mensaje'}</button></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-100">{client.suggestedMessage}</p>{client.nextActionAt && <p className="mt-4 border-t border-white/10 pt-3 text-xs text-gray-400">Seguimiento programado: <span className="font-semibold text-sky-200">{dateTimeDisplay(client.nextActionAt)}</span></p>}</div></section>}
    <section className="border-t border-white/10 py-6"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-gray-200">Pendientes del expediente</h4><span className="text-xs text-gray-500">{pending.filter(([, done]) => done).length} de {pending.length} completos</span></div><div className="mt-4 divide-y divide-white/10 border-y border-white/10">{pending.map(([label, done, key, keys]) => <div key={key} className="py-3 text-sm"><button type="button" onClick={() => setEditKey(editKey === key ? '' : key)} className="flex w-full items-center gap-3 text-left"><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${done ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300' : 'border-gray-500 text-transparent'}`}>✓</span><span className={done ? 'text-gray-400 line-through' : 'text-gray-100'}>{label}</span><span className="ml-auto text-xs text-[#D4AF37]">{editKey === key ? 'Cerrar' : '›'}</span></button>{editKey === key && <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/15 p-3 sm:grid-cols-2">{key === 'contact' && <><input value={inlineDraft.phone || ''} onChange={(event) => patchInline('phone', event.target.value)} placeholder="Teléfono" className={inputClass} /><input type="email" value={inlineDraft.email || ''} onChange={(event) => patchInline('email', event.target.value)} placeholder="Correo" className={inputClass} /></>}{key === 'eventDate' && <><label className="text-xs text-gray-400">Fecha<input type="date" value={dateValue(inlineDraft.eventDate)} onChange={(event) => patchInline('eventDate', event.target.value)} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-400">Horario<input type="time" value={timeValue(inlineDraft.eventTime)} onChange={(event) => patchInline('eventTime', event.target.value)} className={`${inputClass} mt-1`} /></label></>}{key === 'location' && <input value={inlineDraft.eventLocation || ''} onChange={(event) => patchInline('eventLocation', event.target.value)} placeholder="Lugar y dirección del evento" className={`${inputClass} sm:col-span-2`} />}{key === 'package' && <><input value={inlineDraft.packageName || ''} onChange={(event) => patchInline('packageName', event.target.value)} placeholder="Paquete contratado" className={inputClass} /><input type="number" min="0" step="0.01" value={inlineDraft.totalAmount || 0} onChange={(event) => patchInline('totalAmount', Number(event.target.value))} placeholder="Total contratado" className={inputClass} /></>}{key === 'session' && <><label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 text-sm"><input type="checkbox" checked={Boolean(inlineDraft.preSessionApplies)} onChange={(event) => patchInline('preSessionApplies', event.target.checked)} />Aplica sesión</label><input type="date" value={dateValue(inlineDraft.preSessionDate)} onChange={(event) => patchInline('preSessionDate', event.target.value)} className={inputClass} disabled={!inlineDraft.preSessionApplies} /><input type="time" value={timeValue(inlineDraft.preSessionTime)} onChange={(event) => patchInline('preSessionTime', event.target.value)} className={inputClass} disabled={!inlineDraft.preSessionApplies} /><input value={inlineDraft.preSessionLocation || ''} onChange={(event) => patchInline('preSessionLocation', event.target.value)} placeholder="Lugar de la sesión" className={inputClass} disabled={!inlineDraft.preSessionApplies} /></>}<button type="button" disabled={busy} onClick={() => commitInline(keys)} className="w-fit rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">OK</button></div>}</div>)}</div></section>
    <section className="grid gap-5 border-t border-white/10 py-6 lg:grid-cols-2"><div><h4 className="text-sm font-semibold text-gray-200">Información del evento</h4><div className="mt-3 space-y-2 text-sm text-gray-300"><p>{client.eventType || 'Evento por confirmar'} · {dateValue(client.eventDate) || 'Sin fecha'} · {timeDisplay(client.eventTime) || 'Sin horario'}</p><p>{client.eventLocation || 'Lugar pendiente'}</p><p>{client.packageName || 'Paquete pendiente'} · {client.serviceHours ? `${client.serviceHours} horas` : 'Cobertura pendiente'}</p></div></div><div><h4 className="text-sm font-semibold text-gray-200">Control de cobro</h4><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><span className="block text-xs text-gray-500">Total</span>{money(client.totalAmount)}</div><div><span className="block text-xs text-gray-500">Pagado</span><span className="text-emerald-300">{money(paid)}</span></div><div><span className="block text-xs text-gray-500">Pendiente</span><span className="text-amber-300">{money(Math.max(0, Number(client.totalAmount || 0) - paid))}</span></div></div></div></section>
    <section className="border-t border-white/10 py-6"><h4 className="text-sm font-semibold text-gray-200">Actividad</h4><div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-black/15 p-4 sm:grid-cols-2"><label className="text-xs text-gray-400">Último contacto<input type="datetime-local" value={dateTimeLocalValue(inlineDraft.lastContactAt)} onChange={(event) => patchInline('lastContactAt', event.target.value)} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-400">Próxima fecha<input type="datetime-local" value={dateTimeLocalValue(inlineDraft.nextActionAt)} onChange={(event) => patchInline('nextActionAt', event.target.value)} className={`${inputClass} mt-1`} /></label><input value={inlineDraft.nextAction || ''} onChange={(event) => patchInline('nextAction', event.target.value)} placeholder="Próxima acción" className={inputClass} /><input type="number" min="0" step="1" value={inlineDraft.followUpAttempts || 0} onChange={(event) => patchInline('followUpAttempts', Number(event.target.value))} placeholder="Intentos de seguimiento" className={inputClass} /><button type="button" disabled={busy} onClick={() => commitInline(['lastContactAt', 'nextActionAt', 'nextAction', 'followUpAttempts'])} className="w-fit rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">Guardar actividad</button></div><h4 className="mt-6 text-sm font-semibold text-gray-200">Registrar resultado y continuar</h4><p className="mt-1 text-xs text-gray-400">El resultado se agrega al historial; nunca reemplaza seguimientos anteriores.</p><form onSubmit={onFollowUpSubmit} className="mt-4 grid gap-3 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.04] p-4 sm:grid-cols-2"><label className="text-xs text-gray-400">Fecha y hora<input type="datetime-local" value={dateTimeLocalValue(followUpDraft.occurredAt)} onChange={(event) => onFollowUpChange({ ...followUpDraft, occurredAt: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-400">¿Qué ocurrió?<select required value={followUpDraft.result || ''} onChange={(event) => onFollowUpChange({ ...followUpDraft, result: event.target.value })} className={`${inputClass} mt-1`}><option value="">Selecciona un resultado</option><option>Seguimiento realizado</option><option>No respondió</option><option>No se realizó</option><option>Reprogramado</option><option>Interesado</option><option>No interesado</option><option>Contratado</option></select></label><textarea value={followUpDraft.conversation || ''} onChange={(event) => onFollowUpChange({ ...followUpDraft, conversation: event.target.value })} placeholder="Resumen: qué respondió, acuerdos y contexto" className={`${inputClass} min-h-24 sm:col-span-2`} /><label className="text-xs text-gray-400">Siguiente seguimiento<input type="datetime-local" value={dateTimeLocalValue(followUpDraft.nextActionAt)} onChange={(event) => onFollowUpChange({ ...followUpDraft, nextActionAt: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-400">Próxima acción<input value={followUpDraft.nextAction || ''} onChange={(event) => onFollowUpChange({ ...followUpDraft, nextAction: event.target.value })} placeholder="Llamar, enviar propuesta, confirmar…" className={`${inputClass} mt-1`} /></label><button type="submit" disabled={busy} className="w-fit rounded-lg bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">Guardar y ver siguiente</button></form></section>
    <section className="border-t border-white/10 py-6"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-gray-200">Historial de seguimientos</h4><span className="text-xs text-gray-500">{followUps.length} registro(s)</span></div><div className="mt-4 space-y-3">{followUps.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><time className="text-xs font-semibold text-[#D4AF37]">{dateTimeDisplay(item.occurredAt)}</time><span className="text-xs text-gray-500">{item.createdBy}</span></div><p className="mt-3 whitespace-pre-wrap text-sm text-gray-200">{item.conversation || 'Sin conversación capturada'}</p>{item.result && <p className="mt-2 text-sm text-gray-400">Resultado: {item.result}</p>}{item.nextAction && <p className="mt-2 text-xs text-sky-200">Siguiente: {item.nextAction} · {dateTimeDisplay(item.nextActionAt) || 'sin fecha'}</p>}</article>)}{!followUps.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">Aún no hay seguimientos históricos. El siguiente registro se conservará sin sobrescribir los anteriores.</p>}</div></section>
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
    <label className="text-xs text-gray-400">Fecha del evento<input type="date" value={dateValue(draft.eventDate)} onChange={(e) => patch('eventDate', e.target.value)} className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-400">Hora del evento<input type="time" value={timeValue(draft.eventTime)} onChange={(e) => patch('eventTime', e.target.value)} className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-400">Horas de cobertura<input type="number" min="0" step="0.5" value={draft.serviceHours || 0} onChange={(e) => patch('serviceHours', Number(e.target.value))} className={`${inputClass} mt-1`} /></label>
    <input value={draft.eventLocation || ''} onChange={(e) => patch('eventLocation', e.target.value)} placeholder="Lugar del evento" className={inputClass} />
    <input value={draft.packageName || ''} onChange={(e) => patch('packageName', e.target.value)} placeholder="Paquete" className={inputClass} />
    <label className="text-xs text-gray-400">Total contratado<input type="number" min="0" step="0.01" value={draft.totalAmount || 0} onChange={(e) => patch('totalAmount', Number(e.target.value))} className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-400">Monto pagado<input type="number" min="0" step="0.01" value={draft.paidAmount || 0} onChange={(e) => patch('paidAmount', Number(e.target.value))} className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-400">Costo estimado del evento<input type="number" min="0" step="0.01" value={draft.estimatedCost || 0} onChange={(e) => patch('estimatedCost', Number(e.target.value))} className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-400">Publicidad asignada<input type="number" min="0" step="0.01" value={draft.allocatedAdCost || 0} onChange={(e) => patch('allocatedAdCost', Number(e.target.value))} className={`${inputClass} mt-1`} /></label>
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
    <label className="text-xs text-gray-400">Fecha del primer contacto<input type="date" value={(draft.firstContactAt || '').slice(0,10)} onChange={(e) => patch('firstContactAt', e.target.value)} className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-400">Fecha del último contacto<input type="date" value={(draft.lastContactAt || '').slice(0,10)} onChange={(e) => patch('lastContactAt', e.target.value)} className={`${inputClass} mt-1`} /></label>
    <input value={draft.nextAction || ''} onChange={(e) => patch('nextAction', e.target.value)} placeholder="Próxima acción" className={inputClass} />
    <label className="text-xs text-gray-400">Fecha del próximo seguimiento<input type="datetime-local" value={dateTimeLocalValue(draft.nextActionAt)} onChange={(e) => patch('nextActionAt', e.target.value)} className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-400">Intentos de seguimiento<input type="number" min="0" step="1" value={draft.followUpAttempts || 0} onChange={(e) => patch('followUpAttempts', Number(e.target.value))} className={`${inputClass} mt-1`} /></label>
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
  const applyPercentage = (percentage: number) => {
    onChange({
      ...draft,
      percentage,
      plannedAmount: percentage > 0 ? Number(((packageTotal * percentage) / 100).toFixed(2)) : Number(draft.plannedAmount || 0),
      updatedAt: now(),
    });
  };
  const applyStatus = (status: BusinessPayment['status']) => onChange({
    ...draft,
    status,
    receivedAmount: status === 'Pendiente' ? 0 : status === 'Liquidado' ? Number(draft.plannedAmount || 0) : Number(draft.receivedAmount || 0),
    paidAt: status === 'Pendiente' ? '' : draft.paidAt || now().slice(0, 16),
    updatedAt: now(),
  });
  const remaining = Math.max(0, Number(draft.plannedAmount || 0) - (draft.status === 'Anulado' ? 0 : Number(draft.receivedAmount || 0)));
  return <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#161C28] p-5 sm:grid-cols-2 lg:grid-cols-4">
    <label className="text-xs text-gray-300">Cliente<select value={draft.clientId || ''} onChange={(e) => { const client = clients.find((item) => item.id === e.target.value); const contract = contracts.find((item) => item.clientId === e.target.value); const percentage = Number(draft.percentage || 30); onChange({ ...draft, clientId: e.target.value, contractId: contract?.id || '', plannedAmount: Number((((Number(client?.totalAmount) || 0) * percentage) / 100).toFixed(2)) }); }} className={`${inputClass} mt-1`} required><option value="">Selecciona cliente</option>{clients.filter((client) => client.recordType === 'Cliente' || client.status === 'Contratado').map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
    <label className="text-xs text-gray-300">Contrato<select value={draft.contractId || ''} onChange={(e) => patch('contractId', e.target.value)} className={`${inputClass} mt-1`}><option value="">Sin contrato relacionado</option>{clientContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.folio}</option>)}</select></label>
    <label className="text-xs text-gray-300">Número de pago<input type="number" min="0" max="99" step="1" value={draft.installmentNumber || 0} onChange={(e) => patch('installmentNumber', Number(e.target.value))} className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-300">Porcentaje opcional<div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0F17] px-3 text-sm text-gray-300"><input type="number" min="0" max="100" step="0.01" value={draft.percentage || 0} onChange={(e) => applyPercentage(Number(e.target.value))} className="w-full bg-transparent py-3 outline-none" /><span>%</span></div></label>
    <div className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 px-3 py-2 text-xs text-gray-300"><div>Total contratado: <strong className="text-white">{money(packageTotal)}</strong></div><div>Pago programado: <strong className="text-[#D4AF37]">{money(Number(draft.plannedAmount || 0))}</strong></div><div>Pendiente de este pago: <strong className="text-amber-300">{money(remaining)}</strong></div></div>
    <label className="text-xs text-gray-300">Fecha programada<input type="date" value={draft.date || today()} onChange={(e) => patch('date', e.target.value)} className={`${inputClass} mt-1`} required /></label>
    <label className="text-xs text-gray-300">Fecha límite<input type="date" value={draft.dueDate || ''} onChange={(e) => patch('dueDate', e.target.value)} className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-300">Concepto<input value={draft.concept || ''} onChange={(e) => patch('concept', e.target.value)} placeholder="Apartado, segundo pago, finiquito" className={`${inputClass} mt-1`} required /></label>
    <label className="text-xs text-gray-300">Cantidad programada<input type="number" min="0.01" step="0.01" value={draft.plannedAmount || 0} onChange={(e) => patch('plannedAmount', Number(e.target.value))} placeholder="Monto programado" className={`${inputClass} mt-1`} required /></label>
    <label className="text-xs text-gray-300">Cantidad realmente recibida<input type="number" min="0" max={Number(draft.plannedAmount || 0) || undefined} step="0.01" value={draft.receivedAmount || 0} onChange={(e) => patch('receivedAmount', Number(e.target.value))} placeholder="0.00" className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-300">Estado<select value={draft.status || 'Pendiente'} onChange={(e) => applyStatus(e.target.value as BusinessPayment['status'])} className={`${inputClass} mt-1`}><option>Pendiente</option><option>Parcial</option><option>Liquidado</option><option>Anulado</option></select></label>
    <label className="text-xs text-gray-300">Fecha real de pago<input type="datetime-local" value={dateTimeLocalValue(draft.paidAt)} onChange={(e) => patch('paidAt', e.target.value)} disabled={draft.status === 'Pendiente' || draft.status === 'Anulado'} className={`${inputClass} mt-1 disabled:opacity-40`} /></label>
    <label className="text-xs text-gray-300">Método de pago<input value={draft.method || ''} onChange={(e) => patch('method', e.target.value)} placeholder="Transferencia, efectivo…" className={`${inputClass} mt-1`} /></label>
    <label className="text-xs text-gray-300">Referencia<input value={draft.reference || ''} onChange={(e) => patch('reference', e.target.value)} placeholder="Folio o referencia" className={`${inputClass} mt-1`} /></label>
    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-sm text-gray-300">{receipt?.name || draft.receiptFileName || 'Comprobante JPG, PNG o PDF'}<input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => onReceipt(e.target.files?.[0] || null)} /></label>
    <textarea value={draft.notes || ''} onChange={(e) => patch('notes', e.target.value)} placeholder="Notas" className={`${inputClass} min-h-20 lg:col-span-1`} />
    <p className="text-xs leading-5 text-gray-400 sm:col-span-2 lg:col-span-4">Pendiente no aumenta ingresos ni balance. Si recibes menos de lo programado se guarda como Parcial y solo se contabiliza lo recibido. Liquidado activa exactamente un movimiento; revertirlo anula ese mismo movimiento sin borrar el historial.</p>
    <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button type="button" onClick={onCancel} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">Limpiar</button><button type="submit" disabled={busy} className="rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40">{draft.id ? 'Actualizar pago' : 'Registrar pago'}</button></div>
  </form>;
};
