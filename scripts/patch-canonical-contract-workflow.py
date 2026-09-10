from pathlib import Path
import re

root = Path('.')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing pattern: {label}')
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# 1) Client signing page: always show the exact canonical PDF that XPH keeps.
# -----------------------------------------------------------------------------
mobile_path = root / 'src/components/MobileContractSigningPage.tsx'
mobile = mobile_path.read_text(encoding='utf-8')
mobile = mobile.replace("import { ContractDocument } from './ContractDocument';\n", '')
old_mobile_view = '''          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white">{contract.documentSnapshot ? <ContractDocument snapshot={contract.documentSnapshot} folio={contract.folio} /> : <iframe title={`Contrato ${contract.folio}`} src={safeContractPdfUrl(token)} className="h-[66vh] w-full bg-white" />}</section>'''
new_mobile_view = '''          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white">
            <iframe title={`Contrato ${contract.folio}`} src={safeContractPdfUrl(token)} className="h-[72vh] w-full bg-white" />
          </section>
          <a href={safeContractPdfUrl(token)} target="_blank" rel="noreferrer" className="block rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-4 py-3 text-center text-sm font-semibold text-[#F5D76E]">Abrir el mismo PDF en pantalla completa</a>'''
mobile = replace_once(mobile, old_mobile_view, new_mobile_view, 'mobile canonical PDF view')
mobile_path.write_text(mobile, encoding='utf-8')

# -----------------------------------------------------------------------------
# 2) Prospect/client file: quote + contract live in the same record.
# -----------------------------------------------------------------------------
panel_path = root / 'src/components/BusinessAdminPanel.tsx'
panel = panel_path.read_text(encoding='utf-8')
panel = panel.replace("import { ContractDocument } from './ContractDocument';\n", '')
panel = panel.replace("templateVersion: 'contrato-xph-fiel-v2',", "templateVersion: 'contrato-xph-canonical-v3',")

old_selected = '''  const selectedClientContract = selectedClient ? snapshot.contracts
    .filter((contract) => contract.clientId === selectedClient.id && contract.documentType !== 'COTIZACION')
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0] : undefined;'''
new_selected = '''  const selectedClientContract = selectedClient ? snapshot.contracts
    .filter((contract) => contract.clientId === selectedClient.id && contract.documentType !== 'COTIZACION')
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0] : undefined;
  const selectedClientQuote = selectedClient ? snapshot.contracts
    .filter((contract) => contract.clientId === selectedClient.id && contract.documentType === 'COTIZACION')
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0] : undefined;'''
panel = replace_once(panel, old_selected, new_selected, 'selected quote')

old_open = '''  const openInlineContractEditor = (client: CrmClient, contract?: BusinessContract) => {
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
  };'''
new_open = '''  const openInlineContractEditor = (client: CrmClient, contract?: BusinessContract, requestedType?: 'CONTRATO' | 'COTIZACION') => {
    const frozen = contract?.documentSnapshot;
    const documentType = requestedType || contract?.documentType || 'CONTRATO';
    const eventDate = dateValue(frozen?.event?.date || contract?.eventDate || client.eventDate);
    const eventType = String(frozen?.event?.type || contract?.eventType || client.eventType || '');
    const compactDate = (eventDate || today()).replace(/-/g, '');
    const contractPrefix = /xv|15|quince/i.test(eventType) ? 'XVA' : 'BD';
    const prefix = documentType === 'COTIZACION' ? 'COT' : contractPrefix;
    setContractDraft({
      clientId: client.id,
      folio: contract?.folio || `${prefix}-${compactDate}`,
      eventType,
      eventDate,
      documentType,
      paymentPolicy: contract?.paymentPolicy || frozen?.paymentPolicy || '40-30-30',
      file: null,
    });
    setShowInlineContractEditor(true);
    setShowClientForm(false);
    setContractPreview(null);
  };'''
panel = replace_once(panel, old_open, new_open, 'inline editor document type')

