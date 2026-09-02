from pathlib import Path

path = Path('src/components/BusinessAdminPanel.tsx')
text = path.read_text(encoding='utf-8')

old = "{contract.documentSnapshot ? <button onClick={() => previewContractDocument(contract)} disabled={busy} className=\"inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs\"><Eye className=\"h-4 w-4\" />Revisar documento</button> : <a href={adminContractPdfUrl(contract.id, 'latest', contractPdfRevision(contract))} target=\"_blank\" rel=\"noreferrer\" className=\"inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs\"><Eye className=\"h-4 w-4\" />{contractViewLabel(contract)}</a>}"
new = "{contract.documentSnapshot && !['Firmado por cliente', 'Finalizado'].includes(contract.status) ? <button onClick={() => previewContractDocument(contract)} disabled={busy} className=\"inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs\"><Eye className=\"h-4 w-4\" />Revisar documento</button> : <a href={adminContractPdfUrl(contract.id, 'latest', contractPdfRevision(contract))} target=\"_blank\" rel=\"noreferrer\" className=\"inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs\"><Eye className=\"h-4 w-4\" />{contractViewLabel(contract)}</a>}"

if old not in text:
    if new in text:
        print('La navegación de revisión firmada ya estaba aplicada.')
        raise SystemExit(0)
    raise SystemExit('No se encontró el selector de revisión de contratos esperado.')

text = text.replace(old, new, 1)

if "contract.documentSnapshot && !['Firmado por cliente', 'Finalizado'].includes(contract.status)" not in text:
    raise SystemExit('No quedó aplicada la regla de PDF después de firma.')
if "adminContractPdfUrl(contract.id, 'latest', contractPdfRevision(contract))" not in text:
    raise SystemExit('No quedó disponible la ruta al PDF firmado/final.')

path.write_text(text, encoding='utf-8')
print('Contratos firmados/finalizados abrirán el PDF con evidencia de firmas.')
