from pathlib import Path

path = Path('api/proxy.js')
text = path.read_text(encoding='utf-8')
pinned_payload = "const EMERGENCY_RESTORE_BRANCH = '0c986407c65dc048b08c61a78e0cbea48bbb6b8f';"
if 'emergencyRestoreCompactConfig' in text:
    old_branch = "const EMERGENCY_RESTORE_BRANCH = 'quota-restore-payload-20260907';"
    if old_branch in text:
        text = text.replace(old_branch, pinned_payload, 1)
        path.write_text(text, encoding='utf-8')
        print('Restore endpoint payload pinned to immutable commit.')
    else:
        print('Restore endpoint already installed and payload already pinned.')
    raise SystemExit(0)

old_import = "import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';"
new_import = "import { createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';\nimport { gunzipSync } from 'node:zlib';"
if old_import not in text:
    raise SystemExit('crypto import marker not found')
text = text.replace(old_import, new_import, 1)

constant_marker = "const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.XPH_WHATSAPP_BUSINESS_ACCOUNT_ID || '899134319903049';"
constants = """
const EMERGENCY_RESTORE_KEY_SHA256 = 'ddabc24f609891b0e202bb1ba9bd7a91d6814a9bd92adf73a0d6372fc9f226d6';
const EMERGENCY_RESTORE_NONCE = 'tWItPnxwn-8cKFMk';
const EMERGENCY_RESTORE_TAG = '4pzpJfFZyw15HlRSUTWBWg';
const EMERGENCY_RESTORE_PARTS = 8;
const EMERGENCY_RESTORE_BRANCH = '0c986407c65dc048b08c61a78e0cbea48bbb6b8f';
""".strip()
if constant_marker not in text:
    raise SystemExit('constant marker not found')
text = text.replace(constant_marker, constant_marker + '\n' + constants, 1)

handler_marker = 'export default async function handler(req, res) {'
helper = r'''
async function emergencyRestoreCompactConfig(keyHex) {
  const submittedKey = String(keyHex || '');
  if (!/^[0-9a-f]{64}$/i.test(submittedKey)) throw new Error('Clave de mantenimiento no válida.');
  const key = Buffer.from(submittedKey, 'hex');
  const actualHash = createHash('sha256').update(key).digest('hex');
  const expected = Buffer.from(EMERGENCY_RESTORE_KEY_SHA256, 'hex');
  const actual = Buffer.from(actualHash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Clave de mantenimiento no válida.');

  const urls = Array.from({ length: EMERGENCY_RESTORE_PARTS }, (_, index) =>
    `https://raw.githubusercontent.com/Ejeanalitico/XPH/${EMERGENCY_RESTORE_BRANCH}/ops/quota-restore-payload/part${String(index + 1).padStart(2, '0')}.txt`
  );
  const parts = await Promise.all(urls.map(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo leer un fragmento cifrado (${response.status}).`);
    return (await response.text()).trim();
  }));

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(EMERGENCY_RESTORE_NONCE, 'base64url'));
  decipher.setAuthTag(Buffer.from(EMERGENCY_RESTORE_TAG, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parts.join(''), 'base64url')),
    decipher.final(),
  ]);
  const jsonText = gunzipSync(decrypted).toString('utf8');
  const config = JSON.parse(jsonText);
  const galleryCount = Array.isArray(config.galleryImages) ? config.galleryImages.length : 0;
  const packageCount = config.packages && typeof config.packages === 'object' ? Object.keys(config.packages).length : 0;
  const quoteCount = Array.isArray(config.quotes) ? config.quotes.length : 0;
  const bytes = Buffer.byteLength(JSON.stringify(config), 'utf8');
  if (galleryCount !== 913 || packageCount !== 6 || quoteCount !== 8 || bytes > 200000) {
    throw new Error('La configuración recuperada no pasó la validación de integridad.');
  }

  await forwardSaveConfig(config, 'MANTENIMIENTO_STORAGE_CONFIG', 'Restauración compacta del respaldo previo al error de cuota.');
  const live = normalizeConfig(await fetchConfigFromScript());
  return {
    status: 'success',
    restored: true,
    bytes,
    galleryCount: Array.isArray(live.galleryImages) ? live.galleryImages.length : 0,
    packageCount: live.packages && typeof live.packages === 'object' ? Object.keys(live.packages).length : 0,
    quoteCount: Array.isArray(live.quotes) ? live.quotes.length : 0,
    catalogVersion: live.catalogVersion ?? null,
  };
}

'''
if handler_marker not in text:
    raise SystemExit('handler marker not found')
text = text.replace(handler_marker, helper + handler_marker, 1)

route_marker = "    const action = requestedAction;\n\n    if (req.method === 'GET' && action === 'adminSession') {"
route = """    const action = requestedAction;\n\n    if (req.method === 'GET' && action === 'emergencyRestoreCompactConfig') {\n      try {\n        const result = await emergencyRestoreCompactConfig(String(req.query?.key || ''));\n        return res.status(200).json(result);\n      } catch (error) {\n        return res.status(500).json({ status: 'error', message: String(error?.message || error) });\n      }\n    }\n\n    if (req.method === 'GET' && action === 'adminSession') {"""
if route_marker not in text:
    raise SystemExit('route marker not found')
text = text.replace(route_marker, route, 1)

path.write_text(text, encoding='utf-8')
print('Temporary encrypted restore endpoint installed.')
