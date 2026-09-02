import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { loadPublicContract, publicContractPdfUrl, signPublicContract } from '../utils/adminApi';
import { BusinessContract } from '../types/business';
import { SignaturePad } from './SignaturePad';
import { ContractDocument } from './ContractDocument';

interface Props {
  token: string;
}

type PublicContract = Pick<BusinessContract, 'id' | 'clientName' | 'folio' | 'eventType' | 'eventDate' | 'status' | 'expiresAt' | 'documentType' | 'documentSnapshot' | 'identificationFileName' | 'identificationUploadedAt'>;

const safeContractPdfUrl = (token: string) => publicContractPdfUrl(token).replace(/^\/api\/proxy(?=\?|$)/, '/api/proxy-safe');

export const MobileContractSigningPage: React.FC<Props> = ({ token }) => {
  const [contract, setContract] = useState<PublicContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState<'read' | 'sign' | 'done'>('read');
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sessionId] = useState(() => {
    const key = `xph-contract-session:${token}`;
    try {
      const current = sessionStorage.getItem(key);
      if (current) return current;
      const created = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, created);
      return created;
    } catch (_) { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  });

  useEffect(() => {
    loadPublicContract(token, sessionId)
      .then((result) => setContract(result.contract))
      .catch((reason: any) => setError(reason?.message || 'La liga no está disponible.'))
      .finally(() => setLoading(false));
  }, [token, sessionId]);

  const submit = async () => {
    if (!signature || !accepted) return;
    setSubmitting(true);
    try {
      await signPublicContract(token, signature, accepted);
      setStep('done');
    } catch (reason: any) {
      setError(reason?.message || 'No se pudo guardar la firma. Solicita una liga nueva a Xavi.ph.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <MobileShell><Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" /><p className="text-sm text-gray-400">Preparando tu contrato…</p></MobileShell>;
  if (error) return <MobileShell><AlertTriangle className="h-10 w-10 text-amber-400" /><h1 className="text-xl font-bold">Esta liga ya no puede utilizarse</h1><p className="max-w-sm text-center text-sm leading-6 text-gray-400">{error}</p><p className="max-w-sm text-center text-xs text-gray-500">Pide a Javier García una nueva liga de firma por WhatsApp.</p></MobileShell>;
  if (!contract) return null;
  if (step === 'done') return <MobileShell><CheckCircle2 className="h-12 w-12 text-emerald-400" /><h1 className="text-2xl font-bold">Firma recibida</h1><p className="max-w-sm text-center text-sm leading-6 text-gray-300">Gracias, {contract.clientName}. Javier revisará y autorizará el documento para finalizarlo.</p><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">Folio {contract.folio}</div></MobileShell>;

  return (
    <main className="min-h-screen bg-[#0B0F17] px-3 py-4 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[900px] space-y-4">
        <header className="rounded-2xl border border-white/10 bg-[#161C28] p-4">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-[#D4AF37]/10 p-2 text-[#D4AF37]"><FileText className="h-5 w-5" /></div><div><p className="text-[10px] uppercase tracking-[.2em] text-[#D4AF37]">Xavi.ph · firma privada</p><h1 className="font-semibold">Contrato {contract.folio}</h1></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400"><span>{contract.clientName}</span><span className="text-right">{contract.eventDate || 'Fecha por confirmar'}</span><span>{contract.eventType}</span><span className="text-right">Liga protegida</span></div>
        </header>

        {step === 'read' && <>
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white">{contract.documentSnapshot ? <ContractDocument snapshot={contract.documentSnapshot} folio={contract.folio} /> : <iframe title={`Contrato ${contract.folio}`} src={safeContractPdfUrl(token)} className="h-[66vh] w-full bg-white" />}</section>
          <section className="space-y-4 rounded-2xl border border-white/10 bg-[#161C28] p-4">
            <div className="flex gap-3 text-xs leading-5 text-gray-300"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]" /><p>Lee el documento completo. Tu aceptación y firma se guardarán con fecha, hora y datos técnicos de esta sesión como evidencia.</p></div>
            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#D4AF37]" /><span>He leído el contrato completo, comprendo su contenido y acepto sus términos.</span></label>
            <button onClick={() => setStep('sign')} disabled={!accepted} className="w-full rounded-xl bg-[#D4AF37] px-4 py-3.5 font-bold text-black disabled:cursor-not-allowed disabled:opacity-35">Aceptar y continuar a la firma</button>
          </section>
        </>}

        {step === 'sign' && <section className="space-y-5 rounded-2xl border border-white/10 bg-[#161C28] p-4">
          <div><p className="text-xs uppercase tracking-widest text-[#D4AF37]">Último paso</p><h2 className="mt-1 text-xl font-bold">Firma con tu dedo</h2><p className="mt-1 text-sm leading-6 text-gray-400">Procura que tu firma quede completa dentro del recuadro blanco.</p></div>
          <SignaturePad onChange={setSignature} label="Firma del cliente" />
          <div className="grid grid-cols-2 gap-2"><button onClick={() => setStep('read')} className="rounded-xl border border-white/15 px-4 py-3 text-sm">Volver a leer</button><button onClick={submit} disabled={!signature || submitting} className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black disabled:opacity-35">{submitting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Firmar contrato'}</button></div>
          <p className="text-center text-[11px] leading-5 text-gray-500">La liga quedará cancelada después de firmar y no podrá reutilizarse.</p>
        </section>}
      </div>
    </main>
  );
};

const MobileShell = ({ children }: { children: React.ReactNode }) => <main className="min-h-screen bg-[#0B0F17] px-5 text-white"><div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4">{children}</div></main>;
