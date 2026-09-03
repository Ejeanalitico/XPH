from pathlib import Path

proxy_path = Path('api/proxy.js')
admin_path = Path('src/components/BusinessAdminPanel.tsx')

proxy = proxy_path.read_text(encoding='utf-8')
admin = admin_path.read_text(encoding='utf-8')

old_retry = "if (!/respuesta no válida|fetch failed|bad gateway|temporarily unavailable/i.test(message) || attempt >= attempts) throw error;"
new_retry = "if (!/respuesta no válida|solicitud no autorizada|unauthorized|fetch failed|bad gateway|temporarily unavailable|service unavailable|internal server error/i.test(message) || attempt >= attempts) throw error;"
if old_retry not in proxy:
    raise SystemExit('Transient retry pattern not found')
proxy = proxy.replace(old_retry, new_retry, 1)

old_snapshot = "const result = await forwardTransientBusinessAction('businessSnapshot');"
new_snapshot = "const result = await forwardTransientBusinessAction('businessSnapshot', {}, 5);"
if old_snapshot not in proxy:
    raise SystemExit('businessSnapshot call not found')
proxy = proxy.replace(old_snapshot, new_snapshot, 1)

old_pdf = """      const result = await forwardBusinessAction('contractAdminPdfData', { contractId, version });
      const pdf = Buffer.from(cleanBase64(result.pdfBase64), 'base64');
      if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('El contrato privado no contiene un PDF válido.');
      const filename = `contrato-${String(result.folio || 'xph').replace(/[^a-z0-9-]/gi, '_')}.pdf`;
      const disposition = String(req.query?.download || '') === '1' ? 'attachment' : 'inline';
      setPrivatePdfHeaders(res, filename, disposition);
      return res.status(200).send(pdf);"""
new_pdf = """      let result = null;
      let contractMeta = null;
      let pdfBase64 = '';
      try {
        result = await forwardTransientBusinessAction('contractAdminPdfData', { contractId, version }, 4);
        pdfBase64 = String(result?.pdfBase64 || '');
      } catch (error) {
        const message = String(error?.message || error);
        if (!/versión solicitada.*no está disponible|version solicitada.*no esta disponible|respuesta no válida|solicitud no autorizada|bad gateway|temporarily unavailable/i.test(message)) throw error;
        const documentResult = await forwardTransientBusinessAction('contractDocument', { contractId }, 5);
        contractMeta = documentResult?.contract || null;
        if (!contractMeta?.documentSnapshot) throw error;
        pdfBase64 = await renderContractSnapshotPdf(contractMeta.documentSnapshot, contractMeta);
        result = { folio: contractMeta.folio || contractMeta.id, documentType: contractMeta.documentType || '' };
      }
      const pdf = Buffer.from(cleanBase64(pdfBase64), 'base64');
      if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('El documento privado no contiene un PDF válido.');
      const kind = String(result?.documentType || contractMeta?.documentType || '').toUpperCase() === 'COTIZACION' ? 'cotizacion' : 'contrato';
      const filename = `${kind}-${String(result?.folio || contractMeta?.folio || 'xph').replace(/[^a-z0-9-]/gi, '_')}.pdf`;
      const disposition = String(req.query?.download || '') === '1' ? 'attachment' : 'inline';
      setPrivatePdfHeaders(res, filename, disposition);
      return res.status(200).send(pdf);"""
if old_pdf not in proxy:
    raise SystemExit('adminContractPdf block not found')
proxy = proxy.replace(old_pdf, new_pdf, 1)

anchor = """  const previewContractDocument = async (contract: BusinessContract) => {
    setBusy(true);
    try { setContractPreview(await loadAdminContractDocument(contract.id)); }
    catch (error: any) { setModalNotice(error?.message || 'No se pudo abrir el documento.'); }
    finally { setBusy(false); }
  };
"""
insert = anchor + """
  const downloadContractPdf = async (contract: BusinessContract) => {
    setBusy(true);
    try {
      const response = await fetch(`${adminContractPdfUrl(contract.id, 'latest', contractPdfRevision(contract))}&download=1`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/pdf' },
      });
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok || !contentType.includes('application/pdf')) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || `No se pudo descargar el PDF (${response.status}).`);
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error('El PDF llegó vacío.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const prefix = contract.documentType === 'COTIZACION' ? 'cotizacion' : 'contrato';
      const folio = String(contract.folio || contract.id || 'xph').replace(/[^a-z0-9-]+/gi, '_');
      link.href = url;
      link.download = `${prefix}-${folio}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error: any) {
      setModalNotice(error?.message || 'No se pudo descargar el PDF.');
    } finally {
      setBusy(false);
    }
  };
"""
if anchor not in admin:
    raise SystemExit('previewContractDocument anchor not found')
admin = admin.replace(anchor, insert, 1)

old_link = """<a href={`${adminContractPdfUrl(contract.id, 'latest', contractPdfRevision(contract))}&download=1`} download className=\"inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/5 px-3 py-2 text-xs font-semibold text-[#F5D76E] hover:bg-[#D4AF37]/10\"><Download className=\"h-4 w-4\" />Descargar PDF</a>"""
new_link = """<button type=\"button\" onClick={() => downloadContractPdf(contract)} disabled={busy} className=\"inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/5 px-3 py-2 text-xs font-semibold text-[#F5D76E] hover:bg-[#D4AF37]/10 disabled:opacity-40\"><Download className=\"h-4 w-4\" />Descargar PDF</button>"""
if old_link not in admin:
    raise SystemExit('Download anchor not found')
admin = admin.replace(old_link, new_link, 1)

proxy_path.write_text(proxy, encoding='utf-8')
admin_path.write_text(admin, encoding='utf-8')
print('Applied quote PDF + snapshot reliability fixes')
