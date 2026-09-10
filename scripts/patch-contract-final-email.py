from pathlib import Path


def replace_once(text: str, old: str, new: str, marker: str, label: str) -> str:
    if marker in text:
        return text
    if old not in text:
        raise SystemExit(f'Could not locate {label}')
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Vercel proxy: automatic delivery + secure PDF fallback link.
# ---------------------------------------------------------------------------
proxy_path = Path('api/proxy.js')
proxy = proxy_path.read_text()

request_origin = """function requestOrigin(req) {
  const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0];
  return `${protocol}://${String(req.headers?.host || 'www.xaviph.com')}`;
}
"""
proxy_helpers = request_origin + """

const FINAL_CONTRACT_EMAIL_TEMPLATE_ID = 'contrato-firmado-final-auto';
const FINAL_CONTRACT_DOWNLOAD_DAYS = 365;

function signFinalContractDownload(contractId, expiresAt) {
  const encoded = b64url(JSON.stringify({ contractId: String(contractId || ''), exp: Number(expiresAt || 0) }));
  const signature = createHmac('sha256', sessionSecret()).update(`contract-final:${encoded}`).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyFinalContractDownload(value) {
  if (!value || !String(value).includes('.')) return null;
  const [encoded, signature] = String(value).split('.');
  const expected = createHmac('sha256', sessionSecret()).update(`contract-final:${encoded}`).digest('base64url');
  try {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.contractId || Number(payload.exp) <= Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

async function deliverFinalContractEmail(req, contract, userId) {
  if (!contract?.clientId) throw new Error('El contrato final no está vinculado a un cliente.');
  const expiresAtMs = Date.now() + FINAL_CONTRACT_DOWNLOAD_DAYS * 24 * 60 * 60 * 1000;
  const token = signFinalContractDownload(contract.id, expiresAtMs);
  const contractUrl = `${requestOrigin(req)}/api/proxy?action=contractFinalPdf&token=${encodeURIComponent(token)}`;

  await forwardBusinessAction('emailTemplateUpsert', {
    emailTemplate: {
      id: FINAL_CONTRACT_EMAIL_TEMPLATE_ID,
      name: 'Contrato firmado final',
      subject: 'Tu contrato firmado XPH · {{evento_tipo}}',
      htmlBody: '<p>Hola {{cliente_nombre}},</p><p>Tu contrato con <strong>XPH Producción Audiovisual &amp; Makeup</strong> ya fue firmado y autorizado por ambas partes.</p><p>Puedes descargar tu copia final en PDF desde el siguiente botón:</p><p style="margin:24px 0"><a href="{{contrato_url}}" style="display:inline-block;background:#D4AF37;color:#111827;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Descargar contrato firmado en PDF</a></p><p><strong>Folio:</strong> {{contrato_folio}}</p><p>Conserva este documento como tu copia del contrato final.</p>',
      status: 'ACTIVA',
    },
  });

  const sent = await forwardBusinessAction('emailSend', {
    clientId: contract.clientId,
    templateId: FINAL_CONTRACT_EMAIL_TEMPLATE_ID,
    variables: {
      contrato_url: contractUrl,
      contrato_folio: contract.folio || contract.id,
    },
    userId: userId || 'xph-super-admin',
  });
  return {
    sent: true,
    mode: 'LINK_SEGURO_PDF',
    expiresAt: new Date(expiresAtMs).toISOString(),
    emailHistory: sent.emailHistory || null,
  };
}
"""
proxy = replace_once(proxy, request_origin, proxy_helpers, 'function signFinalContractDownload(', 'requestOrigin helper insertion')

proxy = replace_once(
    proxy,
    "      'adminContractFinalize',\n      'adminContractDelete',",
    "      'adminContractFinalize',\n      'adminContractEmailFinal',\n      'adminContractDelete',",
    "      'adminContractEmailFinal',",
    'admin contract email action list',
)

proxy = replace_once(
    proxy,
    "adminContractCreateLink: 'CONTRACTS', adminOwnerSignatureSave: 'CONTRACTS', adminContractFinalize: 'CONTRACTS', adminContractDelete: 'SUPER_ADMIN',",
    "adminContractCreateLink: 'CONTRACTS', adminOwnerSignatureSave: 'CONTRACTS', adminContractFinalize: 'CONTRACTS', adminContractEmailFinal: 'CONTRACTS', adminContractDelete: 'SUPER_ADMIN',",
    "adminContractEmailFinal: 'CONTRACTS'",
    'admin contract email permission',
)