old_generate = '''      const hadContract = Boolean(selectedClientContract);
      const saved = await createGeneratedBusinessContract({ clientId: client.id, folio: contractDraft.folio, documentType: 'CONTRATO', paymentPolicy: contractDraft.paymentPolicy, snapshot: documentSnapshot });
      setSnapshot((prev) => ({ ...prev, contracts: [saved, ...prev.contracts.filter((item) => item.id !== saved.id)] }));
      setShowInlineContractEditor(false);
      setContractPreview(saved);
      setModalNotice(hadContract ? 'Nueva versión del contrato creada con los datos actualizados. La versión anterior se conserva en el historial.' : 'Contrato creado desde la ficha del contacto.');'''
new_generate = '''      const isQuote = contractDraft.documentType === 'COTIZACION';
      const hadDocument = isQuote ? Boolean(selectedClientQuote) : Boolean(selectedClientContract);
      const saved = await createGeneratedBusinessContract({ clientId: client.id, folio: contractDraft.folio, documentType: contractDraft.documentType, paymentPolicy: contractDraft.paymentPolicy, snapshot: documentSnapshot });
      setSnapshot((prev) => ({ ...prev, contracts: [saved, ...prev.contracts.filter((item) => item.id !== saved.id)] }));
      setShowInlineContractEditor(false);
      setContractPreview(saved);
      const label = isQuote ? 'cotización' : 'contrato';
      setModalNotice(hadDocument ? `Nueva versión de la ${label} creada con los datos actualizados. La versión anterior se conserva en el historial.` : `${isQuote ? 'Cotización' : 'Contrato'} creado desde la ficha del contacto.`);'''
panel = replace_once(panel, old_generate, new_generate, 'inline document generation')
panel = panel.replace("return setModalNotice('Registra el folio antes de crear el contrato.');", "return setModalNotice('Registra el folio antes de crear el documento.');")

