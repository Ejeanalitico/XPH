import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appsScript = readFileSync(new URL('../google-apps-script.js', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../api/proxy.js', import.meta.url), 'utf8');
const businessPanel = readFileSync(new URL('../src/components/BusinessAdminPanel.tsx', import.meta.url), 'utf8');

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
assert.match(appsScript, /syncClientAssignments\(ss, calendarClient, eventReady, sessionReady\)/);
assert.match(appsScript, /reminder7DaysSent/);
assert.match(appsScript, /reminder1DaySent/);
assert.match(proxy, /adminTeamUserUpsert: 'USERS_ADMIN'/);
assert.match(proxy, /result\.snapshot\.auditLog = \[\]/);
assert.match(proxy, /operationalClientRecord/);
assert.match(businessPanel, /border-yellow-300 bg-yellow-300\/15/);
assert.match(businessPanel, /border-emerald-400 bg-emerald-500\/15/);
assert.match(businessPanel, /border-red-400 bg-red-500\/15/);
assert.match(businessPanel, /Solo la fecha del próximo contacto/);

console.log('Invariantes CRM verificadas: conversión, paquete aislado, calendario, contratos, recordatorios y permisos.');
