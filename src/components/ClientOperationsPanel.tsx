import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, ClipboardCopy, FolderOpen, Images, PackagePlus, Plus, Save, Sparkles, Upload } from 'lucide-react';
import { AddOnOption, PackageOption } from '../types';
import { BusinessSnapshot, ClientAddon, ContractedService, CrmClient } from '../types/business';
import { assignClientPackage, createClientGallery, loadAdminConfig, saveClientAddon, saveContractedService, updateClientGalleryStatus, uploadClientGalleryPhoto } from '../utils/adminApi';

const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);
const today = () => new Date().toISOString().slice(0, 10);
const inputClass = 'w-full rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/60';

const blankService = (client: CrmClient): Partial<ContractedService> => ({
  clientId: client.id,
  eventId: client.eventId,
  packageSnapshotId: '',
  source: 'MANUAL',
  concept: '',
  included: true,
  quantity: 1,
  unitPrice: 0,
  total: 0,
  date: '',
  notes: '',
  status: 'Pendiente',
});

const blankAddon = (client: CrmClient): Partial<ClientAddon> => ({
  clientId: client.id,
  eventId: client.eventId,
  concept: '',
  quantity: 1,
  unitPrice: 0,
  total: 0,
  date: today(),
  notes: '',
  status: 'Confirmado',
});

interface Props {
  client: CrmClient;
  snapshot: BusinessSnapshot;
  onSnapshotChange: React.Dispatch<React.SetStateAction<BusinessSnapshot>>;
  onClientPatch: (patch: Partial<CrmClient>) => Promise<void>;
  notify: (message: string) => void;
}

