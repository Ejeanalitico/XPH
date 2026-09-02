import { GalleryImage, PackageOption } from '../types';
import { BusinessContract, BusinessExpense, BusinessPayment, BusinessSnapshot, ClientAddon, ClientGalleryRecord, ClientPackageSnapshot, ContractDocumentSnapshot, ContractedService, CrmClient, CrmFollowUp, CrmNotification, EmailHistory, EmailTemplate, FinancialAdjustment, FinancialTransaction, GmailConfig, InternalCalendarEvent, TeamAssignment, TeamFunction, TeamUser } from '../types/business';
import { CURRENT_CATALOG_VERSION, resolvePublishedAddons, resolvePublishedPackages } from './catalogMerge';

export type AdminSession = {
  authenticated: true;
  email?: string;
  userId: string;
  role: 'SUPER_ADMIN' | 'COLLABORATOR';
  permissions: string[];
};

export type DriveImageRecord = {
  id: string;
  name: string;
  url: string;
  driveUrl?: string;
  createdTime?: string;
};

export type AnalyticsBreakdownRow = Record<string, string | number | null | undefined>;

export type SearchConsoleRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleAnalytics = {
  connected: boolean;
  property: string;
  period: 7 | 28 | 90;
  range: { startDate: string; endDate: string } | null;
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  queries: SearchConsoleRow[];
  pages: SearchConsoleRow[];
  countries: SearchConsoleRow[];
  devices: SearchConsoleRow[];
  message?: string;
};

export type AdminAnalytics = {
  connected: boolean;
  period: 7 | 28 | 90;
  range: { since: string; until: string };
  totals: {
    visitors: number;
    pageviews: number;
    leads: number;
    conversionRate: number;
  };
  trends: AnalyticsBreakdownRow[];
  countries: AnalyticsBreakdownRow[];
  referrers: AnalyticsBreakdownRow[];
  pages: AnalyticsBreakdownRow[];
  devices: AnalyticsBreakdownRow[];
  leadsByDay: Array<{ date: string; count: number }>;
  leadsByService: Array<{ label: string; count: number }>;
  searchConsole: SearchConsoleAnalytics;
  message?: string;
};

let activeAdminSession: AdminSession | null = null;

export function getCurrentAdminSession(): AdminSession | null {
  return activeAdminSession;
}

async function parseResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === 'error') {
    throw new Error(data?.message || `Solicitud fallida (${res.status})`);
  }
  return data;
}

export async function resumeAdminSession(): Promise<AdminSession | null> {
  const res = await fetch('/api/proxy?action=adminSession', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await parseResponse(res);
  if (!data.authenticated) {
    activeAdminSession = null;
    return null;
  }
  activeAdminSession = { authenticated: true, email: data.email || '', userId: data.userId || '', role: data.role || 'COLLABORATOR', permissions: Array.isArray(data.permissions) ? data.permissions : [] };
  return activeAdminSession;
}

export async function adminLogin(email: string, password: string): Promise<AdminSession> {
  const res = await fetch('/api/proxy?action=adminLogin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await parseResponse(res);
  if (!data.authenticated) throw new Error('Credenciales incorrectas.');
  activeAdminSession = { authenticated: true, email: data.email || email, userId: data.userId || 'xph-super-admin', role: data.role || 'SUPER_ADMIN', permissions: Array.isArray(data.permissions) ? data.permissions : ['*'] };
  return activeAdminSession;
}

export async function adminLogout(): Promise<void> {
  await fetch('/api/proxy?action=adminLogout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => null);
  activeAdminSession = null;
  businessClientsCache = null;
  businessSnapshotCache = null;
  if (typeof window !== 'undefined') {
    Object.keys(window.sessionStorage).filter((key) => key.startsWith(`${BUSINESS_SNAPSHOT_CACHE_KEY}:`)).forEach((key) => window.sessionStorage.removeItem(key));
  }
}

export async function loadAdminConfig(_session?: AdminSession | null): Promise<Record<string, any>> {
  const res = await fetch('/api/proxy?action=adminConfig', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: '{}',
  });
  const data = await parseResponse(res);
  const config = data.config || {};

  // During migration, keep the complete current catalog while overlaying any
  // matching cloud edits. After the next catalog save, cloud is authoritative.
  config.packages = resolvePublishedPackages(config);
  config.addons = resolvePublishedAddons(config);

  return config;
}

export async function loadDriveImages(_session?: AdminSession | null): Promise<DriveImageRecord[]> {
  const res = await fetch('/api/proxy?action=adminDriveList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: '{}',
  });
  const data = await parseResponse(res);
  return Array.isArray(data.images) ? data.images : [];
}

export async function loadAdminAnalytics(
  _session?: AdminSession | null,
  period: 7 | 28 | 90 = 28,
): Promise<AdminAnalytics> {
  const res = await fetch('/api/proxy?action=adminAnalytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ period }),
  });
  const data = await parseResponse(res);
  return data.analytics as AdminAnalytics;
}

