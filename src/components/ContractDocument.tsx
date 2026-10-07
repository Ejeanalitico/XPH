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

const parseTerms = (terms: string[]) => (terms || []).map((term, index) => {
  const separator = term.indexOf(':');
  return separator > 0
    ? [term.slice(0, separator), term.slice(separator + 1).trim()]
    : [`Cláusula ${index + 1}`, term];
});

export const ContractDocument = ({ snapshot, folio }: { snapshot: ContractDocumentSnapshot; folio: string }) => {
  const isQuote = snapshot.documentType === 'COTIZACION';
  // La versión firmada se conserva exactamente como fue generada. No se
  // agregan cláusulas nuevas a contratos históricos.
  const clauses = parseTerms(snapshot.terms || []);
  const includesMakeup = snapshot.includesMakeup ?? [...(snapshot.services || []), ...(snapshot.addons || [])]
    .some((item) => /\b(maquillaje|makeup|peinado|peinados)\b/i.test(String(item.concept || '')));
  const serviceTitle = includesMakeup
    ? 'SERVICIOS FOTOGRÁFICOS, AUDIOVISUALES Y MAQUILLAJE PROFESIONAL'
    : 'SERVICIOS FOTOGRÁFICOS Y AUDIOVISUALES';
  const mediaAuthorized = snapshot.commercialMediaConsent === 'AUTHORIZED';
  const documentPackages = snapshot.packageOptions?.length ? snapshot.packageOptions : [{
    packageSnapshotId: '',
    packageId: '',
    category: '',
    packageName: snapshot.commercial.packageName,
    basePrice: snapshot.commercial.packageBase,
    discount: snapshot.commercial.discount,
    promotion: snapshot.commercial.promotion,
    packageTotal: Math.max(0, snapshot.commercial.packageBase - snapshot.commercial.discount),
    total: snapshot.commercial.total,
    services: snapshot.services,
  }];
  const multiPackageQuote = isQuote && documentPackages.length > 1;
  const section = (base: number) => String(base + (snapshot.addons.length ? 1 : 0));

  return <article className="xph-contract mx-auto w-full max-w-[794px] overflow-hidden bg-[#fffefb] text-[#171717] shadow-2xl print:max-w-none print:shadow-none">
    <header className="border-b-[3px] border-black px-8 pb-5 pt-7 sm:px-12">
      <div className="flex items-start justify-between gap-8">
        <div className="w-[44%] max-w-[285px]">
          <img src="/xph-logo.png" alt="XPH Fotografía y Video" className="h-auto w-[190px] max-w-full" />
          <p className="mt-2 border-t border-black pt-2 text-[10px] font-semibold uppercase tracking-[.18em]">Fotografía &amp; producción audiovisual</p>
        </div>
        <div className="text-right"><h1 className="font-serif text-[25px] font-bold uppercase leading-[1.05] sm:text-[31px]">{isQuote ? 'Cotización de servicios' : 'Contrato de servicios'}</h1><p className="mt-3 text-[12px] font-semibold uppercase tracking-[.1em]">{snapshot.event.type || 'Evento'}</p><p className="mt-1 text-[11px]">Folio {folio}</p></div>
      </div>
    </header>

    <div className="relative px-8 py-7 text-[12px] leading-[1.48] sm:px-12">
      <img aria-hidden="true" src="/xph-logo.png" className="pointer-events-none absolute left-1/2 top-[330px] w-[76%] -translate-x-1/2 opacity-[.035]" />
      {!isQuote && <p className="relative mb-6 text-justify">Conste por el presente documento el <strong>CONTRATO DE PRESTACIÓN DE {serviceTitle}</strong> que celebran, por una parte, <strong>XAVI.PH</strong>, representado por <strong>Fernando Javier García Flores</strong> (en lo sucesivo “EL PRESTADOR DEL SERVICIO”), y por otra parte <strong>{snapshot.client.name}</strong> (en lo sucesivo “EL CLIENTE”). Domicilio de EL CLIENTE: {snapshot.client.address || 'no proporcionado'}.</p>}

      <Section number="1" title="Datos del cliente y del evento"><div className="grid grid-cols-2 border border-black sm:grid-cols-3">
        <Info label="Cliente" value={snapshot.client.name} /><Info label="Teléfono" value={snapshot.client.phone || 'No registrado'} /><Info label="Correo" value={snapshot.client.email || 'No registrado'} />
        <Info label="Tipo de evento" value={snapshot.event.type} /><Info label="Festejado(s)" value={snapshot.client.honoreeName || 'No aplica'} /><Info label="Fecha de emisión" value={date(snapshot.issuedAt)} />
        <Info label="Fecha y hora" value={`${date(snapshot.event.date)} · ${time(snapshot.event.time)}`} /><Info label="Cobertura" value={snapshot.event.serviceHours ? `${snapshot.event.serviceHours} horas continuas` : 'Por confirmar'} /><Info label="Lugar" value={snapshot.event.location || 'Por confirmar'} wide />
        {!isQuote && snapshot.client.address && <Info label="Domicilio del cliente" value={snapshot.client.address} wide />}
      </div></Section>

      <Section number="2" title={multiPackageQuote ? "Opciones de paquete, servicios y productos incluidos" : "Servicios y productos incluidos"}>
        <div className="space-y-5">{documentPackages.map((pkg, packageIndex) => <div key={pkg.packageSnapshotId || pkg.packageId || `${pkg.packageName}-${packageIndex}`} className={multiPackageQuote ? "rounded-lg border border-black/20 p-4" : ""}>
          {multiPackageQuote && <p className="mb-2 text-[9px] font-bold uppercase tracking-[.12em]">Opción {packageIndex + 1}</p>}
          <div className="mb-4 flex items-end justify-between gap-4 border-b border-black pb-2"><strong className="uppercase">{pkg.packageName || 'Servicio personalizado'}</strong><strong className="whitespace-nowrap">{money(pkg.basePrice)}</strong></div>
          <div className="grid gap-2 sm:grid-cols-2">{pkg.services.map((service, index) => <div key={`${pkg.packageSnapshotId || pkg.packageId}-${service.concept}-${index}`} className="flex items-start gap-2.5 rounded-md border border-black/15 px-3 py-2.5"><span className="mt-[1px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black text-[10px] font-bold">✓</span><span className="leading-5">{service.concept}{service.quantity > 1 ? ` (${service.quantity})` : ''}{service.notes ? ` — ${service.notes}` : ''}</span></div>)}{!pkg.services.length && <div className="rounded-md border border-dashed border-black/20 px-3 py-3">Servicios por especificar.</div>}</div>
          {(pkg.discount > 0 || pkg.promotion || multiPackageQuote) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]"><span>{pkg.promotion ? `Promoción: ${pkg.promotion}` : pkg.discount > 0 ? `Descuento: ${money(pkg.discount)}` : 'Sin descuento'}</span><strong>Total de esta opción: {money(pkg.total)}</strong></div>}
        </div>)}</div>
      </Section>

      {!!snapshot.addons.length && <Section number="3" title="Servicios adicionales"><Table><thead><tr><Th>Concepto</Th><Th>Cantidad</Th><Th>Precio unitario</Th><Th right>Importe</Th></tr></thead><tbody>{snapshot.addons.map((addon, index) => <tr key={`${addon.concept}-${index}`}><Td>{addon.concept}</Td><Td>{addon.quantity}</Td><Td>{money(addon.unitPrice)}</Td><Td right>{money(addon.total)}</Td></tr>)}</tbody></Table></Section>}

      <Section number={section(3)} title={multiPackageQuote ? "Resumen de opciones" : "Resumen financiero"}>{multiPackageQuote ? <><Table><thead><tr><Th>Opción</Th><Th right>Total</Th></tr></thead><tbody>{documentPackages.map((pkg, index) => <tr key={pkg.packageSnapshotId || pkg.packageId || index}><Td>{pkg.packageName}</Td><Td right>{money(pkg.total)}</Td></tr>)}</tbody></Table>{snapshot.addons.length > 0 && <p className="mt-2 text-[10px]">Los totales de cada opción incluyen los servicios adicionales mostrados arriba.</p>}</> : <><Table><tbody><tr><Td>Paquete base</Td><Td right>{money(snapshot.commercial.packageBase)}</Td></tr>{snapshot.addons.length > 0 && <tr><Td>Servicios adicionales</Td><Td right>{money(snapshot.commercial.additions)}</Td></tr>}{snapshot.commercial.discount > 0 && <tr><Td>Descuento / promoción</Td><Td right>− {money(snapshot.commercial.discount)}</Td></tr>}<tr className="font-bold"><Td>Total contratado</Td><Td right>{money(snapshot.commercial.total)}</Td></tr></tbody></Table>{snapshot.commercial.promotion && <p className="mt-2 text-[11px]">Promoción aplicada: {snapshot.commercial.promotion}</p>}</>}</Section>

      <Section number={section(4)} title={multiPackageQuote ? "Esquema de pagos por opción" : "Calendario de pagos programado"}>{multiPackageQuote && snapshot.paymentPolicy === '40-30-30' ? <Table><thead><tr><Th>Opción</Th><Th>40% apartado</Th><Th>30% intermedio</Th><Th>30% finiquito</Th><Th right>Total</Th></tr></thead><tbody>{documentPackages.map((pkg, index) => <tr key={pkg.packageSnapshotId || pkg.packageId || index}><Td>{pkg.packageName}</Td><Td>{money(pkg.total * .4)}</Td><Td>{money(pkg.total * .3)}</Td><Td>{money(pkg.total * .3)}</Td><Td right>{money(pkg.total)}</Td></tr>)}</tbody></Table> : multiPackageQuote ? <p className="rounded-md border border-black/20 p-3">El plan personalizado se definirá sobre la opción elegida antes de formalizar el contrato.</p> : <Table><thead><tr><Th>Etapa / pago</Th><Th>Porcentaje</Th><Th>Monto</Th><Th>Fecha límite de pago</Th></tr></thead><tbody>{snapshot.payments.map((payment, index) => <tr key={`${payment.concept}-${index}`}><Td>{payment.concept}</Td><Td>{payment.percentage ? `${payment.percentage}%` : '—'}</Td><Td>{money(payment.amount)} MXN</Td><Td>{payment.dueDate ? (index === 1 ? `A más tardar el ${date(payment.dueDate)}, antes de iniciar la cobertura` : date(payment.dueDate)) : index === 0 ? 'A la firma del contrato para reservar la fecha' : 'Contra entrega de los materiales y entregables contratados'}</Td></tr>)}</tbody></Table>}</Section>

      {!isQuote && <><Section number={section(5)} title="Términos y condiciones generales"><ol className="space-y-2.5 text-justify">{clauses.map(([title, body], index) => <li key={index}><strong>{index + 1}. {title}.</strong> {body}</li>)}</ol></Section><Section number={section(6)} title="Uso comercial, licencia y derechos de imagen"><ol className="space-y-2.5 text-justify"><li><strong>1. Licencia de uso personal para EL CLIENTE.</strong> EL CLIENTE recibe una licencia personal, no exclusiva y de duración indefinida para imprimir, reproducir y compartir las fotografías y videos entregados en sus redes sociales personales y ámbito familiar. Cualquier explotación comercial por terceros deberá contar con la autorización que legalmente corresponda.</li><li><strong>2. Decisión expresa sobre uso promocional por XAVI.PH.</strong> <span className={mediaAuthorized ? 'font-bold' : 'font-bold'}>{mediaAuthorized ? 'AUTORIZADO.' : 'NO AUTORIZADO.'}</span> {mediaAuthorized ? 'EL CLIENTE autoriza expresamente a XAVI.PH a utilizar fotografías y fragmentos de video donde aparezca EL CLIENTE, exclusivamente para portafolio, sitio web oficial, redes sociales, muestrarios, concursos y promoción comercial propia de XAVI.PH. Esta autorización no implica cesión a terceros.' : 'EL CLIENTE no autoriza a XAVI.PH a utilizar fotografías o fragmentos de video identificables de EL CLIENTE para portafolio, sitio web, redes sociales, concursos, muestrarios ni publicidad.'}</li><li><strong>3. Personas distintas de EL CLIENTE.</strong> La autorización anterior sólo alcanza la imagen de EL CLIENTE y de aquellas personas respecto de las cuales tenga facultad legal para autorizar. La publicación identificable de otras personas se sujetará al consentimiento que corresponda.</li><li><strong>4. Derechos de autor.</strong> Los derechos morales de autor se reconocen conforme a la legislación aplicable. Los derechos patrimoniales, licencias y facultades de explotación se regirán por este contrato y por las disposiciones legales aplicables a las obras realizadas por encargo.</li></ol></Section><div className="mt-10 grid grid-cols-2 gap-12 text-center"><Signature label="EL CLIENTE" /><Signature label="EL PRESTADOR DEL SERVICIO · Fernando Javier García Flores" /></div></>}
      <footer className="mt-8 border-t border-black pt-3 text-center text-[9px] uppercase tracking-[.12em]">XPH Fotografía &amp; Video · Documento digital · Folio {folio}</footer>
    </div>
  </article>;
};