old_finalize = """      if (action === 'adminContractFinalize') {
        const contractId = String(submitted.contractId || '');
        const material = await forwardBusinessAction('contractFinalizeData', { contractId });
        const authorizedAt = new Date().toISOString();
        const finalizedPdfBase64 = await applyOwnerSignature(material.pdfBase64, material.ownerSignatureDataUrl, authorizedAt);
        const finalDocumentHash = createHash('sha256').update(Buffer.from(finalizedPdfBase64, 'base64')).digest('hex');
        const result = await forwardBusinessAction('contractFinalize', { contractId, finalizedPdfBase64, finalDocumentHash, authorizedAt });
        return res.status(200).json({ status: 'success', contract: result.contract });
      }
"""
new_finalize = """      if (action === 'adminContractFinalize') {
        const contractId = String(submitted.contractId || '');
        const material = await forwardBusinessAction('contractFinalizeData', { contractId });
        const authorizedAt = new Date().toISOString();
        const finalizedPdfBase64 = await applyOwnerSignature(material.pdfBase64, material.ownerSignatureDataUrl, authorizedAt);
        const finalDocumentHash = createHash('sha256').update(Buffer.from(finalizedPdfBase64, 'base64')).digest('hex');
        const result = await forwardBusinessAction('contractFinalize', { contractId, finalizedPdfBase64, finalDocumentHash, authorizedAt });
        let emailDelivery = result.emailDelivery || null;
        if (!emailDelivery?.sent) {
          try {
            emailDelivery = await deliverFinalContractEmail(req, result.contract, session.userId);
          } catch (error) {
            emailDelivery = { sent: false, mode: 'NO_ENVIADO', error: String(error?.message || error || 'No se pudo enviar el correo.') };
          }
        }
        return res.status(200).json({ status: 'success', contract: result.contract, emailDelivery });
      }
      if (action === 'adminContractEmailFinal') {
        const contractId = String(submitted.contractId || '').trim();
        if (!contractId) return res.status(400).json({ status: 'error', message: 'Contrato no identificado.' });
        const snapshotResult = await forwardTransientBusinessAction('businessSnapshot', {}, 5);
        const contract = (snapshotResult.snapshot?.contracts || []).find((item) => String(item.id) === contractId);
        if (!contract || String(contract.status || '') !== 'Finalizado') return res.status(400).json({ status: 'error', message: 'Solo se puede reenviar un contrato finalizado.' });
        const emailDelivery = await deliverFinalContractEmail(req, contract, session.userId);
        return res.status(200).json({ status: 'success', contract, emailDelivery });
      }
"""
proxy = replace_once(proxy, old_finalize, new_finalize, "if (action === 'adminContractEmailFinal')", 'contract finalization delivery block')

admin_pdf_marker = """    if (req.method === 'GET' && action === 'adminContractPdf') {
"""
public_final_pdf = """    if (req.method === 'GET' && action === 'contractFinalPdf') {
      const attempt = rateLimit(req, 'contract-final-pdf', 30, 10 * 60 * 1000);
      if (!attempt.allowed) {
        res.setHeader('Retry-After', String(attempt.retryAfter));
        return res.status(429).json({ status: 'error', message: 'Demasiadas descargas. Intenta nuevamente más tarde.' });
      }
      const claims = verifyFinalContractDownload(String(req.query?.token || '').trim());
      if (!claims) return res.status(403).json({ status: 'error', message: 'La liga del contrato no es válida o ya caducó.' });
      const result = await forwardTransientBusinessAction('contractAdminPdfData', { contractId: claims.contractId, version: 'final' }, 4);
      const pdf = Buffer.from(cleanBase64(result.pdfBase64 || ''), 'base64');
      if (!pdf.length || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('El contrato final no contiene un PDF válido.');
      const filename = `Contrato-firmado-${String(result.folio || claims.contractId || 'xph').replace(/[^a-z0-9-]/gi, '_')}.pdf`;
      setPrivatePdfHeaders(res, filename, 'attachment');
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      return res.status(200).send(pdf);
    }

""" + admin_pdf_marker
proxy = replace_once(proxy, admin_pdf_marker, public_final_pdf, "action === 'contractFinalPdf'", 'public final PDF route')

proxy_path.write_text(proxy)