export async function saveAdminConfig(
  _session: AdminSession | null | undefined,
  patch: Record<string, any>,
  auditType = 'ACTUALIZACION_ADMIN',
  auditDetails = 'Cambios guardados desde el panel administrador'
): Promise<Record<string, any>> {
  const normalizedPatch = { ...patch };
  if ('packages' in patch || 'addons' in patch) {
    normalizedPatch.catalogVersion = CURRENT_CATALOG_VERSION;
  }

  const res = await fetch('/api/proxy?action=adminSaveConfig', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ patch: normalizedPatch, auditType, auditDetails }),
  });
  const data = await parseResponse(res);
  return data.config || {};
}

async function adminBusinessRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`/api/proxy?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data as T;
}

const BUSINESS_SNAPSHOT_CACHE_KEY = 'xph-business-snapshot-v3';
let businessSnapshotCache: { scope: string; snapshot: BusinessSnapshot } | null = null;

function normalizeBusinessSnapshot(snapshot?: Partial<BusinessSnapshot> | null): BusinessSnapshot {
  return {
    clients: Array.isArray(snapshot?.clients) ? snapshot.clients : [],
    followUps: Array.isArray(snapshot?.followUps) ? snapshot.followUps : [],
    expenses: Array.isArray(snapshot?.expenses) ? snapshot.expenses : [],
    payments: Array.isArray(snapshot?.payments) ? snapshot.payments : [],
    transactions: Array.isArray(snapshot?.transactions) ? snapshot.transactions : [],
    adjustments: Array.isArray(snapshot?.adjustments) ? snapshot.adjustments : [],
    packageSnapshots: Array.isArray(snapshot?.packageSnapshots) ? snapshot.packageSnapshots : [],
    services: Array.isArray(snapshot?.services) ? snapshot.services : [],
    addons: Array.isArray(snapshot?.addons) ? snapshot.addons : [],
    users: Array.isArray(snapshot?.users) ? snapshot.users : [],
    teamFunctions: Array.isArray(snapshot?.teamFunctions) ? snapshot.teamFunctions : [],
    assignments: Array.isArray(snapshot?.assignments) ? snapshot.assignments : [],
    gmailConfig: snapshot?.gmailConfig || null,
    emailTemplates: Array.isArray(snapshot?.emailTemplates) ? snapshot.emailTemplates : [],
    emailHistory: Array.isArray(snapshot?.emailHistory) ? snapshot.emailHistory : [],
    notifications: Array.isArray(snapshot?.notifications) ? snapshot.notifications : [],
    auditLog: Array.isArray(snapshot?.auditLog) ? snapshot.auditLog : [],
    galleries: Array.isArray(snapshot?.galleries) ? snapshot.galleries : [],
    internalEvents: Array.isArray(snapshot?.internalEvents) ? snapshot.internalEvents.map((item) => ({ ...item, userIds: Array.isArray(item.userIds) ? item.userIds : [] })) : [],
    contracts: Array.isArray(snapshot?.contracts) ? snapshot.contracts : [],
    ownerSignatureConfigured: Boolean(snapshot?.ownerSignatureConfigured),
  };
}

type DeletedBusinessContractState = {
  seoSettings: Record<string, any>;
  ids: string[];
};

async function loadDeletedBusinessContractState(): Promise<DeletedBusinessContractState> {
  try {
    const config = await loadAdminConfig(activeAdminSession);
    const seoSettings = config?.seoSettings && typeof config.seoSettings === 'object' && !Array.isArray(config.seoSettings)
      ? { ...config.seoSettings }
      : {};
    const ids = Array.isArray(seoSettings.deletedContractIds)
      ? seoSettings.deletedContractIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [];
    return { seoSettings, ids };
  } catch (_) {
    return { seoSettings: {}, ids: [] };
  }
}

export async function loadBusinessSnapshot(force = false): Promise<BusinessSnapshot> {
  const [data, deletedState] = await Promise.all([
    adminBusinessRequest<{ snapshot: BusinessSnapshot }>('adminBusinessSnapshot', { force }),
    loadDeletedBusinessContractState(),
  ]);
  const snapshot = normalizeBusinessSnapshot(data.snapshot);
  if (!deletedState.ids.length) return snapshot;
  const deleted = new Set(deletedState.ids);
  return { ...snapshot, contracts: snapshot.contracts.filter((contract) => !deleted.has(String(contract.id))) };
}

export async function deleteBusinessContract(contractId: string): Promise<void> {
  const id = String(contractId || '').trim();
  if (!id) throw new Error('Contrato no identificado.');
  const deletedState = await loadDeletedBusinessContractState();
  if (!deletedState.ids.includes(id)) {
    await saveAdminConfig(
      activeAdminSession,
      { seoSettings: { ...deletedState.seoSettings, deletedContractIds: [...deletedState.ids, id] } },
      'CONTRATO_ELIMINADO_PANEL',
      'Contrato ' + id + ' eliminado del panel administrativo',
    );
  }
  businessSnapshotCache = null;
}

export function readCachedBusinessSnapshot(scope: string): BusinessSnapshot | null {
  if (businessSnapshotCache?.scope === scope) return businessSnapshotCache.snapshot;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${BUSINESS_SNAPSHOT_CACHE_KEY}:${scope}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { snapshot?: Partial<BusinessSnapshot> };
    const snapshot = normalizeBusinessSnapshot(parsed.snapshot);
    businessSnapshotCache = { scope, snapshot };
    return snapshot;
  } catch (_) {
    window.sessionStorage.removeItem(`${BUSINESS_SNAPSHOT_CACHE_KEY}:${scope}`);
    return null;
  }
}

export function cacheBusinessSnapshot(snapshot: BusinessSnapshot, scope: string): void {
  const normalized = normalizeBusinessSnapshot(snapshot);
  businessSnapshotCache = { scope, snapshot: normalized };
  businessClientsCache = normalized.clients;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${BUSINESS_SNAPSHOT_CACHE_KEY}:${scope}`, JSON.stringify({ snapshot: normalized }));
  } catch (_) {}
}

