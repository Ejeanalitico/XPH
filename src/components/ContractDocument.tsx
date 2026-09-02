import React from 'react';
import { ContractDocumentSnapshot } from '../types/business';

const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));
const date = (value: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || 'Por confirmar';
};
const time = (value: string) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value || 'Por confirmar';
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'p. m.' : 'a. m.'}`;
};

export const ContractDocument = ({ snapshot, folio }: { snapshot: ContractDocumentSnapshot; folio: string }) => (
  <article className="mx-auto w-full max-w-[850px] overflow-hidden bg-white text-[#171717] shadow-2xl print:max-w-none print:shadow-none">
    <header className="border-b-[5px] border-[#D4AF37] bg-[#11151d] px-6 py-7 text-white sm:px-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[.28em] text-[#D4AF37]">Xavi.ph</p><p className="mt-1 text-sm uppercase tracking-[.12em] text-gray-300">Fotografía &amp; producción audiovisual</p></div>
        <div className="sm:text-right"><h1 className="font-serif text-3xl font-bold tracking-wide">{snapshot.documentType === 'COTIZACION' ? 'COTIZACIÓN' : 'CONTRATO DE SERVICIOS'}</h1><p className="mt-1 text-sm text-gray-300">Folio {folio}</p></div>
      </div>
    </header>

    <div className="space-y-8 px-6 py-8 text-[15px] leading-6 sm:px-10">
      <section className="grid gap-4 border-b border-gray-200 pb-7 sm:grid-cols-3">
        <Info label="Cliente" value={snapshot.client.name} />
        <Info label="Tipo de evento" value={snapshot.event.type} />
        <Info label="Fecha de emisión" value={date(snapshot.issuedAt)} />
        <Info label="Teléfono" value={snapshot.client.phone || 'No registrado'} />
        <Info label="Correo" value={snapshot.client.email || 'No registrado'} />
        <Info label="Festejado(s)" value={snapshot.client.honoreeName || 'No aplica'} />
      </section>

      <Section title="Información del evento">
        <div className="grid gap-4 rounded-xl bg-[#f5f2e9] p-5 sm:grid-cols-2">
          <Info label="Fecha y hora" value={`${date(snapshot.event.date)} · ${time(snapshot.event.time)}`} />
          <Info label="Cobertura" value={snapshot.event.serviceHours ? `${snapshot.event.serviceHours} horas` : 'Por confirmar'} />
          <div className="sm:col-span-2"><Info label="Lugar" value={snapshot.event.location || 'Por confirmar'} /></div>
        </div>
      </Section>

      <Section title="Servicio contratado">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-3"><strong className="text-lg">{snapshot.commercial.packageName || 'Servicio personalizado'}</strong><strong>{money(snapshot.commercial.packageBase)}</strong></div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">{snapshot.services.map((service, index) => <li key={`${service.concept}-${index}`} className="flex gap-2"><span className="text-[#b18a08]">✓</span><span>{service.concept}{service.quantity > 1 ? ` · ${service.quantity}` : ''}{service.notes ? ` — ${service.notes}` : ''}</span></li>)}{!snapshot.services.length && <li className="text-gray-500">Servicios por especificar.</li>}</ul>
      </Section>

      {!!snapshot.addons.length && <Section title="Adicionales">
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left"><thead className="bg-[#11151d] text-xs uppercase tracking-wider text-[#f4d35e]"><tr><th className="p-3">Concepto</th><th className="p-3">Cantidad</th><th className="p-3">Unitario</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{snapshot.addons.map((addon, index) => <tr key={`${addon.concept}-${index}`} className="border-b border-gray-200"><td className="p-3">{addon.concept}</td><td className="p-3">{addon.quantity}</td><td className="p-3">{money(addon.unitPrice)}</td><td className="p-3 text-right font-semibold">{money(addon.total)}</td></tr>)}</tbody></table></div>
      </Section>}

      <Section title="Inversión">
        <dl className="ml-auto max-w-md space-y-2 rounded-xl border border-[#D4AF37]/40 p-5"><Amount label="Paquete" value={snapshot.commercial.packageBase} /><Amount label="Adicionales" value={snapshot.commercial.additions} />{snapshot.commercial.discount > 0 && <Amount label="Descuento / promoción" value={-snapshot.commercial.discount} />}<div className="mt-3 flex justify-between border-t-2 border-[#11151d] pt-3 text-xl font-bold"><dt>Total contratado</dt><dd>{money(snapshot.commercial.total)}</dd></div>{snapshot.commercial.promotion && <p className="pt-2 text-sm text-gray-600">{snapshot.commercial.promotion}</p>}</dl>
      </Section>

      <Section title={`Plan de pagos · ${snapshot.paymentPolicy === '40-30-30' ? 'Política 40% / 30% / 30%' : 'Plan personalizado'}`}>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead className="bg-[#11151d] text-xs uppercase tracking-wider text-[#f4d35e]"><tr><th className="p-3">Pago</th><th className="p-3">Porcentaje</th><th className="p-3">Fecha límite</th><th className="p-3 text-right">Importe</th></tr></thead><tbody>{snapshot.payments.map((payment, index) => <tr key={`${payment.concept}-${index}`} className="border-b border-gray-200"><td className="p-3">{payment.concept}</td><td className="p-3">{payment.percentage ? `${payment.percentage}%` : '—'}</td><td className="p-3">{date(payment.dueDate)}</td><td className="p-3 text-right font-semibold">{money(payment.amount)}</td></tr>)}</tbody></table></div>
      </Section>

      {snapshot.documentType === 'CONTRATO' && <Section title="Términos y condiciones"><ol className="space-y-3 text-sm text-gray-700">{snapshot.terms.map((term, index) => <li key={index} className="flex gap-3"><strong className="text-[#9a7707]">{index + 1}.</strong><span>{term}</span></li>)}</ol></Section>}

      <footer className="border-t border-gray-200 pt-6 text-sm text-gray-600"><strong className="text-[#171717]">XPH Fotografía &amp; Video</strong><p>Este documento conserva la versión de los datos aceptados al momento de su emisión.</p></footer>
    </div>
  </article>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section><h2 className="mb-4 font-serif text-xl font-bold uppercase tracking-wide text-[#1b1f27]"><span className="mr-3 text-[#D4AF37]">—</span>{title}</h2>{children}</section>;
const Info = ({ label, value }: { label: string; value: string }) => <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
const Amount = ({ label, value }: { label: string; value: number }) => <div className="flex justify-between gap-4"><dt className="text-gray-600">{label}</dt><dd className="font-semibold">{money(value)}</dd></div>;
