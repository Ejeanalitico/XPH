from pathlib import Path

path = Path('src/components/BusinessAdminPanel.tsx')
text = path.read_text(encoding='utf-8')

old = "  const [contractPreview, setContractPreview] = useState<BusinessContract | null>(null);\n  const [ownerSignature, setOwnerSignature] = useState('');"
new = "  const [contractPreview, setContractPreview] = useState<BusinessContract | null>(null);\n  const [showInlineContractEditor, setShowInlineContractEditor] = useState(false);\n  const [ownerSignature, setOwnerSignature] = useState('');"
if old not in text:
    raise SystemExit('state anchor not found')
text = text.replace(old, new, 1)

old = "  const openClientDetails = (client: CrmClient) => {\n    setRecordReturnTab(tab);\n    setSelectedClientId(client.id);\n    setShowClientForm(false);\n    setShowInlinePayment(false);\n    setTab(client.recordType === 'Prospecto' ? 'prospects' : 'clients');\n  };"
new = "  const openClientDetails = (client: CrmClient) => {\n    setRecordReturnTab(tab);\n    setSelectedClientId(client.id);\n    setShowClientForm(false);\n    setShowInlinePayment(false);\n    setShowInlineContractEditor(false);\n    setContractPreview(null);\n    setTab(client.recordType === 'Prospecto' ? 'prospects' : 'clients');\n  };"
if old not in text:
    raise SystemExit('openClientDetails anchor not found')
text = text.replace(old, new, 1)

old = "  const closeClientDetails = () => {\n    setSelectedClientId('');\n    setShowClientForm(false);\n    setShowInlinePayment(false);\n    setPaymentDraft(blankPayment());\n    setPaymentReceipt(null);\n    setTab(recordReturnTab);\n  };"
new = "  const closeClientDetails = () => {\n    setSelectedClientId('');\n    setShowClientForm(false);\n    setShowInlinePayment(false);\n    setShowInlineContractEditor(false);\n    setContractPreview(null);\n    setPaymentDraft(blankPayment());\n    setPaymentReceipt(null);\n    setTab(recordReturnTab);\n  };"
if old not in text:
    raise SystemExit('closeClientDetails anchor not found')
text = text.replace(old, new, 1)

old = "  const canManageFinance = session.role === 'SUPER_ADMIN';\n  const pendingNotificationCount"
new = "  const canManageFinance = session.role === 'SUPER_ADMIN';\n  const canManageContracts = session.role === 'SUPER_ADMIN' || session.permissions.includes('CONTRACTS');\n  const pendingNotificationCount"
if old not in text:
    raise SystemExit('permissions anchor not found')
text = text.replace(old, new, 1)

old = "  const selectedClientContract = selectedClient ? snapshot.contracts.find((contract) => contract.clientId === selectedClient.id) : undefined;\n  const selectedFollowUps"
new = "  const selectedClientContract = selectedClient ? snapshot.contracts\n    .filter((contract) => contract.clientId === selectedClient.id && contract.documentType !== 'COTIZACION')\n    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0] : undefined;\n  const selectedFollowUps"
if old not in text:
    raise SystemExit('selected contract anchor not found')
text = text.replace(old, new, 1)

anchor = "  const generateContractDocument = async (event: React.FormEvent) => {"
if anchor not in text:
    raise SystemExit('generate contract anchor not found')
insert = r'''  const openInlineContractEditor = (client: CrmClient, contract?: BusinessContract) => {
    const frozen = contract?.documentSnapshot;
    const eventDate = dateValue(frozen?.event?.date || contract?.eventDate || client.eventDate);
    const eventType = String(frozen?.event?.type || contract?.eventType || client.eventType || '');
    const compactDate = (eventDate || today()).replace(/-/g, '');
    const prefix = /xv|15|quince/i.test(eventType) ? 'XVA' : 'BD';
    setContractDraft({
      clientId: client.id,
      folio: contract?.folio || `${prefix}-${compactDate}`,
      eventType,
      eventDate,
      documentType: 'CONTRATO',
      paymentPolicy: contract?.paymentPolicy || frozen?.paymentPolicy || '40-30-30',
      file: null,
    });
    setShowInlineContractEditor(true);
    setShowClientForm(false);
    setContractPreview(null);
  };

  const generateInlineContractDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = selectedClient;
    if (!client || !contractDraft.folio) return setModalNotice('Registra el folio antes de crear el contrato.');
    const missingFields = getContractDataChecklist(client).filter((item) => item.required && !item.complete);
    if (missingFields.length) return setModalNotice(`Completa antes de generar: ${missingFields.map((item) => item.label).join(', ')}.`);
    setBusy(true);
    try {
      const documentSnapshot = buildContractSnapshot(client);
      const paymentTotal = roundContractMoney(documentSnapshot.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0));
      const contractTotal = roundContractMoney(documentSnapshot.commercial.total);
      if (contractDraft.paymentPolicy === 'PERSONALIZADA' && !documentSnapshot.payments.length) throw new Error('El plan personalizado no tiene pagos registrados.');
      if (Math.abs(paymentTotal - contractTotal) > 0.01) throw new Error(`El calendario de pagos suma ${money(paymentTotal)}, pero el total contratado es ${money(contractTotal)}. Corrige el plan antes de generar el contrato.`);
      const hadContract = Boolean(selectedClientContract);
      const saved = await createGeneratedBusinessContract({ clientId: client.id, folio: contractDraft.folio, documentType: 'CONTRATO', paymentPolicy: contractDraft.paymentPolicy, snapshot: documentSnapshot });
      setSnapshot((prev) => ({ ...prev, contracts: [saved, ...prev.contracts.filter((item) => item.id !== saved.id)] }));
      setShowInlineContractEditor(false);
      setContractPreview(saved);
      setModalNotice(hadContract ? 'Nueva versión del contrato creada con los datos actualizados. La versión anterior se conserva en el historial.' : 'Contrato creado desde la ficha del contacto.');
    } catch (error: any) {
      setModalNotice(error?.message || 'No se pudo generar el contrato.');
    } finally {
      setBusy(false);
    }
  };

'''
text = text.replace(anchor, insert + anchor, 1)