let businessClientsCache: CrmClient[] | null = null;

export async function loadBusinessClients(force = false): Promise<CrmClient[]> {
  if (!force && businessClientsCache) return businessClientsCache;
  const data = await adminBusinessRequest<{ clients: CrmClient[] }>('adminBusinessClients');
  businessClientsCache = Array.isArray(data.clients) ? data.clients : [];
  return businessClientsCache;
}

export function cacheBusinessClients(clients: CrmClient[]): void {
  businessClientsCache = clients;
}

export async function saveCrmClient(client: Partial<CrmClient>): Promise<CrmClient> {
  const data = await adminBusinessRequest<{ client: CrmClient }>('adminCrmUpsert', { client });
  return data.client;
}

export async function createCrmFollowUp(followUp: Partial<CrmFollowUp> & { recordId: string }): Promise<{ followUp: CrmFollowUp; client: CrmClient }> {
  return await adminBusinessRequest('adminFollowUpCreate', { followUp });
}

export async function convertProspectToClient(prospectId: string): Promise<CrmClient> {
  const data = await adminBusinessRequest<{ client: CrmClient }>('adminProspectConvert', { prospectId });
  return data.client;
}

export async function syncClientCalendar(client: CrmClient): Promise<CrmClient> {
  const data = await adminBusinessRequest<{ client: CrmClient }>('adminCalendarSync', { clientId: client.id });
  return data.client;
}

