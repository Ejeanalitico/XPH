import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appsScript = readFileSync(new URL('../google-apps-script.js', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../api/proxy.js', import.meta.url), 'utf8');
const businessPanel = readFileSync(new URL('../src/components/BusinessAdminPanel.tsx', import.meta.url), 'utf8');
const clientOperationsPanel = readFileSync(new URL('../src/components/ClientOperationsPanel.tsx', import.meta.url), 'utf8');
const adminApi = readFileSync(new URL('../src/utils/adminApi.ts', import.meta.url), 'utf8');
const contractDocument = readFileSync(new URL('../src/components/ContractDocument.tsx', import.meta.url), 'utf8');

// Conversión compatible: conserva el mismo ID y enlaza el historial existente.
const prospect = { id: 'prospecto-1', recordType: 'Prospecto', nextActionAt: '2026-09-01T11:00' };
const followUps = [{ id: 'seguimiento-1', prospectId: prospect.id, clientId: '' }];
const converted = { ...prospect, recordType: 'Cliente', status: 'Contratado' };
followUps.forEach((item) => { if (item.prospectId === converted.id) item.clientId = converted.id; });
assert.equal(converted.id, prospect.id);
assert.equal(followUps[0].clientId, prospect.id);

// El paquete del cliente es una copia: personalizarlo no modifica la plantilla comercial.
const template = { id: 'boda-ensueno', features: ['Fotografía', 'Video', 'Maquillaje'] };
const snapshot = JSON.parse(JSON.stringify(template));
snapshot.features = snapshot.features.filter((item) => item !== 'Maquillaje');
snapshot.features.push('10 horas');
assert.deepEqual(template.features, ['Fotografía', 'Video', 'Maquillaje']);
assert.deepEqual(snapshot.features, ['Fotografía', 'Video', '10 horas']);

// El calendario usa solamente próximo contacto para prospectos; clientes y sesiones son independientes.
const records = [
  { id: 'p1', recordType: 'Prospecto', nextActionAt: '2026-09-02T10:00', eventDate: '2026-11-01' },
  { id: 'c1', recordType: 'Cliente', nextActionAt: '2026-09-03T10:00', eventDate: '2026-11-02', preSessionApplies: true, preSessionDate: '2026-09-20' },
];
const prospectCalendar = records.filter((item) => item.recordType === 'Prospecto' && item.nextActionAt).map((item) => item.nextActionAt);
const clientCalendar = records.filter((item) => item.recordType === 'Cliente').flatMap((item) => [item.eventDate, item.preSessionApplies ? item.preSessionDate : ''].filter(Boolean));
assert.deepEqual(prospectCalendar, ['2026-09-02T10:00']);
assert.deepEqual(clientCalendar, ['2026-11-02', '2026-09-20']);

// Contratos, sincronización, recordatorios y seguridad permanecen ligados a identificadores estables.
assert.match(appsScript, /size > 5000000[\s\S]{0,120}máximo 5 MB/);
assert.match(appsScript, /payment\.transactionId[\s\S]{0,120}existingPayment\.transactionId/);
assert.match(appsScript, /\['Prospecto', 'Cliente'\][\s\S]{0,120}prospecto o cliente válido para asignar el paquete/);
assert.match(appsScript, /syncClientAssignments\(ss, calendarClient, eventReady, sessionReady\)/);
assert.match(appsScript, /reminder7DaysSent/);
assert.match(appsScript, /reminder1DaySent/);
assert.match(proxy, /adminTeamUserUpsert: 'USERS_ADMIN'/);
assert.match(proxy, /result\.snapshot\.auditLog = \[\]/);
assert.match(proxy, /operationalClientRecord/);
assert.match(proxy, /Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0'/);
assert.match(proxy, /Vercel-CDN-Cache-Control', 'no-store'/);
assert.match(adminApi, /if \(revision\) params\.set\('v', revision\)/);
assert.match(businessPanel, /adminContractPdfUrl\(contract\.id, 'latest', contractPdfRevision\(contract\)\)/);
assert.match(businessPanel, /Ver contrato final con firmas/);
assert.match(businessPanel, /border-yellow-300 bg-yellow-300\/15/);
assert.match(businessPanel, /border-emerald-400 bg-emerald-500\/15/);
assert.match(businessPanel, /border-red-400 bg-red-500\/15/);
assert.match(businessPanel, /Solo la fecha del próximo contacto/);
assert.match(businessPanel, /const dateTimeLocalValue/);
assert.match(businessPanel, /dateTimeLocalValue\(inlineDraft\.nextActionAt\)/);

// El nuevo documento conserva una instantánea, usa 40-30-30 por defecto y limita sesiones sin contar recargas.
assert.match(businessPanel, /percentage: 40, amount: total \* \.4/);
assert.match(businessPanel, /percentage: 30, amount: total \* \.3/);
assert.match(proxy, /normalizeContractDocumentSnapshot/);
assert.match(appsScript, /documentJson/);
assert.match(appsScript, /'contractUpload', 'contractGenerate', 'contractDocument', 'contractCreateLink'/);
assert.match(appsScript, /clientSessionIdsJson/);
assert.match(appsScript, /sessionIds\.indexOf\(safeSessionId\) < 0/);
assert.match(appsScript, /sessionIds\.length >= maxOpens/);
assert.match(contractDocument, /CONTRATO DE SERVICIOS/);
assert.match(contractDocument, /Política 40% \/ 30% \/ 30%/);
assert.match(businessPanel, /Datos necesarios para generar/);
assert.match(businessPanel, /missingContractData\.length/);
assert.match(businessPanel, /Completar ficha/);
assert.match(businessPanel, /preContractMode=\{selectedClient\.recordType === 'Prospecto'\}/);
assert.match(businessPanel, /Los adicionales son opcionales/);
assert.match(businessPanel, /Puedes generar el documento sin adicionales/);
assert.match(clientOperationsPanel, /Preparación comercial del prospecto/);
assert.match(clientOperationsPanel, /deja esa sección vacía y continúa/);
assert.match(clientOperationsPanel, /Actualizar adicional/);
assert.match(proxy, /Completa antes de generar/);

console.log('Invariantes CRM verificadas: conversión, paquete aislado, calendario, contratos, recordatorios y permisos.');
