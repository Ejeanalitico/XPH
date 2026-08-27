import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Mail, RefreshCw, Save, Send, Upload } from 'lucide-react';
import { BusinessSnapshot, EmailTemplate, GmailConfig } from '../types/business';
import { installCrmReminders, runCrmReminders, saveEmailTemplate, saveGmailConfig, sendClientEmail, sendGmailTest, uploadEmailLogo } from '../utils/adminApi';

interface Props {
  snapshot: BusinessSnapshot;
  onSnapshotChange: React.Dispatch<React.SetStateAction<BusinessSnapshot>>;
  onRefresh: () => Promise<void>;
  notify: (message: string) => void;
}

const blankConfig = (): GmailConfig => ({
  id: 'xph-gmail', enabled: false, connectedEmail: '', senderName: 'XPH Fotografía & Video', replyTo: '',
  signatureHtml: '<p>XPH Fotografía & Video</p>', logoFileId: '', logoUrl: '', autoPaymentReceived: false,
  autoPaymentDue: false, autoEventReminders: false, updatedAt: '',
});

export const GmailAdminPanel: React.FC<Props> = ({ snapshot, onSnapshotChange, onRefresh, notify }) => {
  const [config, setConfig] = useState<GmailConfig>(snapshot.gmailConfig || blankConfig());
  const [templateDraft, setTemplateDraft] = useState<Partial<EmailTemplate> | null>(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [clientId, setClientId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => setConfig(snapshot.gmailConfig || blankConfig()), [snapshot.gmailConfig]);
  const activeTemplates = useMemo(() => snapshot.emailTemplates.filter((item) => item.status === 'ACTIVA'), [snapshot.emailTemplates]);

  const persistConfig = async (next: Partial<GmailConfig> = config) => {
    setBusy('config');
    try {
      const saved = await saveGmailConfig(next);
      setConfig(saved);
      onSnapshotChange((current) => ({ ...current, gmailConfig: saved }));
      notify(saved.enabled ? `Gmail conectado mediante la cuenta autorizada${saved.connectedEmail ? `: ${saved.connectedEmail}` : ''}.` : 'Gmail desconectado; no se enviarán correos automáticos.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar la configuración de Gmail.'); }
    finally { setBusy(''); }
  };

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    setBusy('logo');
    try {
      const saved = await uploadEmailLogo(file);
      setConfig(saved);
      onSnapshotChange((current) => ({ ...current, gmailConfig: saved }));
      notify('Logo XPH guardado para los correos HTML.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar el logo.'); }
    finally { setBusy(''); }
  };

  const testEmail = async () => {
    setBusy('test');
    try {
      const history = await sendGmailTest(testRecipient);
      onSnapshotChange((current) => ({ ...current, emailHistory: [history, ...current.emailHistory.filter((item) => item.id !== history.id)] }));
      notify('Correo de prueba enviado y registrado en el historial.');
    } catch (error: any) { notify(error?.message || 'No se pudo enviar el correo de prueba.'); }
    finally { setBusy(''); }
  };

  const sendManual = async () => {
    setBusy('send');
    try {
      const history = await sendClientEmail(clientId, templateId);
      onSnapshotChange((current) => ({ ...current, emailHistory: [history, ...current.emailHistory.filter((item) => item.id !== history.id)] }));
      notify('Correo enviado y relacionado con el expediente.');
    } catch (error: any) { notify(error?.message || 'No se pudo enviar el correo.'); }
    finally { setBusy(''); }
  };

  const persistTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!templateDraft) return;
    setBusy('template');
    try {
      const saved = await saveEmailTemplate(templateDraft);
      onSnapshotChange((current) => ({ ...current, emailTemplates: [saved, ...current.emailTemplates.filter((item) => item.id !== saved.id)] }));
      setTemplateDraft(null);
      notify('Plantilla de correo guardada.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar la plantilla.'); }
    finally { setBusy(''); }
  };

  const runReminders = async () => {
    setBusy('reminders');
    try {
      const result = await runCrmReminders();
      await onRefresh();
      notify(`Revisión terminada: ${result.notificationsProcessed || 0} avisos y ${result.emailsProcessed || 0} correos procesados sin duplicar.`);
    } catch (error: any) { notify(error?.message || 'No se pudieron revisar los recordatorios.'); }
    finally { setBusy(''); }
  };

  const installTrigger = async () => {
    setBusy('trigger');
    try { await installCrmReminders(); notify('Revisión automática instalada cada 6 horas.'); }
    catch (error: any) { notify(error?.message || 'No se pudo instalar la automatización.'); }
    finally { setBusy(''); }
  };

  return <div className="space-y-5">
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold"><Mail className="h-5 w-5 text-[#D4AF37]" />Correo / Gmail</h3><p className="mt-1 text-xs text-gray-400">Usa la autorización segura de Google Apps Script. No se guarda ninguna contraseña.</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-gray-400'}`}>{config.enabled ? 'Conectado' : 'Desconectado'}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-400">Nombre del remitente<input value={config.senderName} onChange={(event) => setConfig((current) => ({ ...current, senderName: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm text-white" /></label>
          <label className="text-xs text-gray-400">Responder a<input type="email" value={config.replyTo} onChange={(event) => setConfig((current) => ({ ...current, replyTo: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm text-white" placeholder="correo@ejemplo.com" /></label>
          <label className="text-xs text-gray-400 sm:col-span-2">Firma HTML<textarea value={config.signatureHtml} onChange={(event) => setConfig((current) => ({ ...current, signatureHtml: event.target.value }))} className="mt-1 min-h-28 w-full rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 font-mono text-xs text-white" /></label>
        </div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          {([['autoPaymentReceived', 'Confirmar pagos recibidos'], ['autoPaymentDue', 'Recordar pagos'], ['autoEventReminders', 'Recordar eventos']] as const).map(([key, label]) => <label key={key} className="flex items-start gap-2 rounded-xl border border-white/10 p-3"><input type="checkbox" checked={config[key]} onChange={(event) => setConfig((current) => ({ ...current, [key]: event.target.checked }))} className="mt-1" /><span>{label}</span></label>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => persistConfig({ ...config, enabled: !config.enabled })} disabled={busy === 'config'} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${config.enabled ? 'border border-red-400/30 text-red-200' : 'bg-[#D4AF37] text-black'}`}>{config.enabled ? 'Desconectar' : 'Conectar cuenta'}</button><button onClick={() => persistConfig(config)} disabled={busy === 'config'} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm"><Save className="h-4 w-4" />Guardar configuración</button></div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#161C28] p-5">
        <div><h3 className="font-semibold">Identidad del correo</h3><p className="mt-1 text-xs text-gray-400">Logo responsivo para Gmail, Outlook, Android, iPhone y computadora.</p></div>
        {config.logoUrl ? <img src={config.logoUrl} alt="Logo XPH para correo" className="max-h-24 max-w-[220px] rounded-lg bg-white p-2" /> : <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-gray-500">Sin logo configurado</div>}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D4AF37]/40 px-4 py-2.5 text-sm text-[#F5D76E]"><Upload className="h-4 w-4" />{busy === 'logo' ? 'Subiendo…' : 'Subir logo PNG, JPG o WebP'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => uploadLogo(event.target.files?.[0])} /></label>
        <div className="border-t border-white/10 pt-4"><label className="text-xs text-gray-400">Correo para prueba<input type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm text-white" /></label><button onClick={testEmail} disabled={!config.enabled || !testRecipient || busy === 'test'} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"><Send className="h-4 w-4" />Enviar prueba</button></div>
      </section>
    </div>

    <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Automatizaciones y recordatorios</h3><p className="mt-1 text-xs text-gray-400">Revisa eventos, pagos, seguimientos, sesiones y personal con claves idempotentes.</p></div><div className="flex flex-wrap gap-2"><button onClick={runReminders} disabled={busy === 'reminders'} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm"><RefreshCw className="h-4 w-4" />Revisar ahora</button><button onClick={installTrigger} disabled={busy === 'trigger'} className="inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/40 px-4 py-2.5 text-sm text-[#F5D76E]"><Clock3 className="h-4 w-4" />Activar cada 6 horas</button></div></div>
    </section>

    <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5">
      <h3 className="font-semibold">Enviar correo relacionado</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><select value={clientId} onChange={(event) => setClientId(event.target.value)} className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm"><option value="">Cliente o prospecto</option>{snapshot.clients.filter((item) => item.email).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</select><select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm"><option value="">Plantilla</option>{activeTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button onClick={sendManual} disabled={!config.enabled || !clientId || !templateId || busy === 'send'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black disabled:opacity-40"><Send className="h-4 w-4" />Enviar</button></div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <div className="space-y-2 rounded-2xl border border-white/10 bg-[#161C28] p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Plantillas</h3><button onClick={() => setTemplateDraft({ name: '', subject: '', htmlBody: '<p>Hola {{cliente_nombre}},</p>', status: 'ACTIVA' })} className="text-xs font-semibold text-[#F5D76E]">Nueva</button></div>{snapshot.emailTemplates.map((item) => <button key={item.id} onClick={() => setTemplateDraft(item)} className="block w-full rounded-xl border border-white/10 p-3 text-left hover:bg-white/5"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.name}</span><span className={item.status === 'ACTIVA' ? 'text-xs text-emerald-300' : 'text-xs text-gray-500'}>{item.status}</span></div><div className="mt-1 truncate text-xs text-gray-400">{item.subject}</div></button>)}</div>
      <div className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><h3 className="font-semibold">Historial de correos</h3><div className="mt-3 max-h-[520px] divide-y divide-white/10 overflow-y-auto">{snapshot.emailHistory.map((item) => <div key={item.id} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-medium">{item.subject}</div><div className="mt-1 truncate text-xs text-gray-400">{item.recipient} · {item.sentAt}</div></div><span className={`flex items-center gap-1 text-xs ${item.status === 'ENVIADO' ? 'text-emerald-300' : 'text-red-300'}`}><CheckCircle2 className="h-3.5 w-3.5" />{item.status}</span></div><div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{item.mode} · {item.templateId}</div>{item.error && <div className="mt-1 text-xs text-red-300">{item.error}</div>}</div>)}{!snapshot.emailHistory.length && <p className="py-8 text-center text-sm text-gray-500">Aún no hay correos enviados.</p>}</div></div>
    </section>

    {templateDraft && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4"><form onSubmit={persistTemplate} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#161C28] p-5 shadow-2xl"><h3 className="text-lg font-semibold">Editar plantilla</h3><div className="mt-4 grid gap-3"><input value={templateDraft.name || ''} onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre" className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm" required /><input value={templateDraft.subject || ''} onChange={(event) => setTemplateDraft((current) => ({ ...current, subject: event.target.value }))} placeholder="Asunto" className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm" required /><textarea value={templateDraft.htmlBody || ''} onChange={(event) => setTemplateDraft((current) => ({ ...current, htmlBody: event.target.value }))} className="min-h-56 rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 font-mono text-xs" required /><select value={templateDraft.status || 'ACTIVA'} onChange={(event) => setTemplateDraft((current) => ({ ...current, status: event.target.value as EmailTemplate['status'] }))} className="rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm"><option>ACTIVA</option><option>INACTIVA</option></select><p className="text-xs leading-5 text-gray-400">Variables: {'{{cliente_nombre}}'}, {'{{evento_fecha}}'}, {'{{evento_hora}}'}, {'{{evento_tipo}}'}, {'{{evento_lugar}}'}, {'{{saldo_pendiente}}'}, {'{{monto_pago}}'}, {'{{fecha_pago}}'}, {'{{galeria_url}}'}, {'{{contrato_url}}'}.</p></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setTemplateDraft(null)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">Cancelar</button><button type="submit" disabled={busy === 'template'} className="rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black">Guardar</button></div></form></div>}
  </div>;
};
