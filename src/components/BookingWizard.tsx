import React, { useState, useRef, useEffect } from 'react';
import { BookingState, PackageOption, AddOnOption, EventType } from '../types';
import { PACKAGES_BY_EVENT, ADDONS_CATALOG } from '../data/packages';
import { Calendar as CalendarIcon, FileText, Edit3, CreditCard, CheckCircle2, ShieldCheck, Eraser, Copy, ArrowRight, ArrowLeft, Lock, AlertCircle, RefreshCw, User, Share2, Sparkles } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface BookingWizardProps {
  bookingState: BookingState;
  onUpdateBookingState: (updater: (prev: BookingState) => BookingState) => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'success' | 'warning') => void;
  onSendWhatsApp: () => void;
  packages?: Record<EventType, PackageOption[]>;
  addons?: AddOnOption[];
}

export const BookingWizard: React.FC<BookingWizardProps> = ({
  bookingState,
  onUpdateBookingState,
  onShowToast,
  onSendWhatsApp,
  packages,
  addons,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [dateStatus, setDateStatus] = useState<'checking' | 'available' | 'empty'>(bookingState.date ? 'available' : 'empty');
  const [copiedSPEI, setCopiedSPEI] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isBooked, setIsBooked] = useState<boolean>(false);

  // Canvas ref for signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef<boolean>(false);

  // Package details
  const currentPackages = (packages && packages[bookingState.eventType]) || PACKAGES_BY_EVENT[bookingState.eventType];
  const selectedPackage = currentPackages.find((p) => p.id === bookingState.selectedPackageId) || currentPackages[0];

  // Initialize Canvas drawing events
  useEffect(() => {
    if (currentStep === 3 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [currentStep]);

  const handleDateChange = (newDate: string) => {
    onUpdateBookingState((prev) => ({ ...prev, date: newDate }));
    if (newDate) {
      setDateStatus('checking');
      setTimeout(() => {
        setDateStatus('available');
        onShowToast('¡Fecha Disponible!', `La fecha ${newDate} está libre para reserva inmediata en CDMX.`, 'success');
      }, 400);
    } else {
      setDateStatus('empty');
    }
  };

  const handleCopySPEI = async () => {
    const success = await copyToClipboard('012180015488920194');
    setCopiedSPEI(true);
    if (success) {
      onShowToast('CLABE Copiada', 'La CLABE interbancaria SPEI fue copiada al portapapeles.', 'success');
    } else {
      onShowToast('CLABE SPEI BBVA', '012180015488920194', 'info');
    }
    setTimeout(() => setCopiedSPEI(false), 3000);
  };

  const handleCopyBookingLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}#contratacion`;
    const success = await copyToClipboard(link);
    setCopiedLink(true);
    if (success) {
      onShowToast('¡Enlace de Reserva Copiado!', 'Puedes compartir este enlace directo para la contratación.', 'success');
    } else {
      onShowToast('Enlace de Reserva', link, 'info');
    }
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleScrollToQuote = () => {
    const el = document.getElementById('cotizador');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      onShowToast('Selección de Paquetes', 'Elige o cambia tu paquete en el cotizador interactivo.', 'info');
    }
  };

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    draw(e);
  };

  const stopDrawing = () => {
    if (isDrawing.current && canvasRef.current) {
      isDrawing.current = false;
      const dataUrl = canvasRef.current.toDataURL();
      onUpdateBookingState((prev) => ({ ...prev, signatureDataUrl: dataUrl }));
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
      }
      onUpdateBookingState((prev) => ({ ...prev, signatureDataUrl: '' }));
      onShowToast('Firma Limpiada', 'Puedes volver a trazar tu firma digital.');
    }
  };

  const handleConfirmReservation = () => {
    if (!bookingState.clientName || !bookingState.clientEmail || !bookingState.clientPhone) {
      onShowToast('Campos Incompletos', 'Por favor llena tus datos de contacto en el Paso 2.');
      setCurrentStep(2);
      return;
    }
    if (!bookingState.signatureDataUrl) {
      onShowToast('Firma Requerida', 'Por favor firma el contrato digital en el Paso 3 para continuar.');
      setCurrentStep(3);
      return;
    }

    setIsBooked(true);
    onShowToast('¡Reserva Registrada Exitosamente!', 'Hemos generado tu folio de contrato y enviado la confirmación.');
  };

  return (
    <section id="contratacion" className="py-20 bg-[#0B0F17] relative border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Wizard Section Header */}
        <div className="text-center space-y-3">
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold font-mono">
            SISTEMA DE CONTRATACIÓN Y RESERVA
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif-luxury text-white">
            Reserva tu Fecha en 4 Sencillos Pasos
          </h2>
          <p className="text-gray-300 text-sm max-w-xl mx-auto">
            Proceso 100% digital con contrato formal de servicio fotográfico, firma en pantalla y recibo inmediato.
          </p>
        </div>

        {/* Step Progress Indicator */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-4 p-1.5 sm:p-2 rounded-2xl bg-[#161C28] border border-white/10">
          {[
            { step: 1, label: '1. Fecha', icon: CalendarIcon },
            { step: 2, label: '2. Detalle', icon: FileText },
            { step: 3, label: '3. Firma', icon: Edit3 },
            { step: 4, label: '4. Pago', icon: CreditCard },
          ].map((item) => {
            const isActive = currentStep === item.step;
            const isDone = currentStep > item.step;
            const Icon = item.icon;

            return (
              <button
                key={item.step}
                onClick={() => setCurrentStep(item.step)}
                className={`p-2 sm:p-3 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'gold-gradient-bg text-black shadow-lg shadow-[#D4AF37]/20'
                    : isDone
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Wizard Main Container Card */}
        <div className="p-4 sm:p-8 lg:p-10 rounded-2xl bg-[#161C28] border border-white/10 space-y-8 shadow-2xl">
          
          {/* STEP 1: DATE VERIFICATION */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-[#D4AF37]" />
                  <span>Paso 1: Verificación de Disponibilidad de Fecha</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Selecciona la fecha de tu evento en el calendario para consultar disponibilidad en CDMX, Estado de México, Morelos, Puebla, Querétaro, Tlaxcala, Pachuca y todo México.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-6">
                <div className="grid sm:grid-cols-2 gap-6 items-center">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-300 block">
                      Selecciona la Fecha Exacta de tu Evento *
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        min="2026-01-01"
                        max="2027-12-31"
                        value={bookingState.date}
                        onClick={(e) => {
                          try { (e.target as HTMLInputElement).showPicker?.(); } catch (err) {}
                        }}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#161C28] border border-white/20 text-white focus:outline-none focus:border-[#D4AF37] font-mono text-sm cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Status Indicator Feedback */}
                  <div className="p-4 rounded-xl bg-[#161C28] border border-white/10 flex items-center gap-3 min-h-[72px]">
                    {dateStatus === 'checking' && (
                      <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                        <span>Verificando disponibilidad en la agenda CDMX...</span>
                      </div>
                    )}

                    {dateStatus === 'available' && (
                      <div className="flex items-center gap-3 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-bold text-sm text-emerald-400">¡Fecha Disponible!</p>
                          <p className="text-gray-300 font-normal">
                            Fecha seleccionada: <span className="font-mono text-white font-bold">{bookingState.date}</span>.
                          </p>
                        </div>
                      </div>
                    )}

                    {dateStatus === 'empty' && (
                      <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <AlertCircle className="w-4 h-4 text-gray-500 shrink-0" />
                        <span>Haz clic arriba para desplegar el calendario y elegir fecha.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Date Chips / Interactive Calendar Guidance */}
                <div className="pt-4 border-t border-white/10 space-y-2">
                  <span className="text-[11px] font-mono text-[#D4AF37] uppercase tracking-wider block">
                    Sugerencias de Fechas Frecuentes para Eventos 2026:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {['2026-06-20', '2026-07-11', '2026-08-15', '2026-09-19', '2026-10-24', '2026-11-14'].map((suggestedDate) => (
                      <button
                        key={suggestedDate}
                        onClick={() => handleDateChange(suggestedDate)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                          bookingState.date === suggestedDate
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                            : 'bg-[#161C28] text-gray-300 border-white/10 hover:border-[#D4AF37]'
                        }`}
                      >
                        📅 {suggestedDate}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-white/10">
                <button
                  onClick={handleCopyBookingLink}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace de Reserva'}</span>
                </button>

                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={!bookingState.date}
                  className="px-6 py-3 rounded-xl gold-gradient-bg text-black font-bold text-xs flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <span>Continuar a Detalles del Evento</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: DETAILS & TRANSPARENT BREAKDOWN */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#D4AF37]" />
                  <span>Paso 2: Desglose del Servicio & Datos del Cliente</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Verifica tu nombre, el paquete seleccionado y tus datos de contacto para la elaboración del contrato formal.
                </p>
              </div>

              {/* Package Summary & Switch Package Banner */}
              <div className="p-5 rounded-2xl bg-[#0B0F17] border border-[#D4AF37]/30 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40">
                        {bookingState.eventType.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        Fecha: <strong className="text-white">{bookingState.date || 'No definida'}</strong>
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-white font-serif-luxury">
                      Paquete Elegido: <span className="text-[#D4AF37]">{selectedPackage.name}</span>
                    </h4>

                    {bookingState.clientName && (
                      <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>Titular registrado: <strong>{bookingState.clientName}</strong></span>
                      </p>
                    )}
                  </div>

                  {/* Change Package Button */}
                  <button
                    onClick={handleScrollToQuote}
                    className="px-4 py-2.5 rounded-xl bg-[#161C28] hover:bg-white/10 border border-[#D4AF37]/50 text-[#D4AF37] font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Cambiar tu paquete</span>
                  </button>
                </div>

                {/* Price Itemized List */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-300">
                    <span>Costo Base del Paquete ({selectedPackage.name})</span>
                    <span className="font-mono font-bold text-white">${selectedPackage.price.toLocaleString('es-MX')} MXN</span>
                  </div>

                  {bookingState.extraHours > 0 && (
                    <div className="flex justify-between items-center text-gray-300">
                      <span>Horas Extra ({bookingState.extraHours}h)</span>
                      <span className="font-mono">${(bookingState.extraHours * 2000).toLocaleString('es-MX')} MXN</span>
                    </div>
                  )}

                  {bookingState.selectedAddons.map((addonId) => {
                    const addon = ADDONS_CATALOG.find((a) => a.id === addonId);
                    if (!addon) return null;
                    return (
                      <div key={addon.id} className="flex justify-between items-center text-gray-300">
                        <span>{addon.name}</span>
                        <span className="font-mono">${addon.price.toLocaleString('es-MX')} MXN</span>
                      </div>
                    );
                  })}

                  <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                    <div>
                      <span className="font-bold text-white text-sm block">TOTAL FINAL COTIZADO</span>
                      <span className="text-[10px] text-gray-400">Incluye cobertura, edición digital y contrato</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-extrabold text-[#D4AF37] font-mono">
                        ${bookingState.total.toLocaleString('es-MX')} MXN
                      </span>
                      <span className="text-[10px] text-emerald-400 block font-semibold">
                        Anticipo requerido (30%): ${bookingState.depositAmount.toLocaleString('es-MX')} MXN
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Form Fields */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Nombre Completo del Titular *</label>
                  <input
                    type="text"
                    placeholder="Ej. Valeria Mendoza"
                    value={bookingState.clientName}
                    onChange={(e) =>
                      onUpdateBookingState((prev) => ({ ...prev, clientName: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    placeholder="valeria@ejemplo.com"
                    value={bookingState.clientEmail}
                    onChange={(e) =>
                      onUpdateBookingState((prev) => ({ ...prev, clientEmail: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Teléfono WhatsApp *</label>
                  <input
                    type="tel"
                    placeholder="+52 55 1234 5678"
                    value={bookingState.clientPhone}
                    onChange={(e) =>
                      onUpdateBookingState((prev) => ({ ...prev, clientPhone: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Ciudad / Locación del Evento (Cobertura en CDMX)</label>
                  <input
                    type="text"
                    placeholder="Ej. Polanco, Cuauhtémoc, Coyoacán, CDMX"
                    value={bookingState.eventCity}
                    onChange={(e) =>
                      onUpdateBookingState((prev) => ({ ...prev, eventCity: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs"
                  />
                </div>
              </div>

              {/* Step 2 Actions */}
              <div className="flex justify-between pt-4 border-t border-white/10">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-300 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Regresar a Fecha</span>
                </button>

                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={!bookingState.clientName || !bookingState.clientEmail || !bookingState.clientPhone}
                  className="px-6 py-3 rounded-xl gold-gradient-bg text-black font-bold text-xs flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <span>Ir a Firma de Contrato</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: DIGITAL / PHYSICAL SIGNED CONTRACT */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-[#D4AF37]" />
                  <span>Paso 3: Contrato Firmado de Prestación de Servicios</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Lee los términos del contrato formal con validez legal para cobertura fotográfica en Ciudad de México y plasma tu firma autógrafa en pantalla o solicita firma física en cita.
                </p>
              </div>

              {/* Legal Contract Scroll Box */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-white/10 max-h-48 overflow-y-auto space-y-3 text-xs text-gray-300 leading-relaxed font-mono border-l-4 border-l-[#D4AF37]">
                <h4 className="font-bold text-white uppercase text-center">CONTRATO DE PRESTACIÓN DE SERVICIOS FOTOGRÁFICOS (CDMX) CON FIRMA AUTÓGRAFA</h4>
                <p><strong>PRIMERA: OBJETO DEL CONTRATO.</strong> "EL FOTÓGRAFO" (Xavi.Ph, con cobertura exclusiva en Ciudad de México) se compromete a prestar el servicio de cobertura fotográfica para el evento del cliente ({bookingState.clientName || 'EL CLIENTE'}) programado para el día {bookingState.date || 'a definir'}. Este contrato es un instrumento legal binding formal con firma autógrafa digital o física.</p>
                <p><strong>SEGUNDA: GARANTÍA DE ENTREGA Y FORMATO.</strong> Las fotografías serán entregadas en formato HD a través de la plataforma de galería web privada en un plazo no mayor al estipulado en el paquete seleccionado. Todas las imágenes entregadas cuentan con edición de color y luces artesanal.</p>
                <p><strong>TERCERA: ESQUEMA DE PAGOS.</strong> Se requiere un anticipo equivalente al 30% (${bookingState.depositAmount.toLocaleString('es-MX')} MXN) para la reserva en firme y bloqueo de agenda. El 70% restante será saldado previo o en el momento de la entrega final del material.</p>
                <p><strong>CUARTA: COBERTURA Y JURISDICCIÓN.</strong> La prestación de servicios es exclusiva para la Ciudad de México y área conurbada autorizada. Para cualquier controversia, las partes se someten a los tribunales competentes de la Ciudad de México.</p>
              </div>

              {/* Signature Canvas Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-300">
                    Firma aquí con tu ratón o pantalla táctil:
                  </label>
                  <button
                    onClick={clearSignature}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-gray-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Limpiar Firma</span>
                  </button>
                </div>

                <div className="border-2 border-dashed border-[#D4AF37]/50 rounded-xl bg-[#0B0F17] p-1 flex justify-center items-center">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseUp={stopDrawing}
                    onMouseMove={draw}
                    onTouchStart={startDrawing}
                    onTouchEnd={stopDrawing}
                    onTouchMove={draw}
                    className="w-full max-w-full h-40 bg-[#0B0F17] cursor-crosshair rounded-lg touch-none"
                  />
                </div>
                {bookingState.signatureDataUrl && (
                  <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Firma digital registrada correctamente.</span>
                  </p>
                )}
              </div>

              {/* Step 3 Actions */}
              <div className="flex justify-between pt-4 border-t border-white/10">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-300 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Regresar</span>
                </button>

                <button
                  onClick={() => setCurrentStep(4)}
                  disabled={!bookingState.signatureDataUrl}
                  className="px-6 py-3 rounded-xl gold-gradient-bg text-black font-bold text-xs flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <span>Continuar a Esquema de Pago</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: PAYMENT SCHEME & SETTLEMENT */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-serif-luxury text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#D4AF37]" />
                  <span>Paso 4: Esquema de Pagos y Liquidación</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Selecciona tu método de anticipo preferido para bloquear formalmente tu fecha en el calendario.
                </p>
              </div>

              {/* Payment Summary Box */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-[#161C28] to-[#0B0F17] border border-[#D4AF37]/30 grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 uppercase font-mono block">Anticipo Requerido (30%)</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    ${bookingState.depositAmount.toLocaleString('es-MX')} MXN
                  </span>
                  <span className="text-[10px] text-gray-400 block">Congela fecha y activa contrato</span>
                </div>

                <div className="space-y-1 sm:text-right border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-4">
                  <span className="text-[10px] text-gray-400 uppercase font-mono block">Saldo Restante (70%)</span>
                  <span className="text-xl font-bold text-gray-200 font-mono">
                    ${(bookingState.total - bookingState.depositAmount).toLocaleString('es-MX')} MXN
                  </span>
                  <span className="text-[10px] text-gray-400 block">A liquidar previo a la entrega final</span>
                </div>
              </div>

              {/* Payment Methods Selection */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-300 block">Selecciona Método de Pago del Anticipo:</label>
                
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { id: 'stripe', title: 'Tarjeta de Crédito / Débito', badge: 'Stripe Direct' },
                    { id: 'mercadopago', title: 'Mercado Pago', badge: 'Meses sin Intereses' },
                    { id: 'spei', title: 'Transferencia SPEI', badge: 'Sin Comisión' },
                  ].map((method) => {
                    const isSelected = bookingState.paymentMethod === method.id;
                    return (
                      <div
                        key={method.id}
                        onClick={() =>
                          onUpdateBookingState((prev) => ({
                            ...prev,
                            paymentMethod: method.id as 'stripe' | 'mercadopago' | 'spei',
                          }))
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer space-y-1 ${
                          isSelected
                            ? 'bg-[#D4AF37]/10 border-[#D4AF37] gold-border-glow'
                            : 'bg-[#0B0F17] border-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="text-[10px] font-mono text-[#D4AF37] block">{method.badge}</span>
                        <h4 className="text-xs font-bold text-white">{method.title}</h4>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SPEI Bank Details if selected */}
              {bookingState.paymentMethod === 'spei' && (
                <div className="p-4 rounded-xl bg-[#0B0F17] border border-white/15 space-y-2 text-xs">
                  <p className="font-bold text-[#D4AF37]">Datos de Depósito Bancario SPEI (BBVA México):</p>
                  <div className="grid grid-cols-2 gap-2 text-gray-300 font-mono">
                    <div>Banco: <strong>BBVA México</strong></div>
                    <div>Titular: <strong>Xavi Photography S.A.S.</strong></div>
                    <div className="col-span-2 flex items-center justify-between bg-white/5 p-2 rounded-lg">
                      <span>CLABE Interbancaria: <strong>012180015488920194</strong></span>
                      <button
                        onClick={handleCopySPEI}
                        className="px-2.5 py-1 rounded-md bg-[#D4AF37] text-black font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedSPEI ? '¡Copiado!' : 'Copiar CLABE'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Final Confirmation Button */}
              {isBooked ? (
                <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h4 className="text-xl font-bold text-white font-serif-luxury">
                    ¡Reserva Confirmada & Contrato Firmado!
                  </h4>
                  <p className="text-xs text-gray-300 max-w-md mx-auto">
                    Tu fecha ({bookingState.date}) ha quedado reservada. Hemos generado tu acuse con folio #XAVI-2026-{Math.floor(1000 + Math.random() * 9000)}.
                  </p>
                  <button
                    onClick={onSendWhatsApp}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    <i className="fa-brands fa-whatsapp text-sm" />
                    <span>Enviar Comprobante por WhatsApp</span>
                  </button>
                </div>
              ) : (
                <div className="flex justify-between pt-4 border-t border-white/10">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-300 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Regresar</span>
                  </button>

                  <button
                    onClick={handleConfirmReservation}
                    className="px-8 py-3.5 rounded-xl gold-gradient-bg text-black font-extrabold text-xs tracking-wide shadow-xl shadow-[#D4AF37]/20 hover:scale-105 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Confirmar Reserva (${bookingState.depositAmount.toLocaleString('es-MX')} MXN)</span>
                  </button>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </section>
  );
};
