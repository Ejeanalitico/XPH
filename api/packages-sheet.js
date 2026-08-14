const SPREADSHEET_ID = '1GavJQKZnn_qtOdc5aaMtqvJg951CccgH1LxuWKhTLAg';
const PACKAGES_SHEET_GID = '953674927';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function categoryKey(label) {
  const value = normalizeText(label);
  if (value.includes('BODA')) return 'bodas';
  if (value.includes('QUINCE') || value.includes('XV')) return 'xv-anos';
  if (value.includes('BAUTIZ')) return 'bautizos';
  if (value.includes('RETRAT')) return 'retratos';
  if (value.includes('EMPRESARIAL') || value.includes('BRANDING')) return 'empresarial';
  return '';
}

function toPrice(value) {
  const cleaned = String(value || '').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitLines(value, markerPattern) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.replace(markerPattern, '').trim())
    .filter(Boolean);
}

function packagesFromRows(rows) {
  const packages = {
    bodas: [],
    'xv-anos': [],
    bautizos: [],
    retratos: [],
    empresarial: [],
  };

  rows.slice(1).forEach((row) => {
    const category = categoryKey(row[0]);
    const id = String(row[1] || '').trim();
    const name = String(row[2] || '').trim();
    if (!category || !id || !name) return;

    const badge = String(row[5] || '').trim();
    const badgeNorm = normalizeText(badge);

    packages[category].push({
      id,
      name,
      price: toPrice(row[3]),
      badge: badge || undefined,
      description: String(row[6] || '').trim(),
      features: splitLines(row[7], /^[\s•·*-]+/),
      notIncludes: splitLines(row[8], /^[\s✕xX×•·*-]+/),
      popular: badgeNorm.includes('MAS VENDIDO') || badgeNorm.includes('PAQUETE PROFESIONAL'),
      managedByAdmin: true,
    });
  });

  return packages;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Método no permitido.' });
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${PACKAGES_SHEET_GID}&_t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.1' },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Google Sheets respondió ${response.status}.`);
    }

    const text = await response.text();
    if (!text || /<html/i.test(text.slice(0, 300))) {
      throw new Error('La hoja no está disponible como CSV público.');
    }

    const rows = parseCsv(text);
    const packages = packagesFromRows(rows);
    const count = Object.values(packages).reduce((sum, list) => sum + list.length, 0);

    if (!count) {
      throw new Error('No se encontraron paquetes válidos en Paquetes_Precios.');
    }

    return res.status(200).json({
      status: 'success',
      packages,
      count,
      source: 'Paquetes_Precios',
    });
  } catch (error) {
    console.error('[XPH Packages Sheet] Error:', error);
    return res.status(502).json({
      status: 'error',
      message: error?.message || 'No se pudo leer Paquetes_Precios.',
    });
  }
}