export type CalendarSyncSummary = {
  processed: number;
  synchronized: number;
  failed: number;
  created: number;
  updated: number;
  duplicatesDeleted: number;
};

export async function syncAllClientCalendars(): Promise<{ clients: CrmClient[]; summary: CalendarSyncSummary }> {
  return await adminBusinessRequest('adminCalendarSyncAll');
}

export async function saveBusinessExpense(expense: Partial<BusinessExpense>): Promise<BusinessExpense> {
  const data = await adminBusinessRequest<{ expense: BusinessExpense }>('adminExpenseUpsert', { expense });
  return data.expense;
}

export async function saveBusinessPayment(payment: Partial<BusinessPayment>, receipt?: File | null): Promise<{ payment: BusinessPayment; transaction: FinancialTransaction; client: CrmClient }> {
  let receiptData: Record<string, unknown> = {};
  if (receipt) {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(receipt.type)) throw new Error('El comprobante debe ser JPG, PNG o PDF.');
    if (receipt.size > 2_600_000) throw new Error('El comprobante debe pesar máximo 2.6 MB.');
    receiptData = { receiptBase64: await fileToDataUrl(receipt), receiptFileName: receipt.name, receiptMimeType: receipt.type };
  }
  return await adminBusinessRequest('adminPaymentUpsert', { payment: { ...payment, ...receiptData } });
}

export async function saveFinancialAdjustment(adjustment: Partial<FinancialAdjustment>): Promise<FinancialAdjustment> {
  const data = await adminBusinessRequest<{ adjustment: FinancialAdjustment }>('adminAdjustmentUpsert', { adjustment });
  return data.adjustment;
}

export async function assignClientPackage(input: { clientId: string; category: string; package: PackageOption; discount?: number; promotion?: string }): Promise<{ packageSnapshot: ClientPackageSnapshot; services: ContractedService[]; client: CrmClient }> {
  return await adminBusinessRequest('adminClientPackageAssign', input);
}

export async function saveContractedService(service: Partial<ContractedService>): Promise<ContractedService> {
  const data = await adminBusinessRequest<{ service: ContractedService }>('adminServiceUpsert', { service });
  return data.service;
}

export async function saveClientAddon(addon: Partial<ClientAddon>): Promise<{ addon: ClientAddon; client: CrmClient; packageSnapshot: ClientPackageSnapshot | null }> {
  return await adminBusinessRequest('adminAddonUpsert', { addon });
}

export async function saveTeamFunction(teamFunction: Partial<TeamFunction>): Promise<TeamFunction> {
  const data = await adminBusinessRequest<{ teamFunction: TeamFunction }>('adminTeamFunctionUpsert', { teamFunction });
  return data.teamFunction;
}

export async function saveTeamUser(user: Partial<TeamUser>): Promise<TeamUser> {
  const data = await adminBusinessRequest<{ user: TeamUser }>('adminTeamUserUpsert', { user });
  return data.user;
}

export async function inviteTeamUser(userId: string): Promise<{ user: TeamUser; expiresAt: string }> {
  return await adminBusinessRequest('adminTeamInviteCreate', { userId });
}

export async function saveTeamAssignment(assignment: Partial<TeamAssignment>, allowOverride = false): Promise<{ assignment: TeamAssignment; conflict?: TeamAssignment | null }> {
  const res = await fetch('/api/proxy?action=adminTeamAssignmentUpsert', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', cache: 'no-store',
    body: JSON.stringify({ assignment, allowOverride }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.message || `Solicitud fallida (${res.status})`) as Error & { conflict?: TeamAssignment };
    error.conflict = data?.conflict;
    throw error;
  }
  return data;
}

