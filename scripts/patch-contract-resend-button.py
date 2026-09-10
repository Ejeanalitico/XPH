from pathlib import Path

path = Path('src/components/BusinessAdminPanel.tsx')
text = path.read_text()
if 'Reenviar PDF por correo' in text:
    print('Resend button already installed.')
    raise SystemExit(0)
old = """<button type=\"button\" onClick={() => downloadContractPdf(contract)} disabled={busy} className=\"inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/5 px-3 py-2 text-xs font-semibold text-[#F5D76E] hover:bg-[#D4AF37]/10 disabled:opacity-40\"><Download className=\"h-4 w-4\" />Descargar PDF</button><button onClick={() => createLink(contract)}"""
new = """<button type=\"button\" onClick={() => downloadContractPdf(contract)} disabled={busy} className=\"inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/5 px-3 py-2 text-xs font-semibold text-[#F5D76E] hover:bg-[#D4AF37]/10 disabled:opacity-40\"><Download className=\"h-4 w-4\" />Descargar PDF</button>{contract.status === 'Finalizado' && <button type=\"button\" onClick={() => resendFinalContract(contract)} disabled={busy} className=\"inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-40\"><Mail className=\"h-4 w-4\" />Reenviar PDF por correo</button>}<button onClick={() => createLink(contract)}"""
if old not in text:
    raise SystemExit('Contract action anchor not found')
path.write_text(text.replace(old, new, 1))
print('Finalized contract resend button installed.')
