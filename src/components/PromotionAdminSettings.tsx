import React, { useEffect, useState } from 'react';
import { EyeOff, Image as ImageIcon, Loader2, Save, Trash2, Upload } from 'lucide-react';
import { EMPTY_PROMOTION_POPUP, PromotionPopupConfig, PromotionPopupMode } from '../promotion';
import { AdminSession, adminUploadMedia, loadAdminConfig, saveAdminConfig } from '../utils/adminApi';

interface PromotionAdminSettingsProps {
  adminSession: AdminSession;
}

export const PromotionAdminSettings: React.FC<PromotionAdminSettingsProps> = ({ adminSession }) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [form, setForm] = useState<PromotionPopupConfig>({ ...EMPTY_PROMOTION_POPUP });

  useEffect(() => {
    let cancelled = false;
    loadAdminConfig(adminSession).then((config) => {
      if (cancelled) return;
      const promo = config.promotionPopup;
      setForm(promo && typeof promo === 'object' ? { ...EMPTY_PROMOTION_POPUP, ...promo } : { ...EMPTY_PROMOTION_POPUP });
    }).catch(() => null);
    return () => { cancelled = true; };
  }, [adminSession]);

  const session = adminSession;

  const patch = <K extends keyof PromotionPopupConfig>(key: K, value: PromotionPopupConfig[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const uploadImage = async (file: File) => {
    if (!session) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Formato no compatible. Selecciona una imagen JPG, PNG o WEBP.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setMessage('La imagen supera 25 MB. Selecciona una versión más ligera.');
      return;
    }
    setBusy(true);
    setMessage(`Subiendo ${file.name}…`);
    try {
      const uploaded = await adminUploadMedia(session, file, {
        title: form.title || 'Promoción XPH',
        category: 'empresarial',
        location: 'Promoción XPH',
      });
      setForm((prev) => ({
        ...prev,
        imageUrl: uploaded.url,
        mode: prev.mode === 'text' ? (prev.title.trim() || prev.text.trim() ? 'both' : 'image') : prev.mode,
      }));
      setUploadedImageName(file.name);
      setMessage('Imagen cargada correctamente. Pulsa “Guardar y publicar” para mostrarla en el pop-up.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo cargar la imagen.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!session) return;
    setBusy(true);
    setMessage('');
    try {
      const next = { ...form, updatedAt: new Date().toISOString() };
      const confirmed = await saveAdminConfig(session, { promotionPopup: next }, 'ADMIN_PROMOCION', 'Pop-up promocional actualizado');
      if (!confirmed.promotionPopup || confirmed.promotionPopup.updatedAt !== next.updatedAt) {
        throw new Error('La promoción no quedó confirmada en la nube. Intenta guardarla nuevamente.');
      }
      setForm({ ...EMPTY_PROMOTION_POPUP, ...confirmed.promotionPopup });
      setMessage(next.enabled ? 'Promoción guardada y publicada.' : 'Promoción guardada como desactivada.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo guardar la promoción.');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const next = { ...form, enabled: false, updatedAt: new Date().toISOString() };
      const confirmed = await saveAdminConfig(session, { promotionPopup: next }, 'ADMIN_PROMOCION_DESACTIVADA', 'Pop-up promocional desactivado');
      if (!confirmed.promotionPopup || confirmed.promotionPopup.updatedAt !== next.updatedAt) {
        throw new Error('La desactivación no quedó confirmada en la nube. Intenta nuevamente.');
      }
      setForm({ ...EMPTY_PROMOTION_POPUP, ...confirmed.promotionPopup });
      setMessage('Pop-up desactivado. Su contenido se conserva para volver a activarlo después.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo desactivar.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!session) return;
    if (!window.confirm('¿Eliminar por completo el pop-up promocional?')) return;
    setBusy(true);
    try {
      const confirmed = await saveAdminConfig(session, { promotionPopup: null }, 'ADMIN_PROMOCION_ELIMINADA', 'Pop-up promocional eliminado');
      if (confirmed.promotionPopup) throw new Error('El pop-up todavía aparece en la configuración guardada.');
      setForm({ ...EMPTY_PROMOTION_POPUP });
      setUploadedImageName('');
      setMessage('Pop-up eliminado por completo.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  };

  return (
        <div className="w-full rounded-2xl bg-[#161C28] border border-white/10 p-6 sm:p-7 space-y-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">PROMOCIONES</p><h2 className="text-2xl font-bold">Pop-up promocional</h2><p className="text-xs text-gray-400 mt-1">Puedes publicarlo como texto, imagen o ambos. El visitante siempre podrá cerrarlo.</p></div>
          </div>

          {message && <div className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#F5D76E]">{message}</div>}

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-xs text-gray-300">Estado<select value={form.enabled ? 'on' : 'off'} onChange={(e) => patch('enabled', e.target.value === 'on')} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10"><option value="off">Desactivado</option><option value="on">Activo</option></select></label>
            <label className="text-xs text-gray-300">Formato<select value={form.mode} onChange={(e) => patch('mode', e.target.value as PromotionPopupMode)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10"><option value="text">Solo texto</option><option value="image">Solo imagen</option><option value="both">Texto + imagen</option></select></label>
            <label className="text-xs text-gray-300 sm:col-span-2">Título<input value={form.title} onChange={(e) => patch('title', e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10" placeholder="Ej. Promoción de agosto" /></label>
            <label className="text-xs text-gray-300 sm:col-span-2">Texto<textarea value={form.text} onChange={(e) => patch('text', e.target.value)} rows={5} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10 resize-y" placeholder="Escribe aquí la promoción" /></label>
            <label className="text-xs text-gray-300">Válida desde<input type="date" value={form.validFrom || ''} onChange={(e) => patch('validFrom', e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10" /></label>
            <label className="text-xs text-gray-300">Válida hasta<input type="date" value={form.validUntil || ''} onChange={(e) => patch('validUntil', e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10" /></label>
            <label className="text-xs text-gray-300">Texto del botón<input value={form.ctaText || ''} onChange={(e) => patch('ctaText', e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10" placeholder="Ej. Ver paquetes" /></label>
            <label className="text-xs text-gray-300">Liga del botón<input value={form.ctaUrl || ''} onChange={(e) => patch('ctaUrl', e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/10" placeholder="#/bodas o https://..." /></label>
          </div>

          <div className="rounded-2xl bg-[#0B0F17] border border-white/10 p-5 space-y-4">
            <div className="flex items-center gap-2"><ImageIcon className="w-5 h-5 text-[#D4AF37]" /><h3 className="font-bold">Imagen de la promoción</h3></div>
            {form.imageUrl && <img src={form.imageUrl} alt="Vista previa promoción" className="w-full max-h-80 object-contain rounded-xl bg-black" />}
            <input
              id="promotion-image-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void uploadImage(file);
              }}
            />
            <label htmlFor="promotion-image-upload" className={`w-full px-4 py-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 cursor-pointer ${busy ? 'bg-white/5 border-white/10 text-gray-500 pointer-events-none' : 'bg-[#D4AF37]/10 border-[#D4AF37]/35 text-[#F5D76E] hover:bg-[#D4AF37]/15'}`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {busy ? 'Subiendo imagen…' : form.imageUrl ? 'Cambiar imagen' : 'Seleccionar y subir imagen'}
            </label>
            <p className="text-[11px] text-gray-500">Formatos compatibles: JPG, PNG y WEBP. Tamaño máximo: 25 MB. La carga comienza al seleccionar el archivo.</p>
            {uploadedImageName && <p className="text-xs text-emerald-400">Archivo cargado: {uploadedImageName}</p>}
            <label className="text-xs text-gray-300 block">O pega una URL<input value={form.imageUrl} onChange={(e) => patch('imageUrl', e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#161C28] border border-white/10" /></label>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
            <button type="button" onClick={save} disabled={busy} className="py-3 rounded-xl bg-[#D4AF37] text-black font-extrabold text-sm disabled:opacity-40">{busy ? <Loader2 className="inline w-4 h-4 mr-2 animate-spin" /> : <Save className="inline w-4 h-4 mr-2" />}Guardar y publicar</button>
            <button type="button" onClick={deactivate} disabled={busy} className="py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 font-bold text-sm disabled:opacity-40"><EyeOff className="inline w-4 h-4 mr-2" />Desactivar</button>
            <button type="button" onClick={remove} disabled={busy} className="py-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 font-bold text-sm disabled:opacity-40"><Trash2 className="inline w-4 h-4 mr-2" />Eliminar pop-up</button>
          </div>
        </div>
  );
};
