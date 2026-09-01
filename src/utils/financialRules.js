const amount = (value) => Math.max(0, Number(value) || 0);

export const isCollectedPayment = (payment) =>
  (payment?.status === 'Liquidado' || payment?.status === 'Parcial') && amount(payment?.receivedAmount) > 0;

export const collectedPaymentAmount = (payment) =>
  isCollectedPayment(payment) ? amount(payment.receivedAmount) : 0;

export const pendingPaymentAmount = (payment) => {
  if (!payment || payment.status === 'Anulado') return 0;
  return Math.max(0, amount(payment.plannedAmount) - collectedPaymentAmount(payment));
};

export const derivedPaymentStatus = (plannedAmount, receivedAmount, requestedStatus) => {
  if (requestedStatus === 'Anulado') return 'Anulado';
  const planned = amount(plannedAmount);
  const received = amount(receivedAmount);
  if (received <= 0) return 'Pendiente';
  if (received + 0.005 < planned) return 'Parcial';
  return 'Liquidado';
};

export const isOverduePayment = (payment, todayKey = new Date().toISOString().slice(0, 10)) =>
  Boolean(payment?.dueDate && String(payment.dueDate).slice(0, 10) < todayKey && pendingPaymentAmount(payment) > 0);

const uniqueActiveTransactions = (transactions = []) => {
  const byId = new Map();
  transactions.forEach((transaction) => {
    if (!transaction?.id || transaction.status !== 'ACTIVO') return;
    byId.set(String(transaction.id), transaction);
  });
  return [...byId.values()];
};

export const collectedForClient = (client, payments = [], transactions = []) => {
  const clientTransactions = uniqueActiveTransactions(transactions)
    .filter((transaction) => String(transaction.clientId) === String(client.id));
  if (clientTransactions.length) {
    return clientTransactions.reduce((sum, transaction) => sum + amount(transaction.amount), 0);
  }
  const clientPayments = payments.filter((payment) => String(payment.clientId) === String(client.id));
  if (clientPayments.length) {
    return clientPayments.reduce((sum, payment) => sum + collectedPaymentAmount(payment), 0);
  }
  return amount(client.paidAmount);
};

export const calculateFinancialSummary = ({ clients = [], payments = [], transactions = [], expenses = [], adjustments = [] }) => {
  // Historical imports can retain a prospect marked "Contratado" after its
  // canonical client record exists. Counting by status duplicates that sale.
  const contractedClients = clients.filter((client) => client.recordType === 'Cliente' && client.status !== 'Archivado');
  const contracted = contractedClients.reduce((sum, client) => sum + amount(client.totalAmount), 0);
  const collected = contractedClients.reduce((sum, client) => {
    const clientCollected = collectedForClient(client, payments, transactions);
    return sum + Math.min(clientCollected, amount(client.totalAmount) || clientCollected);
  }, 0);
  const paidExpenses = expenses
    .filter((expense) => expense.paymentStatus === 'Pagado')
    .reduce((sum, expense) => sum + amount(expense.amount), 0);
  const pendingExpenses = expenses
    .filter((expense) => expense.paymentStatus === 'Pendiente')
    .reduce((sum, expense) => sum + amount(expense.amount), 0);
  const activeAdjustments = adjustments
    .filter((adjustment) => adjustment.status === 'ACTIVO')
    .reduce((sum, adjustment) => sum + (Number(adjustment.amount) || 0), 0);
  const advertising = expenses
    .filter((expense) => expense.category === 'Publicidad')
    .reduce((sum, expense) => sum + amount(expense.amount), 0);
  const clientsFromAds = contractedClients.filter((client) => /facebook|instagram|meta|google|tiktok|publicidad|anuncio/i.test(`${client.source || ''} ${client.campaign || ''}`)).length;
  const productionCosts = contractedClients.reduce((sum, client) => sum + amount(client.estimatedCost) + amount(client.allocatedAdCost), 0);
  const overduePayments = payments.filter((payment) => isOverduePayment(payment));

  return {
    contracted,
    collected,
    receivable: Math.max(0, contracted - collected),
    paidExpenses,
    pendingExpenses,
    activeAdjustments,
    advertising,
    clientsFromAds,
    cac: clientsFromAds > 0 ? advertising / clientsFromAds : 0,
    balanceCalculated: collected - paidExpenses + activeAdjustments,
    projectedResult: contracted - paidExpenses - pendingExpenses - productionCosts + activeAdjustments,
    overduePayments,
    overdueAmount: overduePayments.reduce((sum, payment) => sum + pendingPaymentAmount(payment), 0),
  };
};
