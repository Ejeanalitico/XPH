export type CrmRecordType = 'Prospecto' | 'Cliente';

export type CrmStatus =
  | 'Nuevo'
  | 'Contactado'
  | 'Cotización enviada'
  | 'Esperando respuesta'
  | 'Seguimiento pendiente'
  | 'Interesado'
  | 'Negociación'
  | 'Por cerrar'
  | 'Seguimiento'
  | 'Cierre prioritario'
  | 'Contratado'
  | 'No interesado'
  | 'Sin interés'
  | 'No responde'
  | 'Archivado';

export interface CrmClient {
  id: string;
  recordType: CrmRecordType;
  name: string;
  phone: string;
  email: string;
  eventType: string;
  eventDate: string;
  eventLocation: string;
  packageName: string;
  totalAmount: number;
  paidAmount: number;
  status: CrmStatus;
  source: string;
  firstContactAt: string;
  lastContactAt: string;
  nextAction: string;
  nextActionAt: string;
  notes: string;
  internalNotes: string;
  providerNotes: string;
  contractId: string;
  createdAt: string;
  updatedAt: string;
  honoreeName: string;
  address: string;
  eventTime: string;
  serviceHours: number;
  campaign: string;
  objection: string;
  followUpAttempts: number;
  suggestedMessage: string;
  lossReason: string;
  estimatedCost: number;
  allocatedAdCost: number;
  preSessionApplies: boolean;
  preSessionDate: string;
  preSessionTime: string;
  preSessionLocation: string;
  inviteClientToCalendar: boolean;
  calendarEventId: string;
  preSessionCalendarEventId: string;
  eventId: string;
  preSessionType: string;
  preSessionEndTime: string;
  preSessionAddress: string;
  preSessionStatus: 'Pendiente por agendar' | 'Agendada' | 'Confirmada' | 'Realizada' | 'Reprogramada' | 'Cancelada' | string;
  preSessionNotes: string;
  calendarSyncStatus: 'Sincronizado' | 'Pendiente' | 'Error' | 'Desconectado' | string;
  calendarSyncedAt: string;
  calendarSyncError: string;
  reminder7DaysSent: boolean;
  reminder1DaySent: boolean;
}

export interface CrmFollowUp {
  id: string;
  prospectId: string;
  clientId: string;
  occurredAt: string;
  conversation: string;
  result: string;
  nextAction: string;
  nextActionAt: string;
  createdBy: string;
  createdAt: string;
}

export interface WhatsAppHistoryItem {
  id: string;
  clientId: string;
  direction: 'ENTRANTE' | 'SALIENTE' | string;
  phone: string;
  contactName: string;
  type: string;
  message: string;
  status: string;
  occurredAt: string;
  phoneNumberId: string;
  businessAccountId: string;
  userId: string;
}

export type ExpenseCategory =
  | 'Equipo y fotografía'
  | 'Maquillaje e insumos'
  | 'Transporte'
  | 'Comida'
  | 'Gastos personales'
  | 'Publicidad'
  | 'Otros del negocio';

export interface BusinessExpense {
  id: string;
  date: string;
  category: ExpenseCategory;
  subcategory: string;
  concept: string;
  supplier: string;
  paymentMethod: string;
  paymentStatus: 'Pagado' | 'Pendiente';
  amount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  relatedClientId: string;
  receiptReference: string;
  account: 'Banco' | 'Efectivo' | 'Bote de reserva' | 'Otro';
}

export type PaymentStatus = 'Pendiente' | 'Parcial' | 'Liquidado' | 'Anulado';