# ---------------------------------------------------------------------------
# Frontend API + feedback to admin.
# ---------------------------------------------------------------------------
api_path = Path('src/utils/adminApi.ts')
api = api_path.read_text()
old_api_finalize = """export async function finalizeBusinessContract(contractId: string): Promise<BusinessContract> {
  const data = await adminBusinessRequest<{ contract: BusinessContract }>('adminContractFinalize', { contractId });
  return data.contract;
}
"""
new_api_finalize = """export type FinalContractEmailDelivery = {
  sent: boolean;
  mode?: 'ADJUNTO_PDF' | 'LINK_SEGURO_PDF' | 'NO_ENVIADO' | string;
  expiresAt?: string;
  error?: string;
};

export async function finalizeBusinessContract(contractId: string): Promise<{ contract: BusinessContract; emailDelivery: FinalContractEmailDelivery }> {
  const data = await adminBusinessRequest<{ contract: BusinessContract; emailDelivery?: FinalContractEmailDelivery }>('adminContractFinalize', { contractId });
  return { contract: data.contract, emailDelivery: data.emailDelivery || { sent: false, mode: 'NO_ENVIADO', error: 'El servidor no confirmó el envío del correo.' } };
}

export async function resendFinalBusinessContract(contractId: string): Promise<FinalContractEmailDelivery> {
  const data = await adminBusinessRequest<{ emailDelivery?: FinalContractEmailDelivery }>('adminContractEmailFinal', { contractId });
  return data.emailDelivery || { sent: false, mode: 'NO_ENVIADO', error: 'El servidor no confirmó el reenvío.' };
}
"""
api = replace_once(api, old_api_finalize, new_api_finalize, 'resendFinalBusinessContract', 'admin API contract email return type')
api_path.write_text(api)

panel_path = Path('src/components/BusinessAdminPanel.tsx')
panel = panel_path.read_text()
panel = replace_once(
    panel,
    "  finalizeBusinessContract,\n",
    "  finalizeBusinessContract,\n  resendFinalBusinessContract,\n",
    "  resendFinalBusinessContract,",
    'BusinessAdminPanel import',
)
old_ui_finalize = """  const finalize = async (contract: BusinessContract) => {
    setBusy(true);
    try {
      const saved = await finalizeBusinessContract(contract.id);
      setSnapshot((prev) => ({ ...prev, contracts: prev.contracts.map((item) => item.id === saved.id ? saved : item) }));
      setModalNotice('Contrato autorizado y finalizado con tu firma.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo finalizar el contrato.'); }
    finally { setBusy(false); }
  };
"""
new_ui_finalize = """  const finalize = async (contract: BusinessContract) => {
    setBusy(true);
    try {
      const result = await finalizeBusinessContract(contract.id);
      const saved = result.contract;
      setSnapshot((prev) => ({ ...prev, contracts: prev.contracts.map((item) => item.id === saved.id ? saved : item) }));
      if (result.emailDelivery?.sent) {
        setModalNotice(result.emailDelivery.mode === 'ADJUNTO_PDF'
          ? 'Contrato autorizado y finalizado. El PDF firmado fue enviado automáticamente al correo de la clienta.'
          : 'Contrato autorizado y finalizado. Se envió automáticamente a la clienta un correo con acceso seguro al PDF firmado.');
      } else {
        setModalNotice(`Contrato autorizado y finalizado, pero el correo no pudo enviarse automáticamente: ${result.emailDelivery?.error || 'revisa la configuración de Gmail.'}`);
      }
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo finalizar el contrato.'); }
    finally { setBusy(false); }
  };

  const resendFinalContract = async (contract: BusinessContract) => {
    setBusy(true);
    try {
      const delivery = await resendFinalBusinessContract(contract.id);
      setModalNotice(delivery.sent ? 'Correo del contrato final reenviado correctamente a la clienta.' : `No se pudo reenviar el correo: ${delivery.error || 'revisa Gmail.'}`);
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo reenviar el contrato por correo.'); }
    finally { setBusy(false); }
  };
"""
panel = replace_once(panel, old_ui_finalize, new_ui_finalize, 'const resendFinalContract = async', 'BusinessAdminPanel finalize feedback')

# Add resend button next to any existing final PDF download button when possible.
button_anchor = """<button onClick={() => downloadContractPdf(contract)} disabled={busy} className="rounded-lg border border-white/10 px-3 py-2 text-xs"><Download className="mr-1 inline h-3.5 w-3.5" />PDF</button>"""
if 'Reenviar PDF por correo' not in panel and button_anchor in panel:
    panel = panel.replace(button_anchor, button_anchor + "{contract.status === 'Finalizado' && <button onClick={() => resendFinalContract(contract)} disabled={busy} className=\"rounded-lg border border-[#D4AF37]/30 px-3 py-2 text-xs text-[#F5D76E]\"><Mail className=\"mr-1 inline h-3.5 w-3.5\" />Reenviar PDF por correo</button>}", 1)

panel_path.write_text(panel)


