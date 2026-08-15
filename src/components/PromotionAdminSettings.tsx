import React, { useEffect, useState } from 'react';
import { EyeOff, Image as ImageIcon, Loader2, Megaphone, Save, Trash2, Upload, X } from 'lucide-react';
import { EMPTY_PROMOTION_POPUP, PromotionPopupConfig, PromotionPopupMode } from '../promotion';
import { AdminSession, adminUploadMedia, loadAdminConfig, resumeAdminSession, saveAdminConfig } from '../utils/adminApi';

export const PromotionAdminSettings: React.FC = () => {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState<PromotionPopupConfig>({ ...EMPTY_PROMOTION_POPUP });

  const load = async (activeSession: AdminSession) => {
    const config = await loadAdminConfig(activeSession);
    const promo = config.promotionPopup;
    setForm(promo && typeof promo === 'object' ? { ...EMPTY_PROMOTION_POPUP, ...promo } : { ...EMPTY_PROMOTION_POPUP });
  };

  useEffect(() => {
    resumeAdminSession().then((active) => {
      setSession(active);
      if (active) load(active).catch(() => null);
    }).catch(() => setSession(null));
  }, []);

  if (!session) return null;

  const patch = <K extends keyof PromotionPopupConfig>(key: K, value: PromotionPopupConfig[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const uploadImage = async () => {
    if (!imageFile || !session) return;
    setBusy(true);
    setMessage('');
    try {
      const uploaded = await adminUploadMedia(session, imageFile, {
        title: form.title || 'Promoción XPH',
        category: 'empresarial',
        location: 'Promoción XPH',
      });
      patch('imageUrl', uploaded.url);
      setImageFile(null);
      setMessage('Imagen cargada. Guarda la promoción para publicarla.');
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
      setForm(confirmed.promotionPopup || next);
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
      setForm(confirmed.promotionPopup || next);
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
      await saveAdminConfig(session, { promotionPopup: null }, 'ADMIN_PROMOCION_ELIMINADA', 'Pop-up promocional eliminado');
      setForm({ ...EMPTY_PROMOTION_POPUP });
      setImageFile(null);
      setMessage('Pop-up eliminado por completo.');
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[120] px-4 py-3 rounded-xl bg-[#D4AF37] text-black font-extrabold text-sm shadow-2xl flex items-center gap-2">
        <Megaphone className="w-4 h-4" /> Promociones
      </button>

      {open && <div className="fixed inset-0 z-[130] bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => setOpen(false)}>
        <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#161C28] border border-white/10 p-6 sm:p-7 space-y-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono">PROMOCIONES</p><h2 className="text-2xl font-bold">Pop-up promocional</h2><p className="text-xs text-gray-400 mt-1">Puedes publicarlo como texto, imagen o ambos. El visitante siempre podrá cerrarlo.</p></div>
            <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-lg bg-white/5"><X className="w-5 h-5" /></button>
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
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            <button type="button" onClick={uploadImage} disabled={!imageFile || busy} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-40"><Upload className="inline w-4 h-4 mr-2" />Subir imagen</button>
            <label className="text-xs text-gray-300 block">O pega una URL<input value={form.imageUrl} onChange={(e) => patch('imageUrl', e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#161C28] border border-white/10" /></label>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
            <button type="button" onClick={save} disabled={busy} className="py-3 rounded-xl bg-[#D4AF37] text-black font-extrabold text-sm disabled:opacity-40">{busy ? <Loader2 className="inline w-4 h-4 mr-2 animate-spin" /> : <Save className="inline w-4 h-4 mr-2" />}Guardar y publicar</button>
            <button type="button" onClick={deactivate} disabled={busy} className="py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 font-bold text-sm disabled:opacity-40"><EyeOff className="inline w-4 h-4 mr-2" />Desactivar</button>
            <button type="button" onClick={remove} disabled={busy} className="py-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 font-bold text-sm disabled:opacity-40"><Trash2 className="inline w-4 h-4 mr-2" />Eliminar pop-up</button>
          </div>
        </div>
      </div>}
    </>
  );
};