export interface BusinessPayment {
  id: string;
  clientId: string;
  contractId: string;
  transactionId: string;
  date: string;
  dueDate: string;
  installmentNumber: number;
  percentage: number;
  concept: string;
  plannedAmount: number;
  receivedAmount: number;
  status: PaymentStatus;
  method: string;
  reference: string;
  notes: string;
  receiptFileId: string;
  receiptFileName: string;
  receiptUrl: string;
  paidAt: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialTransaction {
  id: string;
  paymentId: string;
  clientId: string;
  type: 'Ingreso de cliente' | string;
  amount: number;
  status: 'ACTIVO' | 'ANULADO';
  date: string;
  concept: string;
  method: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
}

export type FinancialAdjustmentCategory =
  | 'Gasto no registrado'
  | 'Pendiente por identificar'
  | 'Ajuste financiero'
  | 'Otro';

export interface FinancialAdjustment {
  id: string;
  date: string;
  category: FinancialAdjustmentCategory;
  concept: string;
  amount: number;
  notes: string;
  status: 'ACTIVO' | 'ANULADO';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPackageSnapshot {
  id: string;
  clientId: string;
  eventId: string;
  packageId: string;
  category: string;
  packageName: string;
  basePrice: number;
  discount: number;
  promotion: string;
  finalTotal: number;
  originalJson: string;
  status: 'ACTIVO' | 'REEMPLAZADO' | 'ANULADO';
  createdAt: string;
  updatedAt: string;
}

export interface ContractedService {
  id: string;
  clientId: string;
  eventId: string;
  packageSnapshotId: string;
  source: 'PAQUETE' | 'MANUAL';
  concept: string;
  included: boolean;
  quantity: number;
  unitPrice: number;
  total: number;
  date: string;
  notes: string;
  status: 'Pendiente' | 'Programado' | 'Realizado' | 'Entregado' | 'No incluido' | 'Anulado' | string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAddon {
  id: string;
  clientId: string;
  eventId: string;
  concept: string;
  quantity: number;
  unitPrice: number;
  total: number;
  date: string;
  notes: string;
  status: 'Pendiente' | 'Confirmado' | 'Entregado' | 'Anulado' | string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamFunction {
  id: string;
  name: string;
  status: 'ACTIVA' | 'INACTIVA';
  createdAt: string;
  updatedAt: string;
}

export interface TeamUser {
  id: string;
  name: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  functionId: string;
  functionName: string;
  role: 'COLLABORATOR';
  status: 'INVITADO' | 'ACTIVO' | 'INACTIVO';
  permissions: string[];
  notes: string;
  googleConnected: boolean;
  googleEmail: string;
  calendarConnected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamAssignment {
  id: string;
  clientId: string;
  eventId: string;
  userId: string;
  functionName: string;
  activityType: string;
  scheduleSource: 'EVENT' | 'SESSION' | 'MANUAL';
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  notes: string;
  status: 'ACTIVA' | 'CANCELADA';
  calendarEventId: string;
  syncStatus: 'Sincronizado' | 'Pendiente' | 'Error' | 'Desconectado' | string;
  createdAt: string;
  updatedAt: string;
}

export interface GmailConfig {
  id: string;
  enabled: boolean;
  connectedEmail: string;
  senderName: string;
  replyTo: string;
  signatureHtml: string;
  logoFileId: string;
  logoUrl: string;
  autoPaymentReceived: boolean;
  autoPaymentDue: boolean;
  autoEventReminders: boolean;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  status: 'ACTIVA' | 'INACTIVA';
  updatedAt: string;
}

export interface EmailHistory {
  id: string;
  clientId: string;
  prospectId: string;
  sentAt: string;
  recipient: string;
  subject: string;
  templateId: string;
  status: 'ENVIADO' | 'ERROR';
  userId: string;
  mode: 'MANUAL' | 'AUTOMATICO';
  gmailMessageId: string;
  error: string;
}

export interface CrmNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId: string;
  userId: string;
  status: 'PENDIENTE' | 'LEIDA' | 'RESUELTA' | 'ANULADA';
  dueAt: string;
  dedupeKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmAuditEntry {
  Fecha_Hora: string;
  Accion: string;
  Detalles_Cambio: string;
  ID_Elemento: string;
  Usuario: string;
  Estado: string;
}

export interface ClientGalleryRecord {
  id: string;
  clientId: string;
  eventId: string;
  title: string;
  slug: string;
  accessToken: string;
  rootFolderId: string;
  photosFolderId: string;
  folderUrl: string;
  galleryUrl: string;
  status: 'BORRADOR' | 'ACTIVA' | 'LISTA' | 'ARCHIVADA';
  createdAt: string;
  updatedAt: string;
}

export interface InternalCalendarEvent {
  id: string;
  title: string;
  activityType: 'Junta' | 'Capacitación' | 'Mantenimiento' | 'Compra de equipo' | 'Bloqueo personal' | 'Día no disponible' | 'Otro' | string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  notes: string;
  visibility: 'SUPER_ADMIN' | 'SELECTED';
  userIds: string[];
  status: 'ACTIVO' | 'CANCELADO';
  calendarEventId: string;
  syncStatus: 'Sincronizado' | 'Pendiente' | 'Error' | string;
  createdAt: string;
  updatedAt: string;
}

export type ContractStatus =
  | 'Borrador'
  | 'Preparado'
  | 'Enviado'
  | 'Visto'
  | 'Firmado por cliente'
  | 'Finalizado'
  | 'Cancelado';

export interface ContractDocumentSnapshot {
  documentType: 'CONTRATO' | 'COTIZACION';
  templateVersion: string;
  issuedAt: string;
  client: {
    name: string;
    phone: string;
    email: string;
    address: string;
    honoreeName: string;
  };
  event: {
    type: string;
    date: string;
    time: string;
    location: string;
    serviceHours: number;
  };
  commercial: {
    packageName: string;
    packageBase: number;
    additions: number;
    discount: number;
    total: number;
    promotion: string;
  };
  services: Array<{ concept: string; quantity: number; notes: string }>;
  addons: Array<{ concept: string; quantity: number; unitPrice: number; total: number; notes: string }>;
  payments: Array<{ concept: string; percentage: number; amount: number; dueDate: string; status: string }>;
  paymentPolicy: '40-30-30' | 'PERSONALIZADA';
  terms: string[];
};

export interface BusinessContract {
  id: string;
  clientId: string;
  clientName: string;
  folio: string;
  eventType: string;
  eventDate: string;
  status: ContractStatus;
  originalFileName: string;
  expiresAt: string;
  sentAt: string;
  viewedAt: string;
  acceptedAt: string;
  clientSignedAt: string;
  ownerAuthorizedAt: string;
  documentHash: string;
  finalDocumentHash: string;
  documentType?: 'CONTRATO' | 'COTIZACION';
  templateVersion?: string;
  documentSnapshot?: ContractDocumentSnapshot | null;
  paymentPolicy?: '40-30-30' | 'PERSONALIZADA';
  adminReviewUsed?: boolean;
  clientOpenCount?: number;
  maxClientOpens?: number;
  identificationFileName?: string;
  identificationUploadedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSnapshot {
  clients: CrmClient[];
  followUps: CrmFollowUp[];
  expenses: BusinessExpense[];
  payments: BusinessPayment[];
  transactions: FinancialTransaction[];
  adjustments: FinancialAdjustment[];
  packageSnapshots: ClientPackageSnapshot[];
  services: ContractedService[];
  addons: ClientAddon[];
  users: TeamUser[];
  teamFunctions: TeamFunction[];
  assignments: TeamAssignment[];
  gmailConfig: GmailConfig | null;
  emailTemplates: EmailTemplate[];
  emailHistory: EmailHistory[];
  whatsappHistory: WhatsAppHistoryItem[];
  notifications: CrmNotification[];
  auditLog: CrmAuditEntry[];
  galleries: ClientGalleryRecord[];
  internalEvents: InternalCalendarEvent[];
  contracts: BusinessContract[];
  ownerSignatureConfigured: boolean;
}
