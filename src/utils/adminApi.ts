import { GalleryImage } from '../types';
import { BusinessContract, BusinessExpense, BusinessPayment, BusinessSnapshot, CrmClient } from '../types/business';
import { CURRENT_CATALOG_VERSION, resolvePublishedAddons, resolvePublishedPackages } from './catalogMerge';

export type AdminSession = {
  authenticated: true;
  email?: string;
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
  activeAdminSession = { authenticated: true, email: data.email || '' };
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
  activeAdminSession = { authenticated: true, email: data.email || email };
  return activeAdminSession;
}

export async function adminLogout(): Promise<void> {
  await fetch('/api/proxy?action=adminLogout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => null);
  activeAdminSession = null;
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

export async function loadBusinessSnapshot(): Promise<BusinessSnapshot> {
  const data = await adminBusinessRequest<{ snapshot: BusinessSnapshot }>('adminBusinessSnapshot');
  return {
    clients: Array.isArray(data.snapshot?.clients) ? data.snapshot.clients : [],
    expenses: Array.isArray(data.snapshot?.expenses) ? data.snapshot.expenses : [],
    payments: Array.isArray(data.snapshot?.payments) ? data.snapshot.payments : [],
    contracts: Array.isArray(data.snapshot?.contracts) ? data.snapshot.contracts : [],
    ownerSignatureConfigured: Boolean(data.snapshot?.ownerSignatureConfigured),
  };
}

export async function saveCrmClient(client: Partial<CrmClient>): Promise<CrmClient> {
  const data = await adminBusinessRequest<{ client: CrmClient }>('adminCrmUpsert', { client });
  return data.client;
}

export async function syncClientCalendar(client: CrmClient): Promise<CrmClient> {
  const data = await adminBusinessRequest<{ client: CrmClient }>('adminCalendarSync', { clientId: client.id, eventDate: client.eventDate, eventTime: client.eventTime });
  return data.client;
}

export async function saveBusinessExpense(expense: Partial<BusinessExpense>): Promise<BusinessExpense> {
  const data = await adminBusinessRequest<{ expense: BusinessExpense }>('adminExpenseUpsert', { expense });
  return data.expense;
}

export async function saveBusinessPayment(payment: Partial<BusinessPayment>, receipt?: File | null): Promise<BusinessPayment> {
  let receiptData: Record<string, unknown> = {};
  if (receipt) {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(receipt.type)) throw new Error('El comprobante debe ser JPG, PNG o PDF.');
    if (receipt.size > 2_600_000) throw new Error('El comprobante debe pesar máximo 2.6 MB.');
    receiptData = { receiptBase64: await fileToDataUrl(receipt), receiptFileName: receipt.name, receiptMimeType: receipt.type };
  }
  const data = await adminBusinessRequest<{ payment: BusinessPayment }>('adminPaymentUpsert', { payment: { ...payment, ...receiptData } });
  return data.payment;
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
  if (input.file.size > 2_600_000) {
    throw new Error('El PDF debe pesar máximo 2.6 MB para poder guardarlo de forma segura.');
  }
  const base64 = await fileToDataUrl(input.file);
  const data = await adminBusinessRequest<{ contract: BusinessContract }>('adminContractUpload', {
    contract: {
      clientId: input.clientId,
      clientName: input.clientName,
      folio: input.folio,
      eventType: input.eventType,
      eventDate: input.eventDate,
      filename: input.file.name,
      mimeType: input.file.type || 'application/pdf',
      base64,
    },
  });
  return data.contract;
}

export async function createContractSigningLink(contractId: string): Promise<{ url: string; expiresAt: string }> {
  return await adminBusinessRequest<{ url: string; expiresAt: string }>('adminContractCreateLink', { contractId });
}

export function adminContractPdfUrl(contractId: string, version: 'original' | 'signed' | 'final' | 'latest' = 'latest'): string {
  const params = new URLSearchParams({ action: 'adminContractPdf', contractId, version });
  return `/api/proxy?${params.toString()}`;
}

export async function saveOwnerSignature(signatureDataUrl: string): Promise<void> {
  await adminBusinessRequest('adminOwnerSignatureSave', { signatureDataUrl });
}

export async function finalizeBusinessContract(contractId: string): Promise<BusinessContract> {
  const data = await adminBusinessRequest<{ contract: BusinessContract }>('adminContractFinalize', { contractId });
  return data.contract;
}

export async function loadPublicContract(token: string): Promise<{
  contract: Pick<BusinessContract, 'id' | 'clientName' | 'folio' | 'eventType' | 'eventDate' | 'status' | 'expiresAt'>;
}> {
  const params = new URLSearchParams({ action: 'contractView', token });
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
  options: { title: string; category: string; location: string }
): Promise<{ fileId: string; url: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen válido.');
  if (file.size > 2_600_000) {
    throw new Error('Esta imagen supera 2.6 MB. Para conservarla sin reducir calidad, súbela a la carpeta de Drive y selecciónala desde el panel.');
  }
  const dataUrl = await fileToDataUrl(file);
  const res = await fetch('/api/proxy?action=adminUpload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      filename: file.name,
      title: options.title,
      category: options.category,
      location: options.location,
      mimeType: file.type || 'application/octet-stream',
      base64: dataUrl,
    }),
  });
  const saved = await parseResponse(res);
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

export function driveDownloadUrl(fileId: string) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

export function drivePreviewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