const Section = ({ number, title, children }: { number: string; title: string; children: React.ReactNode }) => <section className="relative mb-6 break-inside-avoid"><h2 className="mb-3 border-b border-black pb-1 font-serif text-[17px] font-bold uppercase"><span className="mr-2">{number}.</span>{title}</h2>{children}</section>;
const Info = ({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) => <div className={`min-h-[64px] border-b border-r border-black p-2.5 ${wide ? 'col-span-2 sm:col-span-3' : ''}`}><p className="text-[9px] font-bold uppercase tracking-[.08em]">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
const Table = ({ children }: { children: React.ReactNode }) => <div className="overflow-x-auto"><table className="w-full min-w-[520px] border-collapse border border-black text-left">{children}</table></div>;
const Th = ({ children, right = false }: { children: React.ReactNode; right?: boolean }) => <th className={`border border-black bg-[#ededeb] p-2 text-[9px] uppercase tracking-[.06em] ${right ? 'text-right' : ''}`}>{children}</th>;
const Td = ({ children, right = false }: { children: React.ReactNode; right?: boolean }) => <td className={`border border-black p-2 ${right ? 'text-right' : ''}`}>{children}</td>;
const Signature = ({ label }: { label: string }) => <div className="border-t border-black pt-2"><strong className="text-[10px]">{label}</strong><div className="mt-1 h-4" aria-hidden="true" /></div>;
