from pathlib import Path

path = Path('api/proxy.js')
text = path.read_text(encoding='utf-8')

old = """  const templateVersion = String(contract?.templateVersion || contract?.documentSnapshot?.templateVersion || '');\n\n  if (templateVersion.includes('canonical-v3')) {"""
new = """  const templateVersion = String(contract?.templateVersion || contract?.documentSnapshot?.templateVersion || '');\n  const generatedContract = Boolean(contract?.documentSnapshot) && String(contract?.documentType || contract?.documentSnapshot?.documentType || 'CONTRATO') === 'CONTRATO';\n\n  if (generatedContract || templateVersion.includes('canonical-v3')) {"""
if old not in text:
    raise SystemExit('Missing generated contract signature condition')
text = text.replace(old, new, 1)

old = """  if (snapshot.documentType === 'CONTRATO' && String(snapshot.templateVersion || '').includes('canonical-v3')) {\n    // La página de firmas forma parte del PDF original desde su creación."""
new = """  if (snapshot.documentType === 'CONTRATO') {\n    // Todo contrato generado por XPH incluye su página de firmas dentro del PDF original.\n    // Esto también unifica contratos generados antes de canonical-v3 que aún no han sido firmados."""
if old not in text:
    raise SystemExit('Missing canonical signature page condition')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Generated contract signature compatibility enabled.')
