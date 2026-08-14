import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Calendar as CalendarIcon, CheckCircle2, FileText, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { BookingState, PackageOption, AddOnOption, EventType } from '../types';
import { PACKAGES_BY_EVENT, ADDONS_CATALOG } from '../data/packages';
import { copyToClipboard } from '../utils/clipboard';
import { loadSiteDataFromCloud } from '../utils/googleDrive';
import { submitPublicLead } from '../utils/adminApi';

interface BookingWizardProps {
  bookingState: BookingState;
  onUpdateBookingState: (updater: (prev: BookingState) => BookingState) => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'success' | 'warning') => void;
  onSendWhatsApp?: () => void;
  packages?: Record<EventType, PackageOption[]>;
  addons?: AddOnOption[];
}

export const BookingWizard: React.FC<BookingWizardProps> = ({
  bookingState,
  onUpdateBookingState,
  onShowToast,
  packages = PACKAGES_BY_EVENT,
  addons = ADDONS_CATALOG,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sending, setSending] = useState(false);

  const configuredPackages = packages[bookingState.eventType];
  const currentPackages = configuredPackages?.length ? configuredPackages : PACKAGES_BY_EVENT[bookingState.eventType];
  const selectedPackage = currentPackages.find((pkg) => pkg.id === bookingState.selectedPackageId) || currentPackages[0];
  const selectedAddons = bookingState.selectedAddons
    .map((id) => addons.find((addon) => addon.id === id))
    .filter((addon): addon is AddOnOption => Boolean(addon));

  const handleDateChange = (date: string) => {
    onUpdateBookingState((prev) => ({ ...prev, date }));
    if (date) onShowToast('Fecha seleccionada', 'La disponibilidad se confirmará después de revisar la agenda.', 'info');
  };

  const handleCopyRequestLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}#solicitud`;
    const success = await copyToClipboard(link);
    setCopiedLink(true);
    onShowToast(success ? 'Enlace copiado' : 'Enlace de solicitud', success ? 'Puedes compartir este enlace.' : link, 'info');
    window.setTimeout(() => setCopiedLink(false), 3000);
  };

  const cleanWhatsAppNumber = (value?: string) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) return `52${digits}`;
    if (digits.startsWith('52')) return digits;
    return digits || '525615567863';
  };

  const handleSendRequest = async () => {
    if (!bookingState.date) {
      setCurrentStep(1);
      onShowToast('Selecciona una fecha', 'Necesitamos una fecha tentativa para revisar la agenda.', 'warning');
      return;
    }
    if (!bookingState.clientName || !bookingState.clientEmail || !bookingState.clientPhone) {
      setCurrentStep(2);
      onShowToast('Campos incompletos', 'Completa nombre, correo y WhatsApp.', 'warning');
      return;
    }
    if (sending) return;

    setSending(true);
    const whatsappWindow = window.open('', '_blank');

    try {
      const cloudConfig = (await loadSiteDataFromCloud()) || {};
      const footerContact = cloudConfig.footerContact || {};
      const phoneNumber = cleanWhatsAppNumber(footerContact.whatsapp || footerContact.phone);
      const activeAddonNames = selectedAddons.map((addon) => addon.name);
      if (bookingState.extraHours > 0) activeAddonNames.push(`${bookingState.extraHours} Horas Extra de Cobertura`);

      const requestRecord = {
        id: `quote-${Date.now()}`,
        clientName: bookingState.clientName,
        clientEmail: bookingState.clientEmail,
        clientPhone: bookingState.clientPhone,
        eventType: bookingState.eventType,
        selectedPackageId: selectedPackage.id,
        packageName: selectedPackage.name,
        packagePrice: selectedPackage.price,
        addons: activeAddonNames,
        extraHours: bookingState.extraHours,
        total: bookingState.total,
        depositAmount: 0,
        eventDate: bookingState.date,
        eventCity: bookingState.eventCity || 'Por definir',
        status: 'Pendiente',
        createdAt: new Date().toISOString().split('T')[0],
        notes: bookingState.notes || 'Solicitud de disponibilidad enviada desde la web.',
      };

      await submitPublicLead(requestRecord);

      const packagePrice = selectedPackage.price > 0 ? `$${selectedPackage.price.toLocaleString('es-MX')} MXN` : 'Cotización personalizada';
      const totalText = bookingState.total > 0 ? `$${bookingState.total.toLocaleString('es-MX')} MXN` : 'Por cotizar';
      const message = `Hola XPH Fotografía & Video. Quisiera solicitar disponibilidad e información para mi evento.\n\n📸 Tipo de evento: ${bookingState.eventType.toUpperCase()}\n📦 Paquete: ${selectedPackage.name} (${packagePrice})\n🗓️ Fecha tentativa: ${bookingState.date}\n📍 Lugar: ${bookingState.eventCity || 'Por definir'}\n✨ Adicionales: ${activeAddonNames.length ? activeAddonNames.join(', ') : 'Ninguno'}\n💰 Total estimado: ${totalText}\n👤 Nombre: ${bookingState.clientName}\n📱 WhatsApp: ${bookingState.clientPhone}\n✉️ Correo: ${bookingState.clientEmail}${bookingState.notes ? `\n📝 Notas: ${bookingState.notes}` : ''}\n\nQuedo pendiente de confirmación de disponibilidad.`;
      const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      if (whatsappWindow) whatsappWindow.location.href = url;
      else window.location.href = url;

      onShowToast('Solicitud registrada', 'Se guardó en Google Sheets y se preparó el mensaje de WhatsApp.', 'success');
    } catch (error: any) {
      whatsappWindow?.close();
      onShowToast('No se pudo enviar la solicitud', error?.message || 'Revisa la conexión e intenta nuevamente.', 'warning');
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="solicitud" className="py-20 bg-[#0B0F17] relative border-b border-white/5">
      <span id="contratacion" className="absolute -top-20" aria-hidden="true" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold font-mono">SOLICITUD DE DISPONIBILIDAD</span>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif-luxury text-white">Solicita tu fecha en 2 pasos</h2>
          <p className="text-gray-300 text-sm max-w-2xl mx-auto">Selecciona tu fecha tentativa y comparte tus datos. La disponibilidad se confirma personalmente.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-4 p-2 rounded-2xl bg-[#161C28] border border-white/10">
          {[
            { step: 1 as const, label: '1. Fecha', icon: CalendarIcon },
            { step: 2 as const, label: '2. Datos', icon: FileText },
          ].map((item) => {
            const Icon = item.icon;
            return <button key={item.step} type="button" onClick={() => setCurrentStep(item.step)} className={`p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold ${currentStep === item.step ? 'gold-gradient-bg text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><Icon className="w-4 h-4" />{item.label}</button>;
          })}
        </div>

        <div className="p-5 sm:p-8 lg:p-10 rounded-2xl bg-[#161C28] border border-white/10 shadow-2xl">
          {currentStep === 1 ? (
            <div className="space-y-6">
              <div><h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-[#D4AF37]" />Fecha tentativa del evento</h3><p className="text-xs text-gray-400 mt-1">Elegir una fecha aquí no la bloquea ni confirma.</p></div>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-[#0B0F17] border border-white/10"><label className="text-xs font-semibold text-gray-300 block mb-2">Fecha tentativa *</label><input type="date" value={bookingState.date} onChange={(e) => handleDateChange(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#161C28] border border-white/20 text-white font-mono text-sm" /></div>
                <div className="p-5 rounded-2xl bg-[#0B0F17] border border-white/10 flex items-center gap-3">{bookingState.date ? <><CheckCircle2 className="w-5 h-5 text-[#D4AF37]" /><div><p className="text-sm font-bold text-white">Fecha seleccionada</p><p className="text-xs text-gray-400">{bookingState.date} · pendiente de validación.</p></div></> : <><AlertCircle className="w-5 h-5 text-gray-500" /><p className="text-xs text-gray-400">Selecciona una fecha para continuar.</p></>}</div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t border-white/10"><button type="button" onClick={handleCopyRequestLink} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-semibold flex items-center justify-center gap-2"><Share2 className="w-4 h-4 text-[#D4AF37]" />{copiedLink ? 'Enlace copiado' : 'Copiar enlace de solicitud'}</button><button type="button" onClick={() => setCurrentStep(2)} disabled={!bookingState.date} className="px-6 py-3 rounded-xl gold-gradient-bg text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40">Continuar con mis datos<ArrowRight className="w-4 h-4" /></button></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div><h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2"><FileText className="w-5 h-5 text-[#D4AF37]" />Datos de contacto</h3><p className="text-xs text-gray-400 mt-1">Se guardan para dar seguimiento a tu solicitud.</p></div>
              <div className="p-5 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-2 text-xs"><div className="flex justify-between gap-4"><span className="text-gray-400">Paquete</span><span className="text-white font-semibold text-right">{selectedPackage.name}</span></div><div className="flex justify-between gap-4"><span className="text-gray-400">Precio</span><span className="text-[#D4AF37] font-mono font-bold">{selectedPackage.price > 0 ? `$${selectedPackage.price.toLocaleString('es-MX')} MXN` : 'Cotización personalizada'}</span></div><div className="flex justify-between gap-4"><span className="text-gray-400">Fecha</span><span className="text-white font-mono">{bookingState.date}</span></div></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-xs text-gray-300">Nombre completo *<input type="text" value={bookingState.clientName} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, clientName: e.target.value }))} className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white" /></label>
                <label className="text-xs text-gray-300">Correo electrónico *<input type="email" value={bookingState.clientEmail} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, clientEmail: e.target.value }))} className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white" /></label>
                <label className="text-xs text-gray-300">WhatsApp *<input type="tel" value={bookingState.clientPhone} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, clientPhone: e.target.value }))} className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white" /></label>
                <label className="text-xs text-gray-300">Ciudad / locación<input type="text" value={bookingState.eventCity} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, eventCity: e.target.value }))} className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white" /></label>
              </div>
              <label className="text-xs text-gray-300 block">Notas adicionales<textarea value={bookingState.notes} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, notes: e.target.value }))} rows={3} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white resize-y" /></label>
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-gray-300"><strong className="text-amber-300">Importante:</strong> enviar la solicitud no confirma ni bloquea la fecha.</div>
              <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-white/10"><button type="button" onClick={() => setCurrentStep(1)} className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-300 text-xs font-semibold flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" />Regresar</button><button type="button" onClick={handleSendRequest} disabled={!bookingState.clientName || !bookingState.clientEmail || !bookingState.clientPhone || sending} className="px-6 py-3 rounded-xl gold-gradient-bg text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}{sending ? 'Registrando solicitud…' : 'Enviar solicitud por WhatsApp'}</button></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