export async function saveGmailConfig(gmailConfig: Partial<GmailConfig>): Promise<GmailConfig> {
  const data = await adminBusinessRequest<{ gmailConfig: GmailConfig }>('adminGmailConfigUpsert', { gmailConfig });
  return data.gmailConfig;
}

export async function sendGmailTest(recipient: string): Promise<EmailHistory> {
  const data = await adminBusinessRequest<{ emailHistory: EmailHistory }>('adminGmailTest', { recipient });
  return data.emailHistory;
}

export async function saveEmailTemplate(emailTemplate: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const data = await adminBusinessRequest<{ emailTemplate: EmailTemplate }>('adminEmailTemplateUpsert', { emailTemplate });
  return data.emailTemplate;
}

export async function sendClientEmail(clientId: string, templateId: string, variables: Record<string, string> = {}): Promise<EmailHistory> {
  const data = await adminBusinessRequest<{ emailHistory: EmailHistory }>('adminEmailSend', { clientId, templateId, variables });
  return data.emailHistory;
}

type PrivateDriveUploadKind = 'contract' | 'logo' | 'gallery' | 'media';

async function uploadPrivateDriveFile(uploadUrl: string, file: File, kind: PrivateDriveUploadKind): Promise<string> {
  const chunkBytes = 1_048_576;
  let offset = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + chunkBytes, file.size), file.type || 'application/octet-stream');
    const response = await fetch('/api/proxy?action=adminDriveUploadBody', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-XPH-Upload-Url': uploadUrl,
        'X-XPH-Upload-Kind': kind,
        'X-XPH-Upload-Size': String(file.size),
        'X-XPH-Upload-Start': String(offset),
      },
      credentials: 'include',
      cache: 'no-store',
      body: chunk,
    });
    const uploaded = await parseResponse(response);
    const nextStart = Number(uploaded.nextStart);
    if (!Number.isInteger(nextStart) || nextStart <= offset || nextStart > file.size) {
      throw new Error('Google Drive no confirmó correctamente el avance de la carga.');
    }
    offset = nextStart;
    if (uploaded.complete) {
      const fileId = String(uploaded.fileId || '');
      if (!fileId) throw new Error('Google Drive no devolvió el identificador del archivo.');
      return fileId;
    }
  }

  throw new Error('Google Drive no confirmó que la carga terminara.');
}

export async function uploadEmailLogo(file: File): Promise<GmailConfig> {
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) throw new Error('El logo debe estar en formato PNG, JPG o WebP.');
  if (file.size <= 0 || file.size > 5_000_000) throw new Error('El logo debe pesar máximo 5 MB.');
  const initialized = await adminBusinessRequest<{ uploadUrl: string }>('adminEmailLogoUploadInit', { filename: file.name, mimeType: file.type, size: file.size });
  const fileId = await uploadPrivateDriveFile(initialized.uploadUrl, file, 'logo');
  const finalized = await adminBusinessRequest<{ gmailConfig: GmailConfig }>('adminEmailLogoUploadFinalize', { fileId });
  return finalized.gmailConfig;
}

export async function markNotification(notificationId: string, status: 'PENDIENTE' | 'LEIDA' | 'RESUELTA' = 'LEIDA'): Promise<CrmNotification> {
  const data = await adminBusinessRequest<{ notification: CrmNotification }>('adminNotificationRead', { notificationId, status });
  return data.notification;
}

export async function runCrmReminders(): Promise<{ notificationsProcessed: number; emailsProcessed: number; processedAt: string }> {
  return await adminBusinessRequest('adminRemindersRun');
}

export async function installCrmReminders(): Promise<void> {
  await adminBusinessRequest('adminRemindersInstall');
}

export async function createClientGallery(client: CrmClient, title?: string): Promise<{ gallery: ClientGalleryRecord; created: boolean }> {
  return await adminBusinessRequest('adminGalleryCreate', { clientId: client.id, clientName: client.name, title: title || '' });
}

