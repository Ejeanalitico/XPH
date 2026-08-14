const LOGO_FILE_ID = '1n-I-KcfYTHYzJZrND4rFHz4rCgLGekJq';

const LOGO_SOURCES = [
  `https://lh3.googleusercontent.com/d/${LOGO_FILE_ID}=s1024`,
  `https://drive.usercontent.google.com/download?id=${LOGO_FILE_ID}&export=download&confirm=t`,
  `https://drive.google.com/uc?export=view&id=${LOGO_FILE_ID}`,
  `https://drive.google.com/uc?export=download&id=${LOGO_FILE_ID}`,
];

async function fetchLogo() {
  const attempts = [];

  for (const url of LOGO_SOURCES) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 XPH-Logo-Proxy/2.0',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      const contentType = response.headers.get('content-type') || '';
      attempts.push({ url, status: response.status, contentType });

      if (!response.ok || !contentType.startsWith('image/')) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) continue;

      return { buffer, contentType, source: url };
    } catch (error) {
      attempts.push({ url, error: error instanceof Error ? error.message : String(error) });
    }
  }

  console.error('[XPH Logo Proxy] No valid image source', attempts);
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const logo = await fetchLogo();

    if (!logo) {
      return res.status(502).end('No se pudo cargar el logo desde Google Drive.');
    }

    res.setHeader('Content-Type', logo.contentType);
    res.setHeader('Content-Length', String(logo.buffer.length));
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XPH-Logo-Source', 'google-drive');

    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(logo.buffer);
  } catch (error) {
    console.error('[XPH Logo Proxy]', error);
    return res.status(500).end('Error al servir el logo.');
  }
}
