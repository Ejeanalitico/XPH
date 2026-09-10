from pathlib import Path

path = Path('src/components/ClientOperationsPanel.tsx')
text = path.read_text(encoding='utf-8')

old_import = "import { BellRing, CheckCircle2, ClipboardCheck, ClipboardCopy, FolderOpen, Images, PackagePlus, Plus, Save, Sparkles, Upload, UserPlus } from 'lucide-react';"
new_import = "import { BellRing, CheckCircle2, ClipboardCheck, ClipboardCopy, FolderOpen, Images, PackagePlus, Plus, Save, Sparkles, Trash2, Upload, UserPlus } from 'lucide-react';"
if old_import in text:
    text = text.replace(old_import, new_import, 1)
elif new_import not in text:
    raise SystemExit('No se encontró el import de iconos esperado')

old_addons = "  const clientAddons = snapshot.addons.filter((item) => item.clientId === client.id);\n  const activeAddons = clientAddons.filter((item) => item.status !== 'Anulado');"
new_addons = "  const clientAddons = snapshot.addons.filter((item) => item.clientId === client.id && item.status !== 'Anulado');\n  const activeAddons = clientAddons;"
if old_addons in text:
    text = text.replace(old_addons, new_addons, 1)
elif new_addons not in text:
    raise SystemExit('No se encontró el filtro de adicionales esperado')

anchor = "  const saveSession = async (event: React.FormEvent) => {"
remove_fn = """  const removeAddon = async (addon: ClientAddon) => {
    if (busy) return;
    const confirmed = window.confirm(`¿Eliminar el adicional “${addon.concept}”?\\n\\nSe quitará del expediente visible y el total contratado se recalculará. El movimiento quedará anulado en el historial para conservar la auditoría.`);
    if (!confirmed) return;
    setBusy(true);
    try {
      const result = await saveClientAddon({ ...addon, clientId: client.id, eventId: client.eventId, status: 'Anulado' });
      onSnapshotChange((previous) => ({
        ...previous,
        clients: previous.clients.map((item) => item.id === result.client.id ? result.client : item),
        addons: [result.addon, ...previous.addons.filter((item) => item.id !== result.addon.id)],
        packageSnapshots: result.packageSnapshot ? [result.packageSnapshot, ...previous.packageSnapshots.filter((item) => item.id !== result.packageSnapshot?.id)] : previous.packageSnapshots,
      }));
      if (addonDraft.id === addon.id) setAddonDraft(blankAddon(result.client));
      notify(`Adicional eliminado. Total contratado actualizado a ${money(result.client.totalAmount)}.`);
    } catch (error: any) {
      notify(error?.message || 'No se pudo eliminar el adicional.');
    } finally {
      setBusy(false);
    }
  };

"""
if remove_fn.strip() not in text:
    if anchor not in text:
        raise SystemExit('No se encontró el punto para insertar removeAddon')
    text = text.replace(anchor, remove_fn + anchor, 1)

old_row = "<button onClick={() => setAddonDraft(addon)} className=\"rounded-lg border border-white/10 px-3 py-2 text-xs text-[#D4AF37]\">Editar</button>"
new_row = "<div className=\"flex gap-2\"><button type=\"button\" onClick={() => setAddonDraft(addon)} className=\"rounded-lg border border-white/10 px-3 py-2 text-xs text-[#D4AF37]\">Editar</button><button type=\"button\" disabled={busy} onClick={() => removeAddon(addon)} className=\"inline-flex items-center gap-1.5 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200 disabled:opacity-40\"><Trash2 className=\"h-3.5 w-3.5\" />Eliminar</button></div>"
if old_row in text:
    text = text.replace(old_row, new_row, 1)
elif new_row not in text:
    raise SystemExit('No se encontró el botón Editar de adicionales esperado')

path.write_text(text, encoding='utf-8')
print('Eliminación segura de adicionales instalada.')
