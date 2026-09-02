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

const standardTerms = [
  ['Reserva y calendario de pagos', 'La fecha del evento queda formalmente reservada únicamente tras el pago del 40% inicial y la firma del contrato. El segundo pago del 30% deberá cubrirse, como fecha límite, antes de iniciar la cobertura el día del evento. El 30% restante se pagará contra entrega de los materiales contratados. Mientras no se refleje el apartado, la disponibilidad podrá ofrecerse a otro cliente.'],
  ['Entregables', 'Se entregarán exclusivamente las fotografías editadas, la galería digital privada, el video resumen y los demás productos expresamente incluidos en el paquete. La entrega será digital y en alta resolución, dentro del plazo acordado entre ambas partes. Los archivos originales sin edición no forman parte de la entrega.'],
  ['Edición y colorimetría', 'La selección final, corrección de exposición, balance de blancos, contraste, colorimetría y estilo de edición forman parte del criterio creativo de XPH. El resultado conservará la línea visual mostrada en su portafolio. No se entregan archivos RAW ni proyectos editables. Las diferencias de color producidas por pantallas, impresoras o laboratorios externos no se consideran defectos del material.'],
  ['Puntualidad y cobertura', 'La cobertura inicia a la hora acordada y comprende únicamente las horas continuas indicadas en el paquete. Los retrasos imputables al itinerario, ceremonia, recepción o participantes no extienden el tiempo contratado; las horas adicionales requieren disponibilidad, cotización y autorización.'],
  ['Cambios al servicio', 'Cualquier modificación de fecha, horario, sede, itinerario, cobertura, paquete o servicio adicional deberá solicitarse y aprobarse por escrito antes del evento. Los cargos de traslado, permisos o accesos no contemplados serán cubiertos por EL CLIENTE.'],
  ['Fuerza mayor, reprogramación y cancelación', 'En una cancelación unilateral de EL CLIENTE, el apartado inicial del 40% no será reembolsable por la reserva de fecha y gastos administrativos. Cuando exista fuerza mayor o caso fortuito comprobable, podrá reasignarse la fecha sujeto a disponibilidad y a los gastos ya realizados.'],
  ['Conservación y respaldo', 'EL CLIENTE deberá descargar y respaldar sus entregables dentro del periodo comunicado. La galería privada y los respaldos de producción no constituyen almacenamiento indefinido.'],
  ['Aceptación electrónica', 'La firma electrónica, la fecha y hora de aceptación, la versión congelada del documento y sus identificadores se conservarán como evidencia del acuerdo entre las partes.'],
];

const completeTerms = (terms: string[]) => {
  const saved = (terms || []).map((term, index) => {
    const separator = term.indexOf(':');
    return separator > 0 ? [term.slice(0, separator), term.slice(separator + 1).trim()] : [`Cláusula ${index + 1}`, term];
  });
  const normalizedTitle = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return standardTerms.map((fallback) => saved.find((item) => normalizedTitle(item[0]).includes(normalizedTitle(fallback[0]).split(',')[0])) || fallback);
};