export const ClientOperationsPanel: React.FC<Props> = ({ client, snapshot, onSnapshotChange, onClientPatch, notify }) => {
  const [catalog, setCatalog] = useState<Record<string, PackageOption[]>>({});
  const [addonCatalog, setAddonCatalog] = useState<AddOnOption[]>([]);
  const [packageKey, setPackageKey] = useState('');
  const [discount, setDiscount] = useState(0);
  const [promotion, setPromotion] = useState('');
  const [serviceDraft, setServiceDraft] = useState<Partial<ContractedService>>(blankService(client));
  const [addonDraft, setAddonDraft] = useState<Partial<ClientAddon>>(blankAddon(client));
  const [sessionDraft, setSessionDraft] = useState<Partial<CrmClient>>(client);
  const [busy, setBusy] = useState(false);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  useEffect(() => {
    loadAdminConfig().then((config) => {
      setCatalog(config.packages || {});
      setAddonCatalog(Array.isArray(config.addons) ? config.addons : []);
    }).catch(() => notify('No se pudo cargar el catálogo para este cliente.'));
  }, []);

  useEffect(() => {
    setServiceDraft(blankService(client));
    setAddonDraft(blankAddon(client));
    setSessionDraft(client);
  }, [client.id, client.updatedAt]);

  const packageOptions = useMemo(() => (Object.entries(catalog) as [string, PackageOption[]][]).flatMap(([category, packages]) =>
    (packages || []).map((item) => ({ category, item, key: `${category}::${item.id}` }))), [catalog]);
  const selectedPackage = packageOptions.find((option) => option.key === packageKey);
  const currentPackage = snapshot.packageSnapshots
    .filter((item) => item.clientId === client.id && item.status === 'ACTIVO')
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const clientServices = snapshot.services.filter((item) => item.clientId === client.id && item.status !== 'Anulado');
  const clientAddons = snapshot.addons.filter((item) => item.clientId === client.id);
  const activeAddons = clientAddons.filter((item) => item.status !== 'Anulado');
  const addonTotal = activeAddons.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const clientPayments = snapshot.payments.filter((item) => item.clientId === client.id && item.status !== 'Anulado');
  const clientContract = snapshot.contracts.find((item) => item.clientId === client.id);
  const clientGallery = snapshot.galleries.find((item) => item.clientId === client.id && item.status !== 'ARCHIVADA');

  const assignPackage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPackage) return notify('Selecciona el paquete que se copiará al expediente.');
    setBusy(true);
    try {
      const result = await assignClientPackage({ clientId: client.id, category: selectedPackage.category, package: selectedPackage.item, discount, promotion });
      onSnapshotChange((previous) => ({
        ...previous,
        clients: previous.clients.map((item) => item.id === result.client.id ? result.client : item),
        packageSnapshots: [result.packageSnapshot, ...previous.packageSnapshots
          .filter((item) => item.id !== result.packageSnapshot.id)
          .map((item) => item.clientId === client.id && item.status === 'ACTIVO' ? { ...item, status: 'REEMPLAZADO' as const } : item)],
        services: [...result.services, ...previous.services.filter((item) => !result.services.some((saved) => saved.id === item.id))],
      }));
      notify('Paquete copiado al cliente. Los cambios posteriores ya no modifican la plantilla base.');
    } catch (error: any) { notify(error?.message || 'No se pudo asignar el paquete.'); }
    finally { setBusy(false); }
  };

  const persistService = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await saveContractedService({ ...serviceDraft, clientId: client.id, eventId: client.eventId, total: Number(serviceDraft.quantity || 0) * Number(serviceDraft.unitPrice || 0) });
      onSnapshotChange((previous) => ({ ...previous, services: [saved, ...previous.services.filter((item) => item.id !== saved.id)] }));
      setServiceDraft(blankService(client));
      notify('Servicio del cliente actualizado sin modificar el paquete base.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar el servicio.'); }
    finally { setBusy(false); }
  };

  const persistAddon = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await saveClientAddon({ ...addonDraft, clientId: client.id, eventId: client.eventId, total: Number(addonDraft.quantity || 0) * Number(addonDraft.unitPrice || 0) });
      onSnapshotChange((previous) => ({
        ...previous,
        clients: previous.clients.map((item) => item.id === result.client.id ? result.client : item),
        addons: [result.addon, ...previous.addons.filter((item) => item.id !== result.addon.id)],
        packageSnapshots: result.packageSnapshot ? [result.packageSnapshot, ...previous.packageSnapshots.filter((item) => item.id !== result.packageSnapshot?.id)] : previous.packageSnapshots,
      }));
      setAddonDraft(blankAddon(result.client));
      notify('Adicional guardado y total contratado recalculado.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar el adicional.'); }
    finally { setBusy(false); }
  };

  const saveSession = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onClientPatch({
        preSessionApplies: true,
        preSessionType: sessionDraft.preSessionType || 'Sesión de pareja',
        preSessionDate: sessionDraft.preSessionDate || '',
        preSessionTime: sessionDraft.preSessionTime || '',
        preSessionEndTime: sessionDraft.preSessionEndTime || '',
        preSessionLocation: sessionDraft.preSessionLocation || '',
        preSessionAddress: sessionDraft.preSessionAddress || '',
        preSessionStatus: sessionDraft.preSessionStatus || (sessionDraft.preSessionDate ? 'Agendada' : 'Pendiente por agendar'),
        preSessionNotes: sessionDraft.preSessionNotes || '',
      });
      notify('Sesión previa guardada y enviada a sincronización de calendario.');
    } finally { setBusy(false); }
  };

  const saveNotes = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onClientPatch({ internalNotes: sessionDraft.internalNotes || '', providerNotes: sessionDraft.providerNotes || '' });
      notify('Notas internas y notas para proveedores guardadas por separado.');
    } finally { setBusy(false); }
  };

  const createGallery = async () => {
    setBusy(true);
    try {
      const result = await createClientGallery(client, galleryTitle);
      onSnapshotChange((previous) => ({ ...previous, galleries: [result.gallery, ...previous.galleries.filter((item) => item.id !== result.gallery.id)] }));
      setGalleryTitle('');
      notify(result.created ? 'Galería y carpetas independientes creadas en Google Drive.' : 'Ya existía una galería para este evento; se reutilizó sin duplicarla.');
    } catch (error: any) { notify(error?.message || 'No se pudo crear la galería.'); }
    finally { setBusy(false); }
  };

  const uploadGalleryFiles = async () => {
    if (!clientGallery || !galleryFiles.length) return;
    setBusy(true);
    try {
      let lastGallery = clientGallery;
      for (const file of galleryFiles) {
        const result = await uploadClientGalleryPhoto(clientGallery.id, file);
        lastGallery = result.gallery;
      }
      onSnapshotChange((previous) => ({ ...previous, galleries: previous.galleries.map((item) => item.id === lastGallery.id ? lastGallery : item) }));
      notify(`${galleryFiles.length} fotografía(s) guardadas en la carpeta de este cliente.`);
      setGalleryFiles([]);
    } catch (error: any) { notify(error?.message || 'No se pudieron subir las fotografías.'); }
    finally { setBusy(false); }
  };

  const setGalleryReady = async () => {
    if (!clientGallery) return;
    setBusy(true);
    try {
      const saved = await updateClientGalleryStatus(clientGallery.id, clientGallery.status === 'LISTA' ? 'ACTIVA' : 'LISTA');
      onSnapshotChange((previous) => ({ ...previous, galleries: previous.galleries.map((item) => item.id === saved.id ? saved : item) }));
      notify(saved.status === 'LISTA' ? 'Galería marcada como lista.' : 'Galería reabierta para administración.');
    } catch (error: any) { notify(error?.message || 'No se pudo cambiar el estado de la galería.'); }
    finally { setBusy(false); }
  };

  const checklist = [
    { label: 'Contrato firmado', applies: Boolean(clientContract), done: clientContract?.status === 'Firmado por cliente' || clientContract?.status === 'Finalizado' },
    ...clientPayments.map((payment) => ({ label: `${payment.concept || `Pago ${payment.installmentNumber}`} ${payment.status === 'Liquidado' ? 'liquidado' : 'pendiente'}`, applies: true, done: payment.status === 'Liquidado' })),
    { label: 'Sesión previa programada', applies: client.preSessionApplies, done: Boolean(client.preSessionDate && client.preSessionTime) },
    { label: 'Sesión previa realizada', applies: client.preSessionApplies, done: client.preSessionStatus === 'Realizada' },
    { label: 'Galería creada', applies: true, done: Boolean(clientGallery) },
    { label: 'Galería lista', applies: Boolean(clientGallery), done: clientGallery?.status === 'LISTA' },
    ...clientServices.filter((service) => service.included && !['No incluido', 'Anulado'].includes(service.status)).map((service) => ({ label: service.concept, applies: true, done: ['Realizado', 'Entregado'].includes(service.status) })),
  ].filter((item) => item.applies);

  return <div className="space-y-5 border-t border-white/10 p-5 sm:p-8">
    <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><h3 className="font-semibold">Notas del expediente</h3><p className="mt-1 text-xs text-gray-400">Las notas internas son administrativas; los proveedores solo reciben la información operativa.</p><form onSubmit={saveNotes} className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-xs text-gray-300">Notas internas<textarea value={sessionDraft.internalNotes || ''} onChange={(event) => setSessionDraft({ ...sessionDraft, internalNotes: event.target.value })} className={`${inputClass} mt-1 min-h-28`} placeholder="Acuerdos, márgenes, decisiones internas…" /></label><label className="text-xs text-gray-300">Notas para proveedores<textarea value={sessionDraft.providerNotes || ''} onChange={(event) => setSessionDraft({ ...sessionDraft, providerNotes: event.target.value })} className={`${inputClass} mt-1 min-h-28`} placeholder="Accesos, vestimenta, contacto operativo…" /></label><button disabled={busy} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black md:col-span-2">Guardar notas separadas</button></form></section>

    <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5">
      <div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold">Paquete contratado</h3></div>
      {currentPackage && <div className="mt-4 grid gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 sm:grid-cols-4"><div><div className="text-xs text-gray-400">Copia del paquete original</div><div className="mt-1 font-semibold">{currentPackage.packageName}</div></div><div><div className="text-xs text-gray-400">Precio base</div><div className="mt-1 font-semibold">{money(currentPackage.basePrice)}</div></div><div><div className="text-xs text-gray-400">Adicionales - descuento</div><div className="mt-1 font-semibold">{money(addonTotal)} - {money(currentPackage.discount)}</div></div><div><div className="text-xs text-gray-400">Total contratado</div><div className="mt-1 font-semibold text-emerald-300">{money(currentPackage.finalTotal)}</div></div></div>}
      <form onSubmit={assignPackage} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-gray-300">Plantilla comercial<select value={packageKey} onChange={(event) => setPackageKey(event.target.value)} className={`${inputClass} mt-1`} required><option value="">Selecciona un paquete</option>{packageOptions.map((option) => <option key={option.key} value={option.key}>{option.category} · {option.item.name} · {money(option.item.price)}</option>)}</select></label><label className="text-xs text-gray-300">Descuento o promoción<input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label className="text-xs text-gray-300 lg:col-span-2">Detalle de promoción<input value={promotion} onChange={(event) => setPromotion(event.target.value)} placeholder="Motivo o condiciones" className={`${inputClass} mt-1`} /></label><button disabled={busy || !packageKey} className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black sm:col-span-2 lg:col-span-4">{currentPackage ? 'Actualizar copia contratada' : 'Asignar y copiar paquete'}</button></form>
    </section>

    <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold">Servicios contratados</h3></div><p className="mt-1 text-xs text-gray-400">Esta lista pertenece solo a {client.name}; editarla no cambia el catálogo.</p><div className="mt-4 space-y-2">{clientServices.map((service) => <div key={service.id} className="flex flex-col gap-2 rounded-xl border border-white/10 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="font-medium">{service.concept}</div><div className="text-xs text-gray-400">{service.source === 'PAQUETE' ? 'Incluido en paquete' : 'Agregado manualmente'} · Cantidad {service.quantity} · {service.status}</div></div><button onClick={() => setServiceDraft(service)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#D4AF37]">Editar</button></div>)}{!clientServices.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-gray-500">Asigna un paquete o agrega el primer servicio manual.</p>}</div><form onSubmit={persistService} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input value={serviceDraft.concept || ''} onChange={(event) => setServiceDraft({ ...serviceDraft, concept: event.target.value })} placeholder="Servicio: fotografía, video, cuadro…" className={inputClass} required /><input type="number" min="1" step="1" value={serviceDraft.quantity || 1} onChange={(event) => setServiceDraft({ ...serviceDraft, quantity: Number(event.target.value) })} className={inputClass} required /><input type="number" min="0" step="0.01" value={serviceDraft.unitPrice || 0} onChange={(event) => setServiceDraft({ ...serviceDraft, unitPrice: Number(event.target.value) })} placeholder="Precio" className={inputClass} /><select value={serviceDraft.status || 'Pendiente'} onChange={(event) => setServiceDraft({ ...serviceDraft, status: event.target.value })} className={inputClass}>{['Pendiente','Programado','Realizado','Entregado','No incluido','Anulado'].map((status) => <option key={status}>{status}</option>)}</select><input type="date" value={serviceDraft.date || ''} onChange={(event) => setServiceDraft({ ...serviceDraft, date: event.target.value })} className={inputClass} /><label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 text-sm"><input type="checkbox" checked={serviceDraft.included !== false} onChange={(event) => setServiceDraft({ ...serviceDraft, included: event.target.checked })} />Incluido</label><textarea value={serviceDraft.notes || ''} onChange={(event) => setServiceDraft({ ...serviceDraft, notes: event.target.value })} placeholder="Notas" className={`${inputClass} min-h-12 lg:col-span-2`} /><div className="flex gap-2 lg:col-span-4"><button type="button" onClick={() => setServiceDraft(blankService(client))} className="rounded-xl border border-white/10 px-4 py-2 text-sm">Limpiar</button><button disabled={busy} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black"><Save className="mr-2 inline h-4 w-4" />{serviceDraft.id ? 'Actualizar servicio' : 'Agregar servicio'}</button></div></form></section>

    <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><div className="flex items-center gap-2"><Plus className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold">Adicionales</h3></div><div className="mt-4 space-y-2">{clientAddons.map((addon) => <div key={addon.id} className="flex flex-col gap-2 rounded-xl border border-white/10 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="font-medium">{addon.concept}</div><div className="text-xs text-gray-400">{addon.quantity} × {money(addon.unitPrice)} = {money(addon.total)} · {addon.status}</div></div><button onClick={() => setAddonDraft(addon)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#D4AF37]">Editar</button></div>)}{!clientAddons.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-gray-500">No hay adicionales registrados.</p>}</div><form onSubmit={persistAddon} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input list="xph-addons" value={addonDraft.concept || ''} onChange={(event) => { const selected = addonCatalog.find((item) => item.name === event.target.value); setAddonDraft({ ...addonDraft, concept: event.target.value, unitPrice: selected?.price ?? addonDraft.unitPrice }); }} placeholder="Concepto del adicional" className={inputClass} required /><datalist id="xph-addons">{addonCatalog.map((item) => <option key={item.id} value={item.name} />)}</datalist><input type="number" min="1" step="1" value={addonDraft.quantity || 1} onChange={(event) => setAddonDraft({ ...addonDraft, quantity: Number(event.target.value) })} className={inputClass} required /><input type="number" min="0" step="0.01" value={addonDraft.unitPrice || 0} onChange={(event) => setAddonDraft({ ...addonDraft, unitPrice: Number(event.target.value) })} placeholder="Precio unitario" className={inputClass} required /><select value={addonDraft.status || 'Confirmado'} onChange={(event) => setAddonDraft({ ...addonDraft, status: event.target.value })} className={inputClass}>{['Pendiente','Confirmado','Entregado','Anulado'].map((status) => <option key={status}>{status}</option>)}</select><input type="date" value={addonDraft.date || today()} onChange={(event) => setAddonDraft({ ...addonDraft, date: event.target.value })} className={inputClass} /><textarea value={addonDraft.notes || ''} onChange={(event) => setAddonDraft({ ...addonDraft, notes: event.target.value })} placeholder="Notas" className={`${inputClass} min-h-12 lg:col-span-2`} /><div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-3 text-sm">Total: <strong>{money(Number(addonDraft.quantity || 0) * Number(addonDraft.unitPrice || 0))}</strong></div><div className="flex gap-2 lg:col-span-4"><button type="button" onClick={() => setAddonDraft(blankAddon(client))} className="rounded-xl border border-white/10 px-4 py-2 text-sm">Limpiar</button><button disabled={busy} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black">{addonDraft.id ? 'Actualizar adicional' : 'Agregar adicional'}</button></div></form></section>

    {!client.preSessionApplies ? <section className="rounded-2xl border border-dashed border-red-400/25 bg-red-500/5 p-5"><h3 className="font-semibold">Sesión previa</h3><p className="mt-1 text-sm text-gray-400">Este cliente no tiene sesión previa. Agrégala solo si se contrata o se incluye en el paquete.</p><button onClick={() => onClientPatch({ preSessionApplies: true, preSessionStatus: 'Pendiente por agendar' })} className="mt-4 rounded-xl border border-red-300/30 px-4 py-2 text-sm text-red-100">Agregar sesión previa</button></section> : <section className="rounded-2xl border border-red-400/20 bg-red-500/5 p-5"><h3 className="font-semibold text-red-100">Sesión previa</h3>{!client.preSessionDate && <p className="mt-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">Sesión previa pendiente por agendar.</p>}<form onSubmit={saveSession} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><select value={sessionDraft.preSessionType || 'Sesión de pareja'} onChange={(event) => setSessionDraft({ ...sessionDraft, preSessionType: event.target.value })} className={inputClass}>{['Sesión de pareja','Sesión preboda','Sesión XV','Save the Date','Sesión casual','Sesión familiar','Otra'].map((type) => <option key={type}>{type}</option>)}</select><input type="date" value={sessionDraft.preSessionDate || ''} onChange={(event) => setSessionDraft({ ...sessionDraft, preSessionDate: event.target.value })} className={inputClass} /><label className="text-xs text-red-100">Hora inicial<input type="time" value={sessionDraft.preSessionTime || ''} onChange={(event) => setSessionDraft({ ...sessionDraft, preSessionTime: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs text-red-100">Hora final<input type="time" value={sessionDraft.preSessionEndTime || ''} onChange={(event) => setSessionDraft({ ...sessionDraft, preSessionEndTime: event.target.value })} className={`${inputClass} mt-1`} /></label><input value={sessionDraft.preSessionLocation || ''} onChange={(event) => setSessionDraft({ ...sessionDraft, preSessionLocation: event.target.value })} placeholder="Lugar" className={inputClass} /><input value={sessionDraft.preSessionAddress || ''} onChange={(event) => setSessionDraft({ ...sessionDraft, preSessionAddress: event.target.value })} placeholder="Dirección" className={inputClass} /><select value={sessionDraft.preSessionStatus || 'Pendiente por agendar'} onChange={(event) => setSessionDraft({ ...sessionDraft, preSessionStatus: event.target.value })} className={inputClass}>{['Pendiente por agendar','Agendada','Confirmada','Realizada','Reprogramada','Cancelada'].map((status) => <option key={status}>{status}</option>)}</select><textarea value={sessionDraft.preSessionNotes || ''} onChange={(event) => setSessionDraft({ ...sessionDraft, preSessionNotes: event.target.value })} placeholder="Notas de la sesión" className={`${inputClass} min-h-12`} /><div className="flex gap-2 lg:col-span-4"><button type="button" onClick={() => onClientPatch({ preSessionApplies: false, preSessionStatus: 'Cancelada' })} className="rounded-xl border border-white/10 px-4 py-2 text-sm">Quitar sesión</button><button disabled={busy} className="rounded-xl bg-red-200 px-4 py-2 text-sm font-bold text-red-950">Guardar y sincronizar</button></div></form></section>}

    <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5">
      <div className="flex items-center gap-2"><Images className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold">Galería del cliente</h3></div>
      {!clientGallery ? <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={galleryTitle} onChange={(event) => setGalleryTitle(event.target.value)} placeholder={`${client.name} - ${client.eventType || 'Evento'} ${client.eventDate || ''}`} className={inputClass} /><button type="button" onClick={createGallery} disabled={busy} className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black">Crear galería y carpeta</button><p className="text-xs text-gray-400 sm:col-span-2">Se crearán una sola vez las carpetas Galerías → evento del cliente → Fotografías.</p></div> : <div className="mt-4 space-y-4"><div className="grid gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 sm:grid-cols-[1fr_auto]"><div><div className="font-semibold">{clientGallery.title}</div><div className="mt-1 text-xs text-gray-400">Estado: <span className="text-emerald-300">{clientGallery.status}</span> · Carpeta identificada: {clientGallery.photosFolderId}</div></div><div className="flex flex-wrap gap-2"><a href={clientGallery.galleryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs"><FolderOpen className="h-4 w-4" />Abrir galería</a><a href={clientGallery.folderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs">Administrar en Drive</a><button type="button" onClick={() => navigator.clipboard.writeText(clientGallery.galleryUrl).then(() => notify('Liga de galería copiada.'))} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs"><ClipboardCopy className="h-4 w-4" />Copiar enlace</button><button type="button" onClick={setGalleryReady} className="rounded-lg border border-[#D4AF37]/40 px-3 py-2 text-xs text-[#F5D76E]">{clientGallery.status === 'LISTA' ? 'Reabrir' : 'Marcar lista'}</button></div></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><input type="file" accept="image/*" multiple onChange={(event) => setGalleryFiles(Array.from(event.target.files || []))} className="min-w-0 flex-1 text-sm" /><button type="button" onClick={uploadGalleryFiles} disabled={busy || !galleryFiles.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"><Upload className="h-4 w-4" />Subir {galleryFiles.length || ''} fotografía(s)</button></div></div>}
    </section>

    <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold">Checklist operativo</h3></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{checklist.map((item, index) => <div key={`${item.label}-${index}`} className="flex items-start gap-3 rounded-xl border border-white/10 p-3"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${item.done ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300' : 'border-gray-500 text-transparent'}`}>✓</span><span className={item.done ? 'text-sm text-gray-400 line-through' : 'text-sm text-gray-100'}>{item.label}</span></div>)}{!checklist.length && <p className="text-sm text-gray-500">Asigna un paquete o un contrato para generar pendientes aplicables.</p>}</div></section>
  </div>;
};
