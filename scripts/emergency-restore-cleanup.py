from pathlib import Path

path = Path('api/proxy.js')
text = path.read_text(encoding='utf-8')

text = text.replace("import { createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';\nimport { gunzipSync } from 'node:zlib';", "import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';", 1)

constant_start = "const EMERGENCY_RESTORE_KEY_SHA256 = "
constant_end = "const EMERGENCY_RESTORE_BRANCH = '0c986407c65dc048b08c61a78e0cbea48bbb6b8f';\n"
if constant_start in text:
    start = text.index(constant_start)
    end = text.index(constant_end, start) + len(constant_end)
    text = text[:start] + text[end:]

helper_start = "async function emergencyRestoreCompactConfig(keyHex) {"
handler_marker = "export default async function handler(req, res) {"
if helper_start in text:
    start = text.index(helper_start)
    end = text.index(handler_marker, start)
    text = text[:start] + text[end:]

route_start = "    if (req.method === 'GET' && action === 'emergencyRestoreCompactConfig') {"
route_end_marker = "    if (req.method === 'GET' && action === 'adminSession') {"
if route_start in text:
    start = text.index(route_start)
    end = text.index(route_end_marker, start)
    text = text[:start] + text[end:]

if 'emergencyRestoreCompactConfig' in text or 'EMERGENCY_RESTORE_' in text or 'gunzipSync' in text or 'createDecipheriv' in text:
    raise SystemExit('Temporary restore code was not fully removed.')

path.write_text(text, encoding='utf-8')
print('Temporary restore endpoint removed.')