# ---------------------------------------------------------------------------
# Apps Script source: exact PDF attachment when the live GAS deployment is
# republished. Vercel keeps a secure-link fallback until then.
# ---------------------------------------------------------------------------
gas_path = Path('google-apps-script.js')
gas = gas_path.read_text()
old_send = """    var options = { htmlBody: wrapXphEmail(body, config, Boolean(inlineImages.xphLogo)), name: config.senderName || 'XPH Fotografía & Video' };
    if (config.replyTo) options.replyTo = config.replyTo;
    if (inlineImages.xphLogo) options.inlineImages = inlineImages;
    GmailApp.sendEmail(recipient, subject, emailPlainText(body), options);
"""
new_send = """    var options = { htmlBody: wrapXphEmail(body, config, Boolean(inlineImages.xphLogo)), name: config.senderName || 'XPH Fotografía & Video' };
    if (config.replyTo) options.replyTo = config.replyTo;
    if (inlineImages.xphLogo) options.inlineImages = inlineImages;
    if (Array.isArray(input.attachments) && input.attachments.length) {
      var attachmentBlobs = input.attachments.slice(0, 5).map(function(attachment) {
        if (!attachment || !attachment.base64) return null;
        return base64Blob(attachment.base64, attachment.mimeType || 'application/pdf', cleanBusinessText(attachment.name || 'archivo.pdf', 220));
      }).filter(function(blob) { return Boolean(blob); });
      if (attachmentBlobs.length) options.attachments = attachmentBlobs;
    }
    GmailApp.sendEmail(recipient, subject, emailPlainText(body), options);
"""
gas = replace_once(gas, old_send, new_send, 'attachmentBlobs = input.attachments', 'Apps Script Gmail attachments')

old_gas_return = """    upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, finalContract);
    logAudit(ss, 'CONTRATO_FINALIZADO', finalContract.folio + ' | hash ' + finalContract.finalDocumentHash, finalContract.id, 'Javier Garcia');
    return { status: 'success', contract: publicContractRecord(finalContract) };
"""
new_gas_return = """    upsertBusinessRecord(ss, 'Contratos', BUSINESS_HEADERS.contracts, finalContract);
    logAudit(ss, 'CONTRATO_FINALIZADO', finalContract.folio + ' | hash ' + finalContract.finalDocumentHash, finalContract.id, 'Javier Garcia');

    var finalEmailDelivery = { sent: false, mode: 'ADJUNTO_PDF', error: '' };
    var finalClient = findBusinessRecord(ss, 'CRM_Clientes', BUSINESS_HEADERS.clients, finalContract.clientId);
    if (finalClient && finalClient.email) {
      try {
        var finalTemplateId = 'contrato-firmado-final-auto';
        upsertBusinessRecord(ss, 'Plantillas_Email', BUSINESS_HEADERS.emailTemplates, {
          id: finalTemplateId,
          name: 'Contrato firmado final',
          subject: 'Tu contrato firmado XPH · {{evento_tipo}}',
          htmlBody: '<p>Hola {{cliente_nombre}},</p><p>Tu contrato con <strong>XPH Producción Audiovisual &amp; Makeup</strong> ya fue firmado y autorizado por ambas partes.</p><p>Adjuntamos a este correo tu copia final en formato PDF.</p><p><strong>Folio:</strong> {{contrato_folio}}</p><p>Conserva este documento como tu copia del contrato final.</p>',
          status: 'ACTIVA',
          updatedAt: businessNow()
        });
        clearBusinessRecordCache('Plantillas_Email');
        var finalEmailHistory = sendCrmTemplateEmail(ss, {
          recipient: finalClient.email,
          clientId: finalClient.id,
          templateId: finalTemplateId,
          variables: clientEmailVariables(finalClient, { contrato_folio: finalContract.folio || finalContract.id }),
          mode: 'AUTOMATICO',
          userId: 'xph-system',
          historyId: 'correo-contrato-final-' + finalContract.id + '-' + finalContract.finalDocumentHash,
          attachments: [{ name: finalName, mimeType: 'application/pdf', base64: payload.finalizedPdfBase64 }]
        });
        finalEmailDelivery = { sent: true, mode: 'ADJUNTO_PDF', emailHistory: finalEmailHistory };
      } catch (finalEmailError) {
        finalEmailDelivery.error = cleanBusinessText(finalEmailError && finalEmailError.message || finalEmailError, 1000);
        upsertCrmNotification(ss, {
          type: 'ERROR_GMAIL',
          title: 'No se envió el contrato firmado',
          message: (finalClient.name || 'Cliente') + ' · ' + finalEmailDelivery.error,
          relatedId: finalContract.id,
          dedupeKey: 'error-gmail-contrato-final-' + finalContract.id + '-' + finalContract.finalDocumentHash
        });
      }
    } else {
      finalEmailDelivery.error = 'El cliente no tiene un correo electrónico válido registrado.';
    }
    return { status: 'success', contract: publicContractRecord(finalContract), emailDelivery: finalEmailDelivery };
"""
gas = replace_once(gas, old_gas_return, new_gas_return, 'var finalEmailDelivery =', 'Apps Script automatic final contract email')
gas_path.write_text(gas)

print('Contract final email patch applied.')