# Replace the inline contract-only section with a commercial documents section.
start_marker = '              {canManageContracts && <section className="border-b border-white/10 p-5">\n'
end_marker = '              {showInlinePayment && <div className="border-b border-white/10 p-5">'
start = panel.find(start_marker)
end = panel.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('Missing inline commercial section markers')
new_section = '''              {canManageContracts && <section className="border-b border-white/10 p-5">
                <div className="mb-4">
                  <div className="flex items-center gap-2"><FileSignature className="h-4 w-4 text-[#D4AF37]" /><h3 className="font-semibold text-white">Cotización y contrato</h3></div>
                  <p className="mt-1 text-xs text-gray-400">Administra ambos documentos desde la misma ficha del {selectedClient.recordType === 'Prospecto' ? 'prospecto' : 'cliente'}, sin cambiar de módulo.</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <article className="rounded-xl border border-sky-300/20 bg-sky-400/5 p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-sky-200">Cotización</p>{selectedClientQuote ? <p className="mt-1 text-sm text-white">{selectedClientQuote.folio} · {selectedClientQuote.status}</p> : <p className="mt-1 text-xs text-gray-400">Todavía no existe una cotización para este contacto.</p>}</div></div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!selectedClientQuote ? <button type="button" onClick={() => openInlineContractEditor(selectedClient, undefined, 'COTIZACION')} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-sky-300 px-3 py-2 text-xs font-bold text-sky-950 disabled:opacity-40"><Plus className="h-4 w-4" />Crear cotización</button> : <><a href={adminContractPdfUrl(selectedClientQuote.id, 'latest', contractPdfRevision(selectedClientQuote))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white"><Eye className="h-4 w-4" />Ver cotización</a><button type="button" onClick={() => downloadContractPdf(selectedClientQuote)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-sky-300/30 px-3 py-2 text-xs font-semibold text-sky-100 disabled:opacity-40"><Download className="h-4 w-4" />Descargar PDF</button><button type="button" onClick={() => openInlineContractEditor(selectedClient, selectedClientQuote, 'COTIZACION')} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-sky-300/30 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 disabled:opacity-40"><PenLine className="h-4 w-4" />Modificar cotización</button></>}
                    </div>
                  </article>
                  <article className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#F5D76E]">Contrato</p>{selectedClientContract ? <p className="mt-1 text-sm text-white">{selectedClientContract.folio} · {selectedClientContract.status}</p> : <p className="mt-1 text-xs text-gray-400">Todavía no existe un contrato para este contacto.</p>}</div></div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!selectedClientContract ? <button type="button" onClick={() => openInlineContractEditor(selectedClient, undefined, 'CONTRATO')} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-3 py-2 text-xs font-bold text-black disabled:opacity-40"><Plus className="h-4 w-4" />Crear contrato</button> : <><a href={adminContractPdfUrl(selectedClientContract.id, 'latest', contractPdfRevision(selectedClientContract))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white"><Eye className="h-4 w-4" />Ver contrato</a><button type="button" onClick={() => downloadContractPdf(selectedClientContract)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/35 px-3 py-2 text-xs font-semibold text-[#F5D76E] disabled:opacity-40"><Download className="h-4 w-4" />Descargar PDF</button><button type="button" onClick={() => openInlineContractEditor(selectedClient, selectedClientContract, 'CONTRATO')} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-sky-300/30 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 disabled:opacity-40"><PenLine className="h-4 w-4" />Modificar contrato</button>{selectedClientContract.status !== 'Finalizado' && <button type="button" onClick={() => createLink(selectedClientContract)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-200 disabled:opacity-40"><Send className="h-4 w-4" />Liga de firma</button>}{selectedClientContract.status === 'Firmado por cliente' && <button type="button" onClick={() => finalize(selectedClientContract)} disabled={busy || !snapshot.ownerSignatureConfigured} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-black disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Autorizar y finalizar</button>}{selectedClientContract.status === 'Finalizado' && <button type="button" onClick={() => resendFinalContract(selectedClientContract)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-40"><Mail className="h-4 w-4" />Reenviar por correo</button>}</>}
                    </div>
                  </article>
                </div>
                {showInlineContractEditor && <form onSubmit={generateInlineContractDocument} className="mt-4 grid gap-3 rounded-xl border border-[#D4AF37]/20 bg-black/15 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2 lg:col-span-4"><p className="text-sm font-semibold text-white">{contractDraft.documentType === 'COTIZACION' ? (selectedClientQuote ? 'Modificar cotización / crear nueva versión' : 'Crear cotización') : (selectedClientContract ? 'Modificar contrato / crear nueva versión' : 'Crear contrato')}</p><p className="mt-1 text-xs text-gray-400">Paquete, servicios, adicionales, totales y datos del evento se toman de esta ficha. La versión anterior permanece en el historial.</p></div>
                  <label className="text-xs text-gray-300">Tipo de documento<select value={contractDraft.documentType} onChange={(event) => setContractDraft((prev) => ({ ...prev, documentType: event.target.value as 'CONTRATO' | 'COTIZACION' }))} className={`${inputClass} mt-1`}><option value="COTIZACION">Cotización</option><option value="CONTRATO">Contrato</option></select></label>
                  <label className="text-xs text-gray-300">Folio<input value={contractDraft.folio} onChange={(event) => setContractDraft((prev) => ({ ...prev, folio: event.target.value }))} className={`${inputClass} mt-1`} required /></label>
                  <label className="text-xs text-gray-300">Tipo de evento<input value={contractDraft.eventType} onChange={(event) => setContractDraft((prev) => ({ ...prev, eventType: event.target.value }))} className={`${inputClass} mt-1`} required /></label>
                  <label className="text-xs text-gray-300">Fecha del evento<input type="date" value={contractDraft.eventDate} onChange={(event) => setContractDraft((prev) => ({ ...prev, eventDate: event.target.value }))} className={`${inputClass} mt-1`} required /></label>
                  <label className="text-xs text-gray-300">Plan de pagos<select value={contractDraft.paymentPolicy} onChange={(event) => setContractDraft((prev) => ({ ...prev, paymentPolicy: event.target.value as '40-30-30' | 'PERSONALIZADA' }))} className={`${inputClass} mt-1`}><option value="40-30-30">40% / 30% / 30%</option><option value="PERSONALIZADA">Personalizado</option></select></label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4"><button type="button" onClick={() => setShowInlineContractEditor(false)} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-gray-200">Cancelar</button><button type="submit" disabled={busy} className="rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40">{busy ? 'Generando…' : contractDraft.documentType === 'COTIZACION' ? 'Guardar cotización' : 'Guardar contrato'}</button><button type="button" onClick={() => { setShowInlineContractEditor(false); setClientDraft(selectedClient); setShowClientForm(true); }} className="rounded-lg border border-sky-300/30 bg-sky-400/10 px-4 py-2.5 text-sm font-semibold text-sky-100">Editar datos del contacto</button></div>
                </form>}
              </section>}
'''
panel = panel[:start] + new_section + panel[end:]