anchor = "              {showInlinePayment && <div className=\"border-b border-white/10 p-5\">"
if anchor not in text:
    raise SystemExit('inline payment render anchor not found')
section = r'''              {canManageContracts && <section className="border-b border-white/10 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2"><FileSignature className="h-4 w-4 text-[#D4AF37]" /><h3 className="font-semibold text-white">Contrato</h3></div>
                    {selectedClientContract ? <p className="mt-1 text-xs text-gray-400">{selectedClientContract.folio} · {selectedClientContract.status} · última versión relacionada con este contacto</p> : <p className="mt-1 text-xs text-amber-200">Este {selectedClient.recordType === 'Prospecto' ? 'prospecto' : 'cliente'} todavía no tiene contrato.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!selectedClientContract && <button type="button" onClick={() => openInlineContractEditor(selectedClient)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black disabled:opacity-40"><Plus className="h-4 w-4" />Crear contrato</button>}
                    {selectedClientContract && <><a href={adminContractPdfUrl(selectedClientContract.id, 'latest', contractPdfRevision(selectedClientContract))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white"><Eye className="h-4 w-4" />Ver contrato</a><button type="button" onClick={() => downloadContractPdf(selectedClientContract)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/35 bg-[#D4AF37]/5 px-4 py-2 text-sm font-semibold text-[#F5D76E] disabled:opacity-40"><Download className="h-4 w-4" />Descargar PDF</button><button type="button" onClick={() => openInlineContractEditor(selectedClient, selectedClientContract)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 disabled:opacity-40"><PenLine className="h-4 w-4" />Modificar contrato</button>{!['Finalizado'].includes(selectedClientContract.status) && selectedClientContract.documentType !== 'COTIZACION' && <button type="button" onClick={() => createLink(selectedClientContract)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-200 disabled:opacity-40"><Send className="h-4 w-4" />Liga de firma</button>}{selectedClientContract.status === 'Firmado por cliente' && <button type="button" onClick={() => finalize(selectedClientContract)} disabled={busy || !snapshot.ownerSignatureConfigured} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Autorizar y finalizar</button>}{selectedClientContract.status === 'Finalizado' && <button type="button" onClick={() => resendFinalContract(selectedClientContract)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-4 py-2 text-sm font-semibold text-emerald-300 disabled:opacity-40"><Mail className="h-4 w-4" />Reenviar por correo</button>}</>}
                  </div>
                </div>
                {showInlineContractEditor && <form onSubmit={generateInlineContractDocument} className="mt-4 grid gap-3 rounded-xl border border-[#D4AF37]/20 bg-black/15 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2 lg:col-span-4"><p className="text-sm font-semibold text-white">{selectedClientContract ? 'Modificar contrato / crear nueva versión' : 'Crear contrato'}</p><p className="mt-1 text-xs text-gray-400">Los datos comerciales, servicios y adicionales se toman directamente de la ficha actual. Al modificar un contrato existente se conserva la versión anterior como historial.</p></div>
                  <label className="text-xs text-gray-300">Folio<input value={contractDraft.folio} onChange={(event) => setContractDraft((prev) => ({ ...prev, folio: event.target.value }))} className={`${inputClass} mt-1`} required /></label>
                  <label className="text-xs text-gray-300">Tipo de evento<input value={contractDraft.eventType} onChange={(event) => setContractDraft((prev) => ({ ...prev, eventType: event.target.value }))} className={`${inputClass} mt-1`} required /></label>
                  <label className="text-xs text-gray-300">Fecha del evento<input type="date" value={contractDraft.eventDate} onChange={(event) => setContractDraft((prev) => ({ ...prev, eventDate: event.target.value }))} className={`${inputClass} mt-1`} required /></label>
                  <label className="text-xs text-gray-300">Plan de pagos<select value={contractDraft.paymentPolicy} onChange={(event) => setContractDraft((prev) => ({ ...prev, paymentPolicy: event.target.value as '40-30-30' | 'PERSONALIZADA' }))} className={`${inputClass} mt-1`}><option value="40-30-30">40% / 30% / 30%</option><option value="PERSONALIZADA">Personalizado</option></select></label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4"><button type="button" onClick={() => setShowInlineContractEditor(false)} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-gray-200">Cancelar</button><button type="submit" disabled={busy} className="rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40">{busy ? 'Generando…' : selectedClientContract ? 'Guardar nueva versión' : 'Crear contrato'}</button>{selectedClientContract && <button type="button" onClick={() => { setShowInlineContractEditor(false); setClientDraft(selectedClient); setShowClientForm(true); }} className="rounded-lg border border-sky-300/30 bg-sky-400/10 px-4 py-2.5 text-sm font-semibold text-sky-100">Editar datos del cliente</button>}</div>
                </form>}
              </section>}
'''
text = text.replace(anchor, section + anchor, 1)

path.write_text(text, encoding='utf-8')
