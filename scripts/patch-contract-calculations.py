from pathlib import Path

front_path = Path('src/components/BusinessAdminPanel.tsx')
front = front_path.read_text(encoding='utf-8')

old_money = "const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);"
new_money = """const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);
const roundContractMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const contractAddonAmount = (item: { quantity?: number; unitPrice?: number; total?: number }) => {
  const quantity = Math.max(0, Number(item.quantity || 0));
  const unitPrice = Math.max(0, Number(item.unitPrice || 0));
  const storedTotal = Math.max(0, Number(item.total || 0));
  return roundContractMoney(quantity > 0 && unitPrice > 0 ? quantity * unitPrice : storedTotal);
};
const standardContractPayments = (total: number, eventDate = '') => {
  const normalizedTotal = roundContractMoney(Math.max(0, Number(total) || 0));
  const first = roundContractMoney(normalizedTotal * 0.4);
  const second = roundContractMoney(normalizedTotal * 0.3);
  const third = roundContractMoney(normalizedTotal - first - second);
  return [
    { concept: '1er pago (Apartado)', percentage: 40, amount: first, dueDate: '', status: 'Pendiente' },
    { concept: '2do pago (Intermedio)', percentage: 30, amount: second, dueDate: eventDate, status: 'Pendiente' },
    { concept: '3er pago (Finiquito)', percentage: 30, amount: third, dueDate: '', status: 'Pendiente' },
  ];
};"""
if old_money not in front:
    if 'const roundContractMoney' not in front:
        raise SystemExit('No se encontró el punto para insertar aritmética de contratos.')
else:
    front = front.replace(old_money, new_money, 1)

old_block = """    const packageBase = Number(packageSnapshot?.basePrice || Math.max(0, Number(client.totalAmount || 0) - addons.reduce((sum, item) => sum + Number(item.total || 0), 0)));
    const additions = addons.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const discount = Number(packageSnapshot?.discount || 0);
    const total = Number(client.totalAmount || packageBase + additions - discount);
    const defaultPlan = [
      { concept: '1er pago (Apartado)', percentage: 40, amount: total * .4, dueDate: '', status: 'Pendiente' },
      { concept: '2do pago (Intermedio)', percentage: 30, amount: total * .3, dueDate: contractDraft.eventDate || client.eventDate || '', status: 'Pendiente' },
      { concept: '3er pago (Finiquito)', percentage: 30, amount: total * .3, dueDate: '', status: 'Pendiente' },
    ];
    const payments = registeredPayments.length ? registeredPayments.map((item) => ({ concept: item.concept || `Pago ${item.installmentNumber || ''}`.trim(), percentage: Number(item.percentage || 0), amount: Number(item.plannedAmount || 0), dueDate: item.dueDate || '', status: item.status })) : defaultPlan;"""
new_block = """    const additions = roundContractMoney(addons.reduce((sum, item) => sum + contractAddonAmount(item), 0));
    const discount = roundContractMoney(Math.max(0, Number(packageSnapshot?.discount || 0)));
    const clientTotal = roundContractMoney(Math.max(0, Number(client.totalAmount || 0)));
    const storedPackageBase = roundContractMoney(Math.max(0, Number(packageSnapshot?.basePrice || 0)));
    const packageBase = storedPackageBase > 0
      ? storedPackageBase
      : roundContractMoney(Math.max(0, clientTotal - additions + discount));
    const calculatedTotal = roundContractMoney(Math.max(0, packageBase + additions - discount));
    const total = packageSnapshot ? calculatedTotal : (clientTotal > 0 ? clientTotal : calculatedTotal);
    const defaultPlan = standardContractPayments(total, contractDraft.eventDate || client.eventDate || '');
    const personalizedPlan = registeredPayments.map((item) => {
      const percentage = Math.max(0, Number(item.percentage || 0));
      const planned = Math.max(0, Number(item.plannedAmount || 0));
      const amount = roundContractMoney(planned > 0 ? planned : (percentage > 0 ? total * (percentage / 100) : 0));
      return { concept: item.concept || `Pago ${item.installmentNumber || ''}`.trim(), percentage, amount, dueDate: item.dueDate || '', status: item.status };
    });
    const payments = contractDraft.paymentPolicy === 'PERSONALIZADA' ? personalizedPlan : defaultPlan;"""
if old_block not in front:
    if 'const personalizedPlan = registeredPayments.map' not in front:
        raise SystemExit('No se encontró el bloque de cálculo de contrato esperado.')
else:
    front = front.replace(old_block, new_block, 1)

old_addons = "addons: addons.map((item) => ({ concept: item.concept, quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0), total: Number(item.total || 0), notes: item.notes || '' })),"
new_addons = "addons: addons.map((item) => ({ concept: item.concept, quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0), total: contractAddonAmount(item), notes: item.notes || '' })),"
if old_addons in front:
    front = front.replace(old_addons, new_addons, 1)
elif new_addons not in front:
    raise SystemExit('No se encontró el mapeo de adicionales del contrato.')

old_generate = """      const documentSnapshot = buildContractSnapshot(client);
      const saved = await createGeneratedBusinessContract({ clientId: client.id, folio: contractDraft.folio, documentType: contractDraft.documentType, paymentPolicy: contractDraft.paymentPolicy, snapshot: documentSnapshot });"""
