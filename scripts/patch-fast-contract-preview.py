from pathlib import Path
import re

panel_path = Path('src/components/BusinessAdminPanel.tsx')
panel = panel_path.read_text(encoding='utf-8')

if "import { ContractDocument } from './ContractDocument';" not in panel:
    anchor = "import { calculateFinancialSummary, collectedForClient, collectedPaymentAmount, isOverduePayment, pendingPaymentAmount } from '../utils/financialRules.js';\n"
    if anchor not in panel:
        raise SystemExit('BusinessAdminPanel import anchor missing')
    panel = panel.replace(anchor, anchor + "import { ContractDocument } from './ContractDocument';\n", 1)

quote_anchor = '<a href={adminContractPdfUrl(selectedClientQuote.id, \'latest\', contractPdfRevision(selectedClientQuote))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white"><Eye className="h-4 w-4" />Ver cotización</a>'
quote_button = '<button type="button" onClick={() => setContractPreview(selectedClientQuote)} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white"><Eye className="h-4 w-4" />Ver cotización</button>'
panel = panel.replace(quote_anchor, quote_button)

contract_anchor = '<a href={adminContractPdfUrl(selectedClientContract.id, \'latest\', contractPdfRevision(selectedClientContract))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white"><Eye className="h-4 w-4" />Ver contrato</a>'
contract_button = '<button type="button" onClick={() => setContractPreview(selectedClientContract)} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white"><Eye className="h-4 w-4" />Ver contrato</button>'
panel = panel.replace(contract_anchor, contract_button)

pattern = re.compile(r'\{contractPreview\?\.documentSnapshot && <div className="fixed inset-0 z-\[110\].*?</div>\}\n      \{internalEventDraft', re.S)
replacement = '''{contractPreview?.documentSnapshot && <div className="fixed inset-0 z-[110] overflow-y-auto bg-[#05070b]/95 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label={`Vista previa ${contractPreview.folio}`}>
        <div className="mx-auto mb-4 flex max-w-[860px] items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#111722] p-3.5 text-white shadow-2xl">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#D4AF37]">Vista previa instantánea</p><p className="mt-0.5 font-semibold">{contractPreview.folio} · {contractPreview.documentType === 'COTIZACION' ? 'cotización' : 'contrato'}</p><p className="mt-1 text-[11px] text-gray-400">Mismo diseño XPH que verá el cliente. El PDF solo se genera cuando lo abres o descargas.</p></div>
          <div className="flex gap-2"><a href={adminContractPdfUrl(contractPreview.id, 'latest', contractPdfRevision(contractPreview))} target="_blank" rel="noreferrer" className="hidden rounded-xl border border-[#D4AF37]/30 px-3 py-2 text-xs font-semibold text-[#F5D76E] sm:inline-flex">Abrir PDF</a><button type="button" onClick={() => setContractPreview(null)} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm"><X className="h-4 w-4" />Cerrar</button></div>
        </div>
        <div className="mx-auto max-w-[794px] overflow-hidden rounded-sm bg-[#fffefb] shadow-[0_25px_80px_rgba(0,0,0,.55)]"><ContractDocument snapshot={contractPreview.documentSnapshot} folio={contractPreview.folio} /></div>
        <div className="mx-auto mt-4 flex max-w-[794px] justify-center sm:hidden"><a href={adminContractPdfUrl(contractPreview.id, 'latest', contractPdfRevision(contractPreview))} target="_blank" rel="noreferrer" className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-4 py-3 text-sm font-semibold text-[#F5D76E]">Abrir PDF exacto</a></div>
      </div>}
      {internalEventDraft'''
panel, count = pattern.subn(replacement, panel, count=1)
if count != 1:
    raise SystemExit(f'Preview modal replacement count={count}')
panel_path.write_text(panel, encoding='utf-8')

mobile_path = Path('src/components/MobileContractSigningPage.tsx')
mobile = mobile_path.read_text(encoding='utf-8')
if "import { ContractDocument } from './ContractDocument';" not in mobile:
    mobile = mobile.replace("import { SignaturePad } from './SignaturePad';\n", "import { SignaturePad } from './SignaturePad';\nimport { ContractDocument } from './ContractDocument';\n", 1)

old = '''          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white">
            <iframe title={`Contrato ${contract.folio}`} src={safeContractPdfUrl(token)} className="h-[72vh] w-full bg-white" />
          </section>
          <a href={safeContractPdfUrl(token)} target="_blank" rel="noreferrer" className="block rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-4 py-3 text-center text-sm font-semibold text-[#F5D76E]">Abrir el mismo PDF en pantalla completa</a>'''
new = '''          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#fffefb] shadow-2xl">
            {contract.documentSnapshot ? <ContractDocument snapshot={contract.documentSnapshot} folio={contract.folio} /> : <div className="grid min-h-[420px] place-items-center bg-white text-gray-500"><Loader2 className="h-7 w-7 animate-spin" /></div>}
          </section>
          <a href={safeContractPdfUrl(token)} target="_blank" rel="noreferrer" className="block rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-4 py-3 text-center text-sm font-semibold text-[#F5D76E]">Abrir o descargar PDF firmado</a>'''
if old not in mobile:
    raise SystemExit('Mobile iframe block missing')
mobile = mobile.replace(old, new, 1)
mobile_path.write_text(mobile, encoding='utf-8')

print('Fast contract previews restored with the original XPH design.')
