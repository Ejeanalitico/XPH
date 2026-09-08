from pathlib import Path

path = Path('src/components/UnifiedAdminDashboard.tsx')
text = path.read_text(encoding='utf-8')

state_anchor = "  const [driveMediaType, setDriveMediaType] = useState<'image' | 'video'>('video');\n"
state_replacement = state_anchor + "  const [driveImportLoading, setDriveImportLoading] = useState(false);\n  const [driveImportStatus, setDriveImportStatus] = useState('Preparando importación...');\n"
if 'const [driveImportLoading' not in text:
    if state_anchor not in text:
        raise SystemExit('No se encontró el estado de Drive para insertar la pantalla de carga.')
    text = text.replace(state_anchor, state_replacement, 1)

start_marker = "  const registerPrivateDriveFile = async () => {\n"
end_marker = "  const removePrivateMedia = async (item: GalleryImage) => {\n"
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('No se encontró el manejador de importación desde Drive.')

new_handler = r'''  const registerPrivateDriveFile = async () => {
    if (!session || !selectedGallery) return;
    const folderId = extractDriveFolderId(driveMediaUrl);
    if (folderId) {
      setBusy(true);
      setDriveImportLoading(true);
      setDriveImportStatus('Conectando con Google Drive y leyendo la carpeta...');
      try {
        const files = await importPrivateDriveFolder(folderId);
        setDriveImportStatus(files.length
          ? `Se encontraron ${files.length} archivos. Preparando la galería...`
          : 'La carpeta se leyó correctamente. No se encontraron archivos compatibles.');
        const added: GalleryImage[] = files.map((file) => {
          const mediaType: 'image' | 'video' = file.mimeType.startsWith('video/') ? 'video' : 'image';
          const preview = mediaType === 'video' ? drivePreviewUrl(file.id) : `https://lh3.googleusercontent.com/d/${file.id}`;
          return { id: file.id, title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '), category: 'private', url: preview, location: selectedGallery.clientName, visibility: 'private', mediaType, galleryId: selectedGallery.galleryId, gallerySlug: selectedGallery.slug, galleryTitle: selectedGallery.title, galleryClient: selectedGallery.clientName, storageSource: 'drive-link', downloadUrl: driveDownloadUrl(file.id), previewUrl: preview, driveFolderId: folderId, createdAt: new Date().toISOString() };
        });
        const ids = new Set(added.map((item) => item.id));
        setDriveImportStatus(`Guardando ${added.length} archivos en “${selectedGallery.title}”...`);
        await persistGallery([...added, ...galleryImages.filter((item) => !ids.has(item.id))], 'ADMIN_GALERIA_PRIVADA', `${added.length} archivos importados desde carpeta de Drive a ${selectedGallery.title}`);
        setDriveImportStatus('Importación terminada. Actualizando la galería...');
        setDriveMediaUrl(''); setDriveMediaTitle(''); notify(`${added.length} archivos importados desde la carpeta de Drive.`);
      } catch (error: any) { notify(error?.message || 'No se pudo leer la carpeta. Verifica que pertenezca o esté compartida con la cuenta de XPH.'); }
      finally {
        setBusy(false);
        setDriveImportLoading(false);
        setDriveImportStatus('Preparando importación...');
      }
      return;
    }
    const fileId = extractDriveFileId(driveMediaUrl);
    if (!fileId) return notify('La liga no corresponde a un archivo ni a una carpeta válida de Google Drive.');
    setBusy(true);
    setDriveImportLoading(true);
    setDriveImportStatus('Importando el archivo desde Google Drive...');
    try {
      const preview = driveMediaType === 'video' ? drivePreviewUrl(fileId) : `https://lh3.googleusercontent.com/d/${fileId}`;
      const record: GalleryImage = { id: fileId, title: driveMediaTitle.trim() || (driveMediaType === 'video' ? 'Video del evento' : 'Fotografía'), category: 'private', url: preview, location: selectedGallery.clientName, visibility: 'private', mediaType: driveMediaType, galleryId: selectedGallery.galleryId, gallerySlug: selectedGallery.slug, galleryTitle: selectedGallery.title, galleryClient: selectedGallery.clientName, storageSource: 'drive-link', downloadUrl: driveDownloadUrl(fileId), previewUrl: preview, createdAt: new Date().toISOString() };
      setDriveImportStatus(`Guardando el archivo en “${selectedGallery.title}”...`);
      await persistGallery([record, ...galleryImages.filter((item) => item.id !== fileId)], 'ADMIN_GALERIA_PRIVADA', `Archivo de Drive agregado a ${selectedGallery.title}`);
      setDriveImportStatus('Importación terminada. Actualizando la galería...');
      setDriveMediaUrl(''); setDriveMediaTitle(''); notify('Archivo agregado a la galería privada.');
    } catch (error: any) { notify(error?.message || 'No se pudo registrar el archivo.'); }
    finally {
      setBusy(false);
      setDriveImportLoading(false);
      setDriveImportStatus('Preparando importación...');
    }
  };

'''
text = text[:start] + new_handler + text[end:]

main_anchor = '    <main className="min-h-screen bg-[#0B0F17] text-white py-8 px-4">\n'
overlay = r'''    <main className="min-h-screen bg-[#0B0F17] text-white py-8 px-4">
      {driveImportLoading && (
        <div className="fixed inset-0 z-[9999] bg-[#05070D]/95 backdrop-blur-sm flex items-center justify-center p-5" role="status" aria-live="polite" aria-busy="true">
          <div className="w-full max-w-sm rounded-3xl border border-[#D4AF37]/30 bg-[#111722] p-7 text-center shadow-2xl">
            <div className="mx-auto w-16 h-16 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
            </div>
            <p className="mt-5 text-[11px] uppercase tracking-[0.28em] text-[#D4AF37] font-mono">Google Drive</p>
            <h2 className="mt-2 text-2xl font-bold">Importando archivos</h2>
            <p className="mt-3 text-sm leading-6 text-gray-300">{driveImportStatus}</p>
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 rounded-full bg-[#D4AF37] animate-pulse" />
            </div>
            <p className="mt-4 text-xs leading-5 text-gray-500">Mantén esta pantalla abierta. Se cerrará automáticamente cuando termine la importación.</p>
          </div>
        </div>
      )}
'''
if 'Importando archivos</h2>' not in text:
    if main_anchor not in text:
        raise SystemExit('No se encontró el contenedor principal del administrador para insertar el overlay.')
    text = text.replace(main_anchor, overlay, 1)

path.write_text(text, encoding='utf-8')
print('Pantalla de carga de importación Drive instalada.')