export const ContractDocument = ({ snapshot, folio }: { snapshot: ContractDocumentSnapshot; folio: string }) => {
  const isQuote = snapshot.documentType === 'COTIZACION';
  // Los documentos históricos guardaron solo cuatro cláusulas. Al abrirlos se
  // completan con el contrato vigente sin alterar sus datos comerciales.
  const clauses = completeTerms(snapshot.terms || []);
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
      {!isQuote && <p className="relative mb-6 text-justify">Conste por el presente documento el <strong>CONTRATO DE PRESTACIÓN DE SERVICIOS FOTOGRÁFICOS Y AUDIOVISUALES</strong> que celebran, por una parte, <strong>XAVI.PH</strong> (en lo sucesivo “EL PRESTADOR DEL SERVICIO”), y por otra parte <strong>{snapshot.client.name}</strong> (en lo sucesivo “EL CLIENTE”). Domicilio de EL CLIENTE: {snapshot.client.address || 'no proporcionado'}.</p>}

      <Section number="1" title="Datos del cliente y del evento"><div className="grid grid-cols-2 border border-black sm:grid-cols-3">
        <Info label="Cliente" value={snapshot.client.name} /><Info label="Teléfono" value={snapshot.client.phone || 'No registrado'} /><Info label="Correo" value={snapshot.client.email || 'No registrado'} />
        <Info label="Tipo de evento" value={snapshot.event.type} /><Info label="Festejado(s)" value={snapshot.client.honoreeName || 'No aplica'} /><Info label="Fecha de emisión" value={date(snapshot.issuedAt)} />
        <Info label="Fecha y hora" value={`${date(snapshot.event.date)} · ${time(snapshot.event.time)}`} /><Info label="Cobertura" value={snapshot.event.serviceHours ? `${snapshot.event.serviceHours} horas continuas` : 'Por confirmar'} /><Info label="Lugar" value={snapshot.event.location || 'Por confirmar'} wide />
        {!isQuote && snapshot.client.address && <Info label="Domicilio del cliente" value={snapshot.client.address} wide />}
      </div></Section>

      <Section number="2" title="Servicios contratados">
        <div className="mb-3 flex items-end justify-between gap-4 border-b border-black pb-2"><strong className="uppercase">{snapshot.commercial.packageName || 'Servicio personalizado'}</strong><strong className="whitespace-nowrap">{money(snapshot.commercial.packageBase)}</strong></div>
        <ul className="grid gap-x-7 gap-y-1.5 sm:grid-cols-2">{snapshot.services.map((service, index) => <li key={`${service.concept}-${index}`} className="flex gap-2"><b>✓</b><span>{service.concept}{service.quantity > 1 ? ` (${service.quantity})` : ''}{service.notes ? ` — ${service.notes}` : ''}</span></li>)}{!snapshot.services.length && <li>Servicios por especificar.</li>}</ul>
      </Section>

      {!!snapshot.addons.length && <Section number="3" title="Servicios adicionales"><Table><thead><tr><Th>Concepto</Th><Th>Cantidad</Th><Th>Precio unitario</Th><Th right>Importe</Th></tr></thead><tbody>{snapshot.addons.map((addon, index) => <tr key={`${addon.concept}-${index}`}><Td>{addon.concept}</Td><Td>{addon.quantity}</Td><Td>{money(addon.unitPrice)}</Td><Td right>{money(addon.total)}</Td></tr>)}</tbody></Table></Section>}

      <Section number={section(3)} title="Resumen financiero"><Table><tbody><tr><Td>Paquete base</Td><Td right>{money(snapshot.commercial.packageBase)}</Td></tr>{snapshot.addons.length > 0 && <tr><Td>Servicios adicionales</Td><Td right>{money(snapshot.commercial.additions)}</Td></tr>}{snapshot.commercial.discount > 0 && <tr><Td>Descuento / promoción</Td><Td right>− {money(snapshot.commercial.discount)}</Td></tr>}<tr className="font-bold"><Td>Total contratado</Td><Td right>{money(snapshot.commercial.total)}</Td></tr></tbody></Table>{snapshot.commercial.promotion && <p className="mt-2 text-[11px]">Promoción aplicada: {snapshot.commercial.promotion}</p>}</Section>

      <Section number={section(4)} title="Calendario de pagos programado"><Table><thead><tr><Th>Etapa / pago</Th><Th>Porcentaje</Th><Th>Monto</Th><Th>Fecha límite de pago</Th></tr></thead><tbody>{snapshot.payments.map((payment, index) => <tr key={`${payment.concept}-${index}`}><Td>{payment.concept}</Td><Td>{payment.percentage ? `${payment.percentage}%` : '—'}</Td><Td>{money(payment.amount)} MXN</Td><Td>{payment.dueDate ? (index === 1 ? `A más tardar el ${date(payment.dueDate)}, antes de iniciar la cobertura` : date(payment.dueDate)) : index === 0 ? 'A la firma del contrato para reservar la fecha' : 'Contra entrega de los materiales y entregables contratados'}</Td></tr>)}</tbody></Table></Section>

      {!isQuote && <><Section number={section(5)} title="Términos y condiciones generales"><ol className="space-y-2.5 text-justify">{clauses.map(([title, body], index) => <li key={index}><strong>{index + 1}. {title}.</strong> {body}</li>)}</ol></Section><Section number={section(6)} title="Uso comercial, licencia y derechos de imagen"><ol className="space-y-2.5 text-justify"><li><strong>1. Licencia de uso personal para EL CLIENTE.</strong> EL CLIENTE recibe una licencia personal, no exclusiva y de duración indefinida para imprimir, reproducir y compartir las fotografías y videos entregados en sus redes sociales y ámbito familiar privado. No podrá venderlos ni cederlos a terceros con fines de lucro.</li><li><strong>2. Uso promocional por XAVI.PH.</strong> Cuando EL CLIENTE lo autorice, XAVI.PH podrá utilizar fragmentos del video e imágenes del evento en su portafolio, sitio oficial, redes sociales, muestrarios impresos y material publicitario.</li><li><strong>3. Derechos de autor.</strong> EL PRESTADOR DEL SERVICIO conserva los derechos morales y de autor sobre la obra fotográfica y audiovisual conforme a la legislación aplicable.</li><li><strong>4. Privacidad exclusiva.</strong> Si EL CLIENTE requiere que el material no sea publicado en redes, portafolios o promociones, deberá indicarlo antes de la firma del contrato.</li></ol></Section><div className="mt-10 grid grid-cols-2 gap-12 text-center"><Signature label="EL CLIENTE" /><Signature label="EL PRESTADOR DEL SERVICIO" /></div></>}
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