export async function uploadClientGalleryPhoto(galleryId: string, file: File): Promise<{ gallery: ClientGalleryRecord; media: GalleryImage }> {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona una fotografía válida.');
  if (file.size <= 0 || file.size > 100_000_000) throw new Error('La fotografía debe pesar máximo 100 MB.');
  const initialized = await adminBusinessRequest<{ uploadUrl: string }>('adminGalleryUploadInit', { galleryId, filename: file.name, mimeType: file.type, size: file.size });
  const fileId = await uploadPrivateDriveFile(initialized.uploadUrl, file, 'gallery');
  return await adminBusinessRequest('adminGalleryUploadFinalize', { galleryId, fileId, title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') });
}

export async function updateClientGalleryStatus(galleryId: string, status: ClientGalleryRecord['status']): Promise<ClientGalleryRecord> {
  const data = await adminBusinessRequest<{ gallery: ClientGalleryRecord }>('adminGalleryStatusUpdate', { galleryId, status });
  return data.gallery;
}

export async function saveInternalCalendarEvent(internalEvent: Partial<InternalCalendarEvent>): Promise<InternalCalendarEvent> {
  const data = await adminBusinessRequest<{ internalEvent: InternalCalendarEvent }>('adminInternalEventUpsert', { internalEvent });
  return data.internalEvent;
}

export async function uploadBusinessContract(input: {
  clientId: string;
  clientName: string;
  folio: string;
  eventType: string;
  eventDate: string;
  file: File;
}): Promise<BusinessContract> {
  if (input.file.type && input.file.type !== 'application/pdf') {
    throw new Error('Selecciona un contrato en formato PDF.');
  }
  if (input.file.size > 5_000_000) {
    throw new Error('El PDF debe pesar máximo 5 MB para poder guardarlo de forma segura.');
  }
  const initialized = await adminBusinessRequest<{ uploadUrl: string }>('adminContractUploadInit', {
    filename: input.file.name, mimeType: input.file.type || 'application/pdf', size: input.file.size,
  });
  const fileId = await uploadPrivateDriveFile(initialized.uploadUrl, input.file, 'contract');
  const finalized = await adminBusinessRequest<{ contract: BusinessContract }>('adminContractUploadFinalize', { contract: {
    fileId, clientId: input.clientId, clientName: input.clientName, folio: input.folio, eventType: input.eventType, eventDate: input.eventDate,
  } });
  return finalized.contract;
}

export async function createGeneratedBusinessContract(input: {
  clientId: string;
  folio: string;
  documentType: 'CONTRATO' | 'COTIZACION';
  paymentPolicy: '40-30-30' | 'PERSONALIZADA';
  snapshot: ContractDocumentSnapshot;
}): Promise<BusinessContract> {
  const data = await adminBusinessRequest<{ contract: BusinessContract }>('adminContractGenerate', input);
  return data.contract;
}

export async function loadAdminContractDocument(contractId: string): Promise<BusinessContract> {
  const data = await adminBusinessRequest<{ contract: BusinessContract }>('adminContractDocument', { contractId });
  return data.contract;
}

export async function createContractSigningLink(contractId: string): Promise<{ url: string; expiresAt: string }> {
  return await adminBusinessRequest<{ url: string; expiresAt: string }>('adminContractCreateLink', { contractId });
}

export function adminContractPdfUrl(
  contractId: string,
  version: 'original' | 'signed' | 'final' | 'latest' = 'latest',
  revision = '',
): string {
  const params = new URLSearchParams({ action: 'adminContractPdf', contractId, version });
  if (revision) params.set('v', revision);
  return `/api/proxy?${params.toString()}`;
}

export async function saveOwnerSignature(signatureDataUrl: string): Promise<void> {
  await adminBusinessRequest('adminOwnerSignatureSave', { signatureDataUrl });
}

export async function finalizeBusinessContract(contractId: string): Promise<BusinessContract> {
  const data = await adminBusinessRequest<{ contract: BusinessContract }>('adminContractFinalize', { contractId });
  return data.contract;
}

export async function loadPublicContract(token: string, sessionId = ''): Promise<{
  contract: Pick<BusinessContract, 'id' | 'clientName' | 'folio' | 'eventType' | 'eventDate' | 'status' | 'expiresAt' | 'documentType' | 'documentSnapshot' | 'identificationFileName' | 'identificationUploadedAt'>;
}> {
  const params = new URLSearchParams({ action: 'contractView', token });
  if (sessionId) params.set('sessionId', sessionId);
  const res = await fetch(`/api/proxy?${params.toString()}`, { cache: 'no-store' });
  return await parseResponse(res);
}

export function publicContractPdfUrl(token: string): string {
  const params = new URLSearchParams({ action: 'contractPdf', token });
  return `/api/proxy?${params.toString()}`;
}

export async function signPublicContract(token: string, signatureDataUrl: string, accepted: boolean): Promise<void> {
  const res = await fetch('/api/proxy?action=contractSign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ token, signatureDataUrl, accepted }),
  });
  await parseResponse(res);
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function adminUploadMedia(
  _session: AdminSession | null | undefined,
  file: File,
  options: { title: string; category: string; location: string; visibility?: 'public' | 'private' | 'cover' }
): Promise<{ fileId: string; url: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen válido.');
  if (file.size <= 0 || file.size > 100_000_000) throw new Error('La fotografía debe pesar entre 1 byte y 100 MB.');
  const initRes = await fetch('/api/proxy?action=adminUploadInit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    }),
  });
  const initialized = await parseResponse(initRes);
  const fileId = await uploadPrivateDriveFile(String(initialized.uploadUrl || ''), file, 'media');
  const finalizeRes = await fetch('/api/proxy?action=adminUploadFinalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ fileId, title: options.title, category: options.category, location: options.location, visibility: options.visibility || 'public' }),
  });
  const saved = await parseResponse(finalizeRes);
  return { fileId: saved.fileId, url: saved.url };
}