new_generate = """      const documentSnapshot = buildContractSnapshot(client);
      const paymentTotal = roundContractMoney(documentSnapshot.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0));
      const contractTotal = roundContractMoney(documentSnapshot.commercial.total);
      if (contractDraft.paymentPolicy === 'PERSONALIZADA' && !documentSnapshot.payments.length) {
        throw new Error('El plan personalizado no tiene pagos registrados.');
      }
      if (Math.abs(paymentTotal - contractTotal) > 0.01) {
        throw new Error(`El calendario de pagos suma ${money(paymentTotal)}, pero el total contratado es ${money(contractTotal)}. Corrige el plan antes de generar el contrato.`);
      }
      const saved = await createGeneratedBusinessContract({ clientId: client.id, folio: contractDraft.folio, documentType: contractDraft.documentType, paymentPolicy: contractDraft.paymentPolicy, snapshot: documentSnapshot });"""
if old_generate in front:
    front = front.replace(old_generate, new_generate, 1)
elif 'const paymentTotal = roundContractMoney(documentSnapshot.payments.reduce' not in front:
    raise SystemExit('No se encontró la generación de contrato para validar totales.')

front_path.write_text(front, encoding='utf-8')

api_path = Path('api/proxy.js')
api = api_path.read_text(encoding='utf-8')
old_api = """        const snapshot = normalizeContractDocumentSnapshot(submitted.snapshot, documentType);
        snapshot.paymentPolicy = paymentPolicy;
        const result = await forwardContractGenerateWithRecovery({ clientId, folio, documentType, paymentPolicy, templateVersion: snapshot.templateVersion, documentJson: JSON.stringify(snapshot) });"""
new_api = """        const snapshot = normalizeContractDocumentSnapshot(submitted.snapshot, documentType);
        snapshot.paymentPolicy = paymentPolicy;
        const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;
        snapshot.addons = (snapshot.addons || []).map((item) => {
          const quantity = Math.max(0, Number(item.quantity || 0));
          const unitPrice = Math.max(0, Number(item.unitPrice || 0));
          const storedTotal = Math.max(0, Number(item.total || 0));
          return { ...item, total: roundCurrency(quantity > 0 && unitPrice > 0 ? quantity * unitPrice : storedTotal) };
        });
        snapshot.commercial.additions = roundCurrency(snapshot.addons.reduce((sum, item) => sum + Number(item.total || 0), 0));
        snapshot.commercial.packageBase = roundCurrency(Math.max(0, Number(snapshot.commercial.packageBase || 0)));
        snapshot.commercial.discount = roundCurrency(Math.max(0, Number(snapshot.commercial.discount || 0)));
        const arithmeticTotal = roundCurrency(Math.max(0, snapshot.commercial.packageBase + snapshot.commercial.additions - snapshot.commercial.discount));
        if (snapshot.commercial.packageBase > 0 || snapshot.commercial.additions > 0 || snapshot.commercial.discount > 0) snapshot.commercial.total = arithmeticTotal;
        else snapshot.commercial.total = roundCurrency(Math.max(0, Number(snapshot.commercial.total || 0)));
        if (paymentPolicy === '40-30-30') {
          const first = roundCurrency(snapshot.commercial.total * 0.4);
          const second = roundCurrency(snapshot.commercial.total * 0.3);
          const third = roundCurrency(snapshot.commercial.total - first - second);
          snapshot.payments = [
            { concept: '1er pago (Apartado)', percentage: 40, amount: first, dueDate: '', status: 'Pendiente' },
            { concept: '2do pago (Intermedio)', percentage: 30, amount: second, dueDate: snapshot.event.date || '', status: 'Pendiente' },
            { concept: '3er pago (Finiquito)', percentage: 30, amount: third, dueDate: '', status: 'Pendiente' },
          ];
        }
        if (paymentPolicy === 'PERSONALIZADA' && !snapshot.payments.length) return res.status(400).json({ status: 'error', message: 'El plan personalizado no tiene pagos registrados.' });
        const scheduledTotal = roundCurrency((snapshot.payments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
        if (Math.abs(scheduledTotal - snapshot.commercial.total) > 0.01) {
          return res.status(400).json({ status: 'error', message: `El calendario de pagos suma $${scheduledTotal.toFixed(2)}, pero el total contratado es $${snapshot.commercial.total.toFixed(2)}. Corrige el plan antes de generar.` });
        }
        const result = await forwardContractGenerateWithRecovery({ clientId, folio, documentType, paymentPolicy, templateVersion: snapshot.templateVersion, documentJson: JSON.stringify(snapshot) });"""
if old_api in api:
    api = api.replace(old_api, new_api, 1)
elif 'const scheduledTotal = roundCurrency((snapshot.payments || []).reduce' not in api:
    raise SystemExit('No se encontró el bloque servidor de generación de contrato.')

api_path.write_text(api, encoding='utf-8')

# Comprobaciones aritméticas de seguridad para montos comunes y no divisibles exactamente.
def r(value):
    return round(value + 1e-12, 2)
for total in (5000, 5499, 6000, 6499, 6990, 8999, 9990, 12345.67):
    first = r(total * .4)
    second = r(total * .3)
    third = r(total - first - second)
    if abs(r(first + second + third) - r(total)) > 0.001:
        raise SystemExit(f'Falla aritmética 40/30/30 para {total}')

print('Cálculos de contratos reparados y validados en frontend y servidor.')