# Admin preview must also use the same PDF, never a parallel HTML design.
panel = panel.replace('<ContractDocument snapshot={contractPreview.documentSnapshot} folio={contractPreview.folio} />', '<iframe title={`Documento ${contractPreview.folio}`} src={adminContractPdfUrl(contractPreview.id, \'latest\', contractPdfRevision(contractPreview))} className="h-[80vh] w-full bg-white" />')
panel_path.write_text(panel, encoding='utf-8')

# -----------------------------------------------------------------------------
# 3) Canonical PDF: the original PDF already contains the signature page.
#    Client and owner signatures are overlaid onto that SAME PDF.
# -----------------------------------------------------------------------------
proxy_path = root / 'api/proxy.js'
proxy = proxy_path.read_text(encoding='utf-8')

append_pattern = re.compile(r"async function appendClientSignature\(pdfBase64, signatureDataUrl, contract, audit\) \{.*?\n\}\n\nasync function renderContractSnapshotPdf", re.S)
append_replacement = r'''async function appendClientSignature(pdfBase64, signatureDataUrl, contract, audit) {
  const pdfBytes = Buffer.from(cleanBase64(pdfBase64), 'base64');
  const signatureBytes = Buffer.from(cleanBase64(signatureDataUrl), 'base64');
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  const signature = await pdf.embedPng(signatureBytes);
  const templateVersion = String(contract?.templateVersion || contract?.documentSnapshot?.templateVersion || '');

  if (templateVersion.includes('canonical-v3')) {
    const pages = pdf.getPages();
    if (!pages.length) throw new Error('El contrato no contiene páginas.');
    const page = pages[pages.length - 1];
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const rightX = page.getWidth() / 2 + 18;
    const boxWidth = Math.max(150, Math.min(220, page.getWidth() - rightX - 42));
    const scaled = signature.scaleToFit(boxWidth, 88);
    page.drawRectangle({ x: rightX - 3, y: 408, width: boxWidth + 6, height: 94, color: rgb(1, 1, 1) });
    page.drawImage(signature, { x: rightX + Math.max(0, (boxWidth - scaled.width) / 2), y: 410 + Math.max(0, (88 - scaled.height) / 2), width: scaled.width, height: scaled.height });
    page.drawText(`Firmado: ${formatContractDateTime(audit.acceptedAt)}`, { x: rightX, y: 342, size: 7, font, color: rgb(0.35, 0.37, 0.42) });
    page.drawText(`IP: ${audit.ip || 'No disponible'}`, { x: rightX, y: 330, size: 7, font, color: rgb(0.35, 0.37, 0.42) });
    return Buffer.from(await pdf.save()).toString('base64');
  }

  // Compatibilidad con contratos históricos: conservan la constancia anterior.
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const scaled = signature.scaleToFit(220, 92);
  page.drawText('CONSTANCIA DE ACEPTACIÓN Y FIRMA', { x: 54, y: 720, size: 16, font: bold, color: rgb(0.12, 0.14, 0.18) });
  page.drawText(`Contrato: ${String(contract.folio || contract.id || '').slice(0, 100)}`, { x: 54, y: 685, size: 10, font });
  page.drawText(`Cliente: ${String(contract.clientName || '').slice(0, 120)}`, { x: 54, y: 667, size: 10, font });
  page.drawText(`Fecha del evento: ${String(contract.eventDate || 'Por confirmar').slice(0, 40)}`, { x: 54, y: 649, size: 10, font });
  page.drawText('El cliente confirma que leyó el contrato completo y aceptó sus términos', { x: 54, y: 610, size: 9, font });
  page.drawText('antes de realizar la firma manuscrita electrónica que aparece abajo.', { x: 54, y: 596, size: 9, font });
  page.drawText(`Fecha y hora de firma: ${formatContractDateTime(audit.acceptedAt)}`, { x: 54, y: 566, size: 8, font, color: rgb(0.3, 0.32, 0.36) });
  page.drawText(`IP: ${audit.ip || 'No disponible'}`, { x: 54, y: 552, size: 8, font, color: rgb(0.3, 0.32, 0.36) });
  page.drawText('FIRMAS', { x: 54, y: 485, size: 13, font: bold, color: rgb(0.12, 0.14, 0.18) });
  page.drawText('PRESTADOR DEL SERVICIO', { x: 54, y: 452, size: 10, font: bold });
  page.drawText('CLIENTE', { x: 338, y: 452, size: 10, font: bold });
  page.drawText('Pendiente de autorización', { x: 88, y: 374, size: 8, font, color: rgb(0.45, 0.46, 0.5) });
  page.drawImage(signature, { x: 338, y: 335, width: scaled.width, height: scaled.height });
  page.drawLine({ start: { x: 54, y: 325 }, end: { x: 274, y: 325 }, thickness: 0.8, color: rgb(0.15, 0.16, 0.18) });
  page.drawLine({ start: { x: 338, y: 325 }, end: { x: 558, y: 325 }, thickness: 0.8, color: rgb(0.15, 0.16, 0.18) });
  page.drawText('Javier García', { x: 54, y: 306, size: 10, font: bold });
  page.drawText('Prestador del servicio', { x: 54, y: 290, size: 9, font });
  page.drawText(String(contract.clientName || 'Cliente registrado').slice(0, 42), { x: 338, y: 306, size: 10, font: bold });
  page.drawText('Cliente / Contratante', { x: 338, y: 290, size: 9, font });
  page.drawText('Xavi.ph conserva el documento original y esta constancia como evidencia del proceso.', { x: 54, y: 95, size: 8, font, color: rgb(0.35, 0.37, 0.42) });
  return Buffer.from(await pdf.save()).toString('base64');
}

async function renderContractSnapshotPdf'''
proxy, count = append_pattern.subn(append_replacement, proxy, count=1)
if count != 1:
    raise SystemExit('Could not replace appendClientSignature')

