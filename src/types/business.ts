export type CrmRecordType = 'Prospecto' | 'Cliente';

export type CrmStatus =
  | 'Nuevo'
  | 'Contactado'
  | 'Cotización enviada'
  | 'Seguimiento'
  | 'Cierre prioritario'
  | 'Contratado'
  | 'No interesado'
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

export type PaymentStatus = 'Pendiente' | 'Liquidado' | 'Anulado';

export interface BusinessPayment {
  id: string;
  clientId: string;
  contractId: string;
  transactionId: string;
  date: string;
  dueDate: string;
  installmentNumber: 1 | 2 | 3;
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
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSnapshot {
  clients: CrmClient[];
  expenses: BusinessExpense[];
  payments: BusinessPayment[];
  contracts: BusinessContract[];
  ownerSignatureConfigured: boolean;
}
