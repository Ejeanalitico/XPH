import { listPublicDriveFolderPage } from './_drive-public.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  // Solo disponible en previews de Vercel y solo para esta carpeta de prueba.
  if (process.env.VERCEL_ENV !== 'preview' || req.method !== 'GET') return res.status(404).json({status:'not-found'});
  try {
    const page=await listPublicDriveFolderPage({
      folderId:'1ZLda1eMixKiIe2rN0r60-OaPU0NRKVYt',
      pageSize:150, apiKey:process.env.VITE_GOOGLE_DRIVE_API_KEY || '',
    });
    return res.status(200).json({status:'ok',filesInFirstPage:page.files.length,scanned:page.scanned,hasNextPage:Boolean(page.nextPageToken)});
  } catch(e) {
    return res.status(200).json({status:'unavailable',cause:String(e.message||e).replace(/[?&]key=[^& ]+/g,'[redacted]')});
  }
}