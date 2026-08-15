import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Calendar as CalendarIcon, CheckCircle2, FileText, Loader2, MessageCircle } from 'lucide-react';
import { BookingState, PackageOption, AddOnOption, EventType } from '../types';
import { PACKAGES_BY_EVENT, ADDONS_CATALOG } from '../data/packages';
import { loadSiteDataFromCloud } from '../utils/googleDrive';
import { submitPublicLead } from '../utils/adminApi';

interface Props {
  bookingState: BookingState;
  onUpdateBookingState: (updater: (prev: BookingState) => BookingState) => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'success' | 'warning') => void;
  packages?: Record<EventType, PackageOption[]>;
  addons?: AddOnOption[];
}

const EVENT_LABELS: Record<EventType, string> = {
  bodas: 'BODAS',
  'xv-anos': 'XV AÑOS',
  bautizos: 'BAUTIZOS & FAMILIA',
  retratos: 'RETRATOS & EDITORIAL',
  empresarial: 'EMPRESARIAL & BRANDING',
};

export const BookingWizardV2: React.FC<Props> = ({
  bookingState,
  onUpdateBookingState,
  onShowToast,
  packages = PACKAGES_BY_EVENT,
  addons = ADDONS_CATALOG,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [sending, setSending] = useState(false);

  const currentPackages = packages[bookingState.eventType] || [];
  const selectedPackage = currentPackages.find((pkg) => pkg.id === bookingState.selectedPackageId);
  const selectedAddons = bookingState.selectedAddons
    .map((id) => addons.find((addon) => addon.id === id))
    .filter((addon): addon is AddOnOption => Boolean(addon));
  const total = selectedPackage ? Math.max(0, bookingState.total || 0) : 0;
  const deposit = Math.round(total * 0.4);

  const cleanWhatsAppNumber = (value?: string) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) return `52${digits}`;
    if (digits.startsWith('52')) return digits;
    return digits || '525615567863';
  };

  const handleSendRequest = async () => {
    if (!selectedPackage) {
      onShowToast('Selecciona un paquete', 'Elige primero el paquete que quieres cotizar.', 'warning');
      document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
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
      const activeAddonNames = selectedAddons.map((addon) => `${addon.name} (+$${addon.price.toLocaleString('es-MX')} MXN)`);
      if (bookingState.extraHours > 0) {
        const rate = addons.find((addon) => addon.id === 'extra_hours')?.price || 0;
        activeAddonNames.push(`${bookingState.extraHours} hora${bookingState.extraHours === 1 ? '' : 's'} extra (+$${(rate * bookingState.extraHours).toLocaleString('es-MX')} MXN)`);
      }

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
        total,
        depositAmount: deposit,
        eventDate: bookingState.date,
        eventCity: bookingState.eventCity || 'Por definir',
        status: 'Pendiente',
        createdAt: new Date().toISOString().split('T')[0],
        notes: bookingState.notes || 'Solicitud de cotización enviada desde la web.',
      };

      await submitPublicLead(requestRecord);

      const included = selectedPackage.features.length
        ? selectedPackage.features.map((feature) => `• ${feature}`).join('\n')
        : '• Entregables por definir';
      const addonsText = activeAddonNames.length
        ? activeAddonNames.map((addon) => `• ${addon}`).join('\n')
        : '• Ninguno';

      const message = `Hola XPH Fotografía & Video. Quisiera solicitar disponibilidad y cotización.\n\n📸 EVENTO\n${EVENT_LABELS[bookingState.eventType]}\n\n📦 PAQUETE\n${selectedPackage.name}\nPrecio base: $${selectedPackage.price.toLocaleString('es-MX')} MXN\n\n✅ INCLUYE\n${included}\n\n✨ COMPLEMENTOS\n${addonsText}\n\n💰 RESUMEN\nTotal estimado: $${total.toLocaleString('es-MX')} MXN\nAnticipo 40%: $${deposit.toLocaleString('es-MX')} MXN\n\n🗓️ Fecha tentativa: ${bookingState.date}\n📍 Lugar: ${bookingState.eventCity || 'Por definir'}\n👤 Nombre: ${bookingState.clientName}\n📱 WhatsApp: ${bookingState.clientPhone}\n✉️ Correo: ${bookingState.clientEmail}${bookingState.notes ? `\n📝 Notas: ${bookingState.notes}` : ''}\n\nQuedo pendiente de confirmación de disponibilidad.`;

      const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      if (whatsappWindow) whatsappWindow.location.href = url;
      else window.location.href = url;
      onShowToast('Solicitud registrada', 'Se preparó tu cotización y el mensaje completo de WhatsApp.', 'success');
    } catch (error: any) {
      whatsappWindow?.close();
      onShowToast('No se pudo enviar la solicitud', error?.message || 'Revisa la conexión e intenta nuevamente.', 'warning');
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="solicitud" className="py-20 bg-[#0B0F17] relative border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold font-mono">SOLICITA TU COTIZACIÓN</span>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif-luxury text-white">Confirma tus datos en 2 pasos</h2>
          <p className="text-gray-300 text-sm max-w-2xl mx-auto">Primero indícanos la fecha tentativa y después tus datos. Al finalizar se abrirá WhatsApp con el resumen completo.</p>
        </div>

        {!selectedPackage && <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 text-center"><p className="text-sm text-amber-200">Aún no has seleccionado un paquete.</p><button type="button" onClick={() => document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth' })} className="mt-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white">Ir a paquetes</button></div>}

        <div className="grid grid-cols-2 gap-2 sm:gap-4 p-2 rounded-2xl bg-[#161C28] border border-white/10">
          <button type="button" onClick={() => setCurrentStep(1)} className={`p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold ${currentStep === 1 ? 'gold-gradient-bg text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><CalendarIcon className="w-4 h-4" />1. Fecha</button>
          <button type="button" onClick={() => setCurrentStep(2)} className={`p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold ${currentStep === 2 ? 'gold-gradient-bg text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><FileText className="w-4 h-4" />2. Datos</button>
        </div>

        <div className="p-5 sm:p-8 lg:p-10 rounded-2xl bg-[#161C28] border border-white/10 shadow-2xl">
          {currentStep === 1 ? (
            <div className="space-y-6">
              <div><h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-[#D4AF37]" />Fecha tentativa del evento</h3><p className="text-xs text-gray-400 mt-1">La fecha queda pendiente de confirmación personal.</p></div>
              <div className="grid sm:grid-cols-2 gap-6">
                <label className="p-5 rounded-2xl bg-[#0B0F17] border border-white/10 text-xs font-semibold text-gray-300">Fecha tentativa *<input type="date" value={bookingState.date} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, date: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-[#161C28] border border-white/20 text-white font-mono text-sm" /></label>
                <div className="p-5 rounded-2xl bg-[#0B0F17] border border-white/10 flex items-center gap-3">{bookingState.date ? <><CheckCircle2 className="w-5 h-5 text-[#D4AF37]" /><div><p className="text-sm font-bold text-white">Fecha seleccionada</p><p className="text-xs text-gray-400">{bookingState.date}</p></div></> : <><AlertCircle className="w-5 h-5 text-gray-500" /><p className="text-xs text-gray-400">Selecciona una fecha para continuar.</p></>}</div>
              </div>
              <div className="flex justify-end pt-4 border-t border-white/10"><button type="button" onClick={() => setCurrentStep(2)} disabled={!bookingState.date} className="px-6 py-3 rounded-xl gold-gradient-bg text-black font-bold text-xs flex items-center gap-2 disabled:opacity-40">Continuar<ArrowRight className="w-4 h-4" /></button></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div><h3 className="text-xl font-bold font-serif-luxury text-white">Datos de contacto</h3><p className="text-xs text-gray-400 mt-1">Usaremos estos datos únicamente para dar seguimiento a tu solicitud.</p></div>
              {selectedPackage && <div className="p-5 rounded-2xl bg-[#0B0F17] border border-white/10 grid sm:grid-cols-3 gap-4 text-xs"><div><span className="text-gray-500">Paquete</span><p className="text-white font-semibold mt-1">{selectedPackage.name}</p></div><div><span className="text-gray-500">Total</span><p className="text-white font-mono font-bold mt-1">${total.toLocaleString('es-MX')} MXN</p></div><div><span className="text-gray-500">Anticipo 40%</span><p className="text-[#D4AF37] font-mono font-bold mt-1">${deposit.toLocaleString('es-MX')} MXN</p></div></div>}
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-xs text-gray-300">Nombre completo *<input type="text" value={bookingState.clientName} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, clientName: e.target.value }))} className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white" /></label>
                <label className="text-xs text-gray-300">Correo electrónico *<input type="email" value={bookingState.clientEmail} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, clientEmail: e.target.value }))} className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white" /></label>
                <label className="text-xs text-gray-300">WhatsApp *<input type="tel" value={bookingState.clientPhone} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, clientPhone: e.target.value }))} className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white" /></label>
                <label className="text-xs text-gray-300">Ciudad / locación<input type="text" value={bookingState.eventCity} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, eventCity: e.target.value }))} className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white" /></label>
              </div>
              <label className="text-xs text-gray-300 block">Notas adicionales<textarea value={bookingState.notes} onChange={(e) => onUpdateBookingState((prev) => ({ ...prev, notes: e.target.value }))} rows={3} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#0B0F17] border border-white/15 text-white resize-y" /></label>
              <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-white/10"><button type="button" onClick={() => setCurrentStep(1)} className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-300 text-xs font-semibold flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" />Regresar</button><button type="button" onClick={handleSendRequest} disabled={!selectedPackage || !bookingState.date || !bookingState.clientName || !bookingState.clientEmail || !bookingState.clientPhone || sending} className="px-6 py-3 rounded-xl gold-gradient-bg text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}{sending ? 'Preparando…' : 'Enviar cotización por WhatsApp'}</button></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
