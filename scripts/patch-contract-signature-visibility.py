from pathlib import Path

component_path = Path('src/components/ContractDocument.tsx')
proxy_path = Path('api/proxy.js')

component = component_path.read_text(encoding='utf-8')
proxy = proxy_path.read_text(encoding='utf-8')

old_signature_block = '<Signature label="EL CLIENTE" name={snapshot.client.name} /><Signature label="XAVI.PH" name="EL PRESTADOR DEL SERVICIO" />'
new_signature_block = '<Signature label="EL CLIENTE" /><Signature label="EL PRESTADOR DEL SERVICIO" />'
if old_signature_block not in component:
    raise SystemExit('No se encontró el bloque de firmas previo en ContractDocument.tsx')
component = component.replace(old_signature_block, new_signature_block, 1)

old_signature_component = 'const Signature = ({ label, name }: { label: string; name: string }) => <div className="border-t border-black pt-2"><strong className="text-[10px]">{label}</strong><p className="mt-1 text-[10px]">{name}</p></div>;'
new_signature_component = 'const Signature = ({ label }: { label: string }) => <div className="border-t border-black pt-2"><strong className="text-[10px]">{label}</strong><div className="mt-1 h-4" aria-hidden="true" /></div>;'
if old_signature_component not in component:
    raise SystemExit('No se encontró el componente Signature previo')
component = component.replace(old_signature_component, new_signature_component, 1)

helper_marker = 'async function appendClientSignature(pdfBase64, signatureDataUrl, contract, audit) {'
if helper_marker not in proxy:
    raise SystemExit('No se encontró appendClientSignature')
if 'function formatContractDateTime(value)' not in proxy:
    helper = """function formatContractDateTime(value) {\n  const parsed = new Date(String(value || ''));\n  if (Number.isNaN(parsed.getTime())) return String(value || '');\n  return new Intl.DateTimeFormat('es-MX', {\n    timeZone: 'America/Mexico_City',\n    day: '2-digit',\n    month: '2-digit',\n    year: 'numeric',\n    hour: '2-digit',\n    minute: '2-digit',\n    second: '2-digit',\n    hour12: true,\n  }).format(parsed);\n}\n\n"""
    proxy = proxy.replace(helper_marker, helper + helper_marker, 1)

old_accepted = "page.drawText(`Aceptado: ${audit.acceptedAt}`, { x: 54, y: 566, size: 8, font, color: rgb(0.3, 0.32, 0.36) });"
new_accepted = "page.drawText(`Fecha y hora de firma: ${formatContractDateTime(audit.acceptedAt)}`, { x: 54, y: 566, size: 8, font, color: rgb(0.3, 0.32, 0.36) });"
if old_accepted not in proxy:
    raise SystemExit('No se encontró la etiqueta Aceptado del PDF firmado')
proxy = proxy.replace(old_accepted, new_accepted, 1)

old_owner = "page.drawText(`Autorizado: ${authorizedAt}`, { x: 54, y: 274, size: 7, font, color: rgb(0.35, 0.37, 0.42) });"
new_owner = "page.drawText(`Fecha y hora de autorización: ${formatContractDateTime(authorizedAt)}`, { x: 54, y: 274, size: 7, font, color: rgb(0.35, 0.37, 0.42) });"
if old_owner not in proxy:
    raise SystemExit('No se encontró la etiqueta de autorización del prestador')
proxy = proxy.replace(old_owner, new_owner, 1)

# Invariantes: la revisión no muestra identidad en el área de firmas y el PDF firmado conserva
# firma manuscrita, IP, sello temporal y aplicación posterior de la firma del prestador.
if 'Signature label="EL CLIENTE" name={snapshot.client.name}' in component:
    raise SystemExit('El nombre del cliente sigue apareciendo en la línea de firma previa')
required_proxy_markers = [
    'page.drawImage(signature, { x: 338, y: 335',
    "page.drawText(`IP: ${audit.ip || 'No disponible'}`",
    'Fecha y hora de firma:',
    'async function applyOwnerSignature',
    'Fecha y hora de autorización:',
    "action === 'adminContractFinalize'",
]
for marker in required_proxy_markers:
    if marker not in proxy:
        raise SystemExit('Falta invariante de firma: ' + marker)

component_path.write_text(component, encoding='utf-8')
proxy_path.write_text(proxy, encoding='utf-8')
print('Contrato: visibilidad previa y sellos de firma actualizados.')