export async function submitPublicLead(lead: Record<string, any>): Promise<void> {
  const res = await fetch('/api/proxy?action=submitLead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead }),
  });
  await parseResponse(res);
}

export async function fetchClientGallery(slug: string, token: string): Promise<{
  title: string;
  clientName: string;
  media: GalleryImage[];
}> {
  const params = new URLSearchParams({ action: 'clientGallery', slug, token, _t: Date.now().toString() });
  const res = await fetch(`/api/proxy?${params.toString()}`, { cache: 'no-store' });
  const data = await parseResponse(res);
  return {
    title: data.title || 'Galería privada',
    clientName: data.clientName || 'Cliente XPH',
    media: Array.isArray(data.media) ? data.media : [],
  };
}

export function extractDriveFileId(value: string): string {
  const trimmed = String(value || '').trim();
  const byPath = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (byPath?.[1]) return byPath[1];
  const byId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byId?.[1]) return byId[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return '';
}

export function extractDriveFolderId(value: string): string {
  const trimmed = String(value || '').trim();
  const byPath = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (byPath?.[1]) return byPath[1];
  const byId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byId?.[1]) return byId[1];
  return '';
}

export async function importPrivateDriveFolder(folderId: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const res = await fetch('/api/proxy?action=adminDriveFolderImport', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ folderId }),
  });
  const data = await parseResponse(res);
  return Array.isArray(data.files) ? data.files : [];
}

export async function deleteManagedDriveMedia(fileIds: string[]): Promise<{ deleted: string[]; retained: string[] }> {
  const uniqueIds = Array.from(new Set(fileIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (!uniqueIds.length) return { deleted: [], retained: [] };
  const res = await fetch('/api/proxy?action=adminManagedMediaDelete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ fileIds: uniqueIds }),
  });
  const data = await parseResponse(res);
  return {
    deleted: Array.isArray(data.deleted) ? data.deleted : [],
    retained: Array.isArray(data.retained) ? data.retained : [],
  };
}

export function driveDownloadUrl(fileId: string) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

export function drivePreviewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