old_render_tail = '''  if (snapshot.documentType === 'CONTRATO') {
    heading('Terminos y condiciones');
    (snapshot.terms || []).forEach((term, index) => bullet(`${index + 1}. ${term}`));
  }
  ensure(50);
  y -= 12;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, thickness: 1, color: rgb(.82, .82, .82) });
  page.drawText('XPH Fotografia & Video · Version congelada al momento de su emision', { x: 42, y: y - 20, size: 8, font: regular, color: rgb(.4, .4, .4) });
  return Buffer.from(await pdf.save()).toString('base64');
}'''
new_render_tail = '''  if (snapshot.documentType === 'CONTRATO') {
    heading('Terminos y condiciones');
    (snapshot.terms || []).forEach((term, index) => bullet(`${index + 1}. ${term}`));
  }

  if (snapshot.documentType === 'CONTRATO' && String(snapshot.templateVersion || '').includes('canonical-v3')) {
    // La página de firmas forma parte del PDF original desde su creación.
    // Las firmas se insertan después sobre ESTA MISMA página; nunca se cambia de diseño.
    addPage();
    heading('Firmas y aceptacion');
    page.drawText('Las partes manifiestan que leyeron y aceptan el contenido completo de este contrato.', { x: 42, y: 675, size: 10, font: regular, color: dark });
    page.drawText('La firma electrónica se integra directamente a esta misma versión del documento.', { x: 42, y: 658, size: 10, font: regular, color: dark });
    page.drawText(`Folio ${String(contract.folio || '')}`, { x: 42, y: 628, size: 9, font: bold, color: rgb(.35, .35, .35) });

    const signatureRightX = page.getWidth() / 2 + 18;
    page.drawText('EL PRESTADOR DEL SERVICIO', { x: 42, y: 540, size: 9, font: bold, color: dark });
    page.drawText('EL CLIENTE', { x: signatureRightX, y: 540, size: 9, font: bold, color: dark });
    page.drawLine({ start: { x: 42, y: 400 }, end: { x: 270, y: 400 }, thickness: 0.9, color: dark });
    page.drawLine({ start: { x: signatureRightX, y: 400 }, end: { x: 553, y: 400 }, thickness: 0.9, color: dark });
    page.drawText('Javier García', { x: 42, y: 382, size: 9, font: bold, color: dark });
    page.drawText('Prestador del servicio', { x: 42, y: 367, size: 8, font: regular, color: rgb(.35, .35, .35) });
    page.drawText(String(snapshot.client?.name || contract.clientName || 'Cliente').slice(0, 42), { x: signatureRightX, y: 382, size: 9, font: bold, color: dark });
    page.drawText('Cliente / Contratante', { x: signatureRightX, y: 367, size: 8, font: regular, color: rgb(.35, .35, .35) });
    page.drawText('Documento original de XPH. Las firmas posteriores no alteran el contenido comercial ni las cláusulas.', { x: 42, y: 270, size: 8, font: regular, color: rgb(.4, .4, .4) });
    y = 220;
  }

  ensure(50);
  y -= 12;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, thickness: 1, color: rgb(.82, .82, .82) });
  page.drawText('XPH Fotografia & Video · Version congelada al momento de su emision', { x: 42, y: y - 20, size: 8, font: regular, color: rgb(.4, .4, .4) });
  return Buffer.from(await pdf.save()).toString('base64');
}'''
proxy = replace_once(proxy, old_render_tail, new_render_tail, 'canonical signature page')

