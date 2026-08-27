import assert from 'node:assert/strict';
import {
  calculateFinancialSummary,
  derivedPaymentStatus,
  pendingPaymentAmount,
} from '../src/utils/financialRules.js';

const client = { id: 'cliente-1', recordType: 'Cliente', status: 'Contratado', totalAmount: 10000, paidAmount: 0 };
const basePayment = (id, plannedAmount, receivedAmount, status, transactionId) => ({
  id,
  clientId: client.id,
  plannedAmount,
  receivedAmount,
  status,
  transactionId,
});
const transaction = (id, paymentId, amount, status = 'ACTIVO') => ({ id, paymentId, clientId: client.id, amount, status });

const pendingScenario = calculateFinancialSummary({
  clients: [client],
  payments: [
    basePayment('p1', 3000, 3000, 'Liquidado', 't1'),
    basePayment('p2', 3000, 0, 'Pendiente', 't2'),
    basePayment('p3', 4000, 0, 'Pendiente', 't3'),
  ],
  transactions: [transaction('t1', 'p1', 3000), transaction('t2', 'p2', 0, 'ANULADO'), transaction('t3', 'p3', 0, 'ANULADO')],
  expenses: [],
  adjustments: [],
});
assert.equal(pendingScenario.contracted, 10000);
assert.equal(pendingScenario.collected, 3000);
assert.equal(pendingScenario.receivable, 7000);
assert.equal(pendingScenario.balanceCalculated, 3000);

const liquidatedScenario = calculateFinancialSummary({
  clients: [client],
  payments: [basePayment('p1', 3000, 3000, 'Liquidado', 't1'), basePayment('p2', 3000, 3000, 'Liquidado', 't2')],
  transactions: [transaction('t1', 'p1', 3000), transaction('t2', 'p2', 3000), transaction('t2', 'p2', 3000)],
  expenses: [],
  adjustments: [],
});
assert.equal(liquidatedScenario.collected, 6000, 'un transactionId repetido no debe duplicar el ingreso');
assert.equal(liquidatedScenario.receivable, 4000);

const revertedScenario = calculateFinancialSummary({
  clients: [client],
  payments: [basePayment('p1', 3000, 3000, 'Liquidado', 't1'), basePayment('p2', 3000, 0, 'Pendiente', 't2')],
  transactions: [transaction('t1', 'p1', 3000), transaction('t2', 'p2', 0, 'ANULADO')],
  expenses: [],
  adjustments: [],
});
assert.equal(revertedScenario.collected, 3000);
assert.equal(revertedScenario.receivable, 7000);

const partialScenario = calculateFinancialSummary({
  clients: [{ ...client, totalAmount: 3000 }],
  payments: [basePayment('p1', 3000, 1500, 'Parcial', 't1')],
  transactions: [transaction('t1', 'p1', 1500)],
  expenses: [],
  adjustments: [],
});
assert.equal(partialScenario.collected, 1500);
assert.equal(partialScenario.receivable, 1500);
assert.equal(partialScenario.balanceCalculated, 1500);
assert.equal(pendingPaymentAmount(basePayment('p1', 3000, 1500, 'Parcial', 't1')), 1500);
assert.equal(derivedPaymentStatus(3000, 1500, 'Liquidado'), 'Parcial');
assert.equal(derivedPaymentStatus(3000, 3000, 'Pendiente'), 'Liquidado');
assert.equal(derivedPaymentStatus(3000, 3000, 'Anulado'), 'Anulado');

const reconciledScenario = calculateFinancialSummary({
  clients: [{ ...client, totalAmount: 13000 }],
  payments: [basePayment('p1', 13000, 13000, 'Liquidado', 't1')],
  transactions: [transaction('t1', 'p1', 13000)],
  expenses: [],
  adjustments: [{ id: 'a1', amount: -650, status: 'ACTIVO' }],
});
assert.equal(reconciledScenario.balanceCalculated, 12350);

console.log('Reglas financieras verificadas: pendiente, liquidación, reversión, parcial, idempotencia y conciliación.');
