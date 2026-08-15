import packagesJson from '../src/data/packages.json' with { type: 'json' };

function withAdminFlag(packages) {
  return Object.fromEntries(
    Object.entries(packages).map(([category, items]) => [
      category,
      items.map((item) => ({ ...item, managedByAdmin: true })),
    ])
  );
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Método no permitido.' });
  }

  const packages = withAdminFlag(packagesJson);
  const count = Object.values(packages).reduce((sum, list) => sum + list.length, 0);

  return res.status(200).json({
    status: 'success',
    packages,
    count,
    source: 'src/data/packages.json',
  });
}