owner_pattern = re.compile(r"async function applyOwnerSignature\(pdfBase64, signatureDataUrl, authorizedAt\) \{.*?\n\}\n\nfunction analyticsPeriod", re.S)
owner_replacement = r'''async function applyOwnerSignature(pdfBase64, signatureDataUrl, authorizedAt) {
  const pdf = await PDFDocument.load(Buffer.from(cleanBase64(pdfBase64), 'base64'));
  const pages = pdf.getPages();
  if (!pages.length) throw new Error('El contrato firmado no contiene páginas.');
  const page = pages[pages.length - 1];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const signature = await pdf.embedPng(Buffer.from(cleanBase64(signatureDataUrl), 'base64'));

  // Nuevos contratos: la última página A4 ya es la página canónica de firmas.
  const canonical = page.getWidth() < 600 && page.getHeight() > 820;
  if (canonical) {
    const boxWidth = 220;
    const scaled = signature.scaleToFit(boxWidth, 88);
    page.drawRectangle({ x: 39, y: 408, width: boxWidth + 6, height: 94, color: rgb(1, 1, 1) });
    page.drawImage(signature, { x: 42 + Math.max(0, (boxWidth - scaled.width) / 2), y: 410 + Math.max(0, (88 - scaled.height) / 2), width: scaled.width, height: scaled.height });
    page.drawText(`Autorizado: ${formatContractDateTime(authorizedAt)}`, { x: 42, y: 342, size: 7, font, color: rgb(0.35, 0.37, 0.42) });
    return Buffer.from(await pdf.save()).toString('base64');
  }

  // Compatibilidad con la constancia histórica.
  const scaled = signature.scaleToFit(220, 92);
  page.drawRectangle({ x: 50, y: 332, width: 228, height: 105, color: rgb(1, 1, 1) });
  page.drawImage(signature, { x: 54, y: 335, width: scaled.width, height: scaled.height });
  page.drawText(`Fecha y hora de autorización: ${formatContractDateTime(authorizedAt)}`, { x: 54, y: 274, size: 7, font, color: rgb(0.35, 0.37, 0.42) });
  return Buffer.from(await pdf.save()).toString('base64');
}

function analyticsPeriod'''
proxy, count = owner_pattern.subn(owner_replacement, proxy, count=1)
if count != 1:
    raise SystemExit('Could not replace applyOwnerSignature')

proxy_path.write_text(proxy, encoding='utf-8')

print('Canonical quote/contract workflow patch applied.')
