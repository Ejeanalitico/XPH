const LOGO_FILE_ID = '1n-I-KcfYTHYzJZrND4rFHz4rCgLGekJq';
const DRIVE_LOGO_URL = `https://drive.google.com/uc?export=download&id=${LOGO_FILE_ID}`;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const response = await fetch(DRIVE_LOGO_URL, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 XPH-Logo-Proxy/1.0',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return res.status(502).end('No se pudo cargar el logo desde Google Drive.');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return res.status(502).end('Google Drive no devolvió una imagen válida.');
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('[XPH Logo Proxy]', error);
    return res.status(500).end('Error al servir el logo.');
  }
}
