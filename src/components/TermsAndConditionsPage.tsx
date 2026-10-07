import React from 'react';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';

interface TermsAndConditionsPageProps {
  onBack: () => void;
}

const sections = [
  {
    title: '1. Alcance del servicio, cotización y reserva',
    body: [
      'Los servicios de XPH Fotografía & Video se prestan conforme a la cotización, orden de servicio y/o contrato particular aceptado por el cliente. Dichos documentos definirán el paquete contratado, personal asignado, horas de cobertura, locaciones, entregables, adicionales, precio total y calendario de pagos.',
      'Todo servicio, producto o adicional que no aparezca expresamente incluido se cotizará por separado y sólo se realizará previa autorización del cliente por escrito o por un medio electrónico verificable.',
      'La fecha se considera reservada únicamente cuando XPH confirme la disponibilidad y se cumpla el pago o requisito de apartado indicado en la cotización o contrato. El tratamiento de cualquier apartado, anticipo o pago de reserva se sujetará a lo pactado en el contrato particular y a la legislación aplicable.',
    ],
  },
  {
    title: '2. Pagos, saldos, comprobantes y facturación',
    body: [
      'El calendario de pagos, porcentajes, fechas límite y métodos aceptados serán los indicados en la cotización o contrato particular. Los pagos deberán poder identificarse con el cliente y el evento correspondiente.',
      'Salvo que el contrato particular disponga otra cosa, los entregables finales en alta resolución y los productos físicos podrán retenerse mientras exista un saldo exigible pendiente.',
      'Las comisiones de instituciones financieras o plataformas de pago sólo serán trasladadas al cliente cuando hayan sido informadas previamente. La facturación fiscal se realizará conforme a la información y plazos aplicables.',
    ],
  },
  {
    title: '3. Horarios, puntualidad y tiempo adicional',
    body: [
      'La cobertura inicia en el horario pactado, aun cuando el cliente, festejados, invitados o locación no se encuentren listos. Los retrasos atribuibles al cliente consumen el tiempo contratado y no generan reposición automática.',
      'El montaje razonable de iluminación, cámaras, audio, estación de maquillaje u otros elementos forma parte del bloque operativo cuando así corresponda al servicio.',
      'Las horas o fracciones adicionales requerirán aceptación expresa del cliente y se cobrarán conforme a la tarifa vigente informada para ese evento. La extensión del servicio dependerá de la disponibilidad del equipo de trabajo.',
    ],
  },
  {
    title: '4. Logística, traslados, locaciones y alimentos',
    body: [
      'Los viáticos, casetas, estacionamientos, hospedaje, traslados especiales y demás gastos logísticos se establecerán en cada cotización cuando correspondan.',
      'El cliente es responsable de gestionar y cubrir permisos, accesos, autorizaciones o cuotas exigidas por iglesias, salones, hoteles, parques, recintos privados o autoridades. Las restricciones de una locación que impidan o limiten determinadas tomas no serán imputables a XPH cuando hayan sido ajenas a su control.',
      'En coberturas prolongadas, el contrato particular podrá establecer la provisión de alimentos y bebidas para el personal, procurando que la pausa no coincida con momentos esenciales del evento.',
    ],
  },
  {
    title: '5. Clima, seguridad y fuerza mayor',
    body: [
      'La lluvia, viento, polvo, calor extremo u otras condiciones adversas no implican por sí mismas cancelación automática ni reembolso. En servicios exteriores, el cliente deberá colaborar con una alternativa razonable de resguardo o locación.',
      'XPH podrá pausar o modificar temporalmente el servicio cuando exista riesgo real para personas, equipo fotográfico, audiovisual, iluminación o productos de maquillaje.',
      'Ante caso fortuito o fuerza mayor que haga imposible la prestación, las partes buscarán primero una reprogramación razonable sujeta a disponibilidad. Si ello no fuera posible, se aplicará lo previsto en el contrato particular y en la legislación aplicable.',
      'En caso de enfermedad súbita, accidente o emergencia del profesional asignado, XPH podrá proponer un sustituto con perfil técnico equivalente cuando resulte viable.',
    ],
  },
  {
    title: '6. Maquillaje, peinado, salud e higiene',
    body: [
      'La persona que reciba maquillaje o peinado deberá informar previamente alergias conocidas, sensibilidad a productos, lesiones, infecciones activas o cualquier condición que pueda afectar la seguridad del servicio.',
      'XPH o el profesional asignado podrá negarse a aplicar productos sobre una zona que presente signos evidentes de infección o riesgo de contagio, priorizando la bioseguridad.',
      'Las instrucciones de preparación previa, pruebas, cambios de look, extensiones, accesorios y retoques se regirán por el paquete contratado. El tiempo utilizado en corregir condiciones de preparación no cumplidas podrá reducir el tiempo disponible del servicio.',
    ],
  },
  {
    title: '7. Captura, selección, edición y archivos originales',
    body: [
      'La cobertura se realiza bajo criterio técnico y artístico profesional. No se garantiza una cantidad específica de tomas de cada invitado ni la captura de momentos que resulten materialmente imposibles por obstrucciones, restricciones del recinto, retrasos o circunstancias fuera del control razonable del equipo.',
      'La selección final excluirá pruebas de luz, duplicados, desenfoques, disparos accidentales, expresiones no favorables u otros archivos sin valor de entrega. Los archivos RAW, proyectos editables, material sin procesar y respaldos de trabajo no forman parte de la entrega salvo pacto expreso por escrito.',
      'La edición estándar comprende ajustes de exposición, color, encuadre, contraste, balance y tratamiento estilístico. Retoques complejos, fotomontajes, eliminación extensa de objetos, alteraciones corporales u otras manipulaciones avanzadas se cotizan por separado.',
    ],
  },
  {
    title: '8. Entregas, revisiones, galerías y productos físicos',
    body: [
      'Los plazos de entrega serán los señalados en la cotización o contrato particular y se computarán a partir de que XPH cuente con el material, selección, información o aprobaciones necesarias.',
      'Cuando se ofrezcan rondas de corrección, éstas cubrirán ajustes menores sobre el material entregado y deberán solicitarse dentro del plazo indicado en el contrato. Cambios de criterio creativo o solicitudes fuera del alcance original podrán generar una nueva cotización.',
      'Las galerías digitales tendrán la vigencia informada al cliente. Una vez vencido ese plazo, XPH no garantiza disponibilidad inmediata y podrá aplicar un cargo previamente informado por reactivación o recuperación de archivos.',
      'Photobooks, impresiones, cuadros y otros productos de terceros están sujetos a procesos de fabricación. Cuando requieran aprobación de diseño, cualquier retraso del cliente en aprobar podrá mover la fecha estimada de entrega.',
    ],
  },
  {
    title: '9. Derechos de autor y licencia al cliente',
    body: [
      'Los derechos morales de las personas autoras se reconocen conforme a la Ley Federal del Derecho de Autor. Los derechos patrimoniales, licencias y facultades de explotación de cada producción se determinarán expresamente en el contrato particular, considerando que la legislación mexicana contiene reglas específicas para obras realizadas por encargo.',
      'En servicios sociales, salvo que el contrato establezca un alcance distinto, el material entregado se destina al uso personal del cliente. Cualquier uso publicitario, comercial, cesión a marcas o explotación por terceros deberá acordarse por escrito cuando exceda la licencia otorgada.',
      'Las ediciones o alteraciones públicas que puedan atribuirse a XPH y distorsionen sustancialmente el trabajo original podrán solicitarse sin crédito o con aclaración de que se trata de una modificación realizada por un tercero.',
    ],
  },
  {
    title: '10. Uso de imagen, portafolio y menores de edad',
    body: [
      'La contratación del servicio no implica por sí sola autorización para utilizar retratos identificables del cliente como publicidad de XPH. La publicación promocional en sitio web, redes sociales, portafolio, concursos o material comercial requerirá la autorización correspondiente.',
      'La autorización de portafolio podrá recabarse en el contrato, formulario o consentimiento separado y deberá indicar de manera clara los medios y fines autorizados. Cuando aparezcan menores de edad, se requerirá la autorización de quien ejerza legalmente la patria potestad o tutela cuando resulte aplicable.',
      'Las necesidades de confidencialidad o exclusividad para proyectos comerciales podrán negociarse y cotizarse como condiciones contractuales específicas, sin convertir la negativa a autorizar publicidad personal en una penalización automática.',
    ],
  },
  {
    title: '11. Cancelaciones y reprogramaciones',
    body: [
      'Las reglas de cancelación, reprogramación, conservación o aplicación de pagos serán las indicadas en el contrato particular. Cualquier cargo deberá guardar relación con las condiciones pactadas, los trabajos ya realizados, gastos comprometidos y la proximidad de la fecha, conforme a la legislación aplicable.',
      'Las reprogramaciones están sujetas a disponibilidad. Si una nueva fecha no puede ser cubierta por XPH, las partes aplicarán la solución prevista en el contrato y las disposiciones de protección al consumidor que correspondan.',
      'Si XPH no pudiera prestar el servicio por una causa directamente atribuible a la empresa y tampoco fuera posible proporcionar una solución equivalente aceptada por el cliente, se aplicarán los remedios previstos en el contrato y en la legislación aplicable.',
    ],
  },
  {
    title: '12. Conducta, interferencias y daños',
    body: [
      'XPH podrá suspender temporalmente o terminar la prestación cuando exista violencia, amenazas, acoso, conductas sexuales inapropiadas, discriminación o un riesgo objetivo para la integridad del personal. Se documentará el incidente cuando sea posible y se aplicarán las consecuencias previstas en el contrato y en la ley.',
      'XPH no será responsable por tomas perdidas cuando terceros bloqueen de forma imprevisible el ángulo de captura, impidan el acceso autorizado o interfieran materialmente con el trabajo pese a las indicaciones razonables del equipo.',
      'Los daños comprobables al equipo causados directamente por actos imputables al cliente o a una persona bajo su responsabilidad se reclamarán conforme a la legislación aplicable, evitando presunciones automáticas de responsabilidad.',
    ],
  },
  {
    title: '13. Música y restricciones técnicas',
    body: [
      'La música incluida en videos se seleccionará procurando contar con licencias o usos compatibles con el destino de la obra. El cliente es responsable de cualquier contenido musical o audiovisual que solicite incorporar y respecto del cual afirme contar con derechos o autorización.',
    ],
  },
  {
    title: '14. Datos personales y comunicaciones',
    body: [
      'Los datos personales recabados para cotizar, contratar, coordinar, cobrar, entregar o dar seguimiento a los servicios se tratarán conforme al Aviso de Privacidad de XPH y a la legislación aplicable.',
      'Las comunicaciones comerciales se manejarán de forma separada de las comunicaciones necesarias para ejecutar el servicio. El cliente podrá solicitar dejar de recibir publicidad sin afectar las comunicaciones indispensables relacionadas con un contrato vigente.',
    ],
  },
  {
    title: '15. Aceptación electrónica, versión aplicable y solución de controversias',
    body: [
      'La aceptación podrá documentarse mediante firma autógrafa o electrónica, casilla de aceptación, mensaje electrónico inequívoco u otro mecanismo que permita atribuir la manifestación de voluntad y conservar evidencia de la versión aceptada.',
      'La versión aplicable será la que se haya puesto a disposición del cliente al momento de contratar. Las modificaciones futuras no alterarán retroactivamente contratos ya celebrados salvo acuerdo expreso de las partes o disposición legal.',
      'Para cualquier inconformidad, el cliente podrá contactar a XPH por los medios publicados en el sitio. Cuando corresponda, se reconoce la competencia administrativa de la Procuraduría Federal del Consumidor, sin limitar los derechos irrenunciables que la legislación otorgue al consumidor.',
      'Si una disposición resultara inválida o inaplicable, las demás conservarán sus efectos en la medida permitida por la ley.',
    ],
  },
];

export const TermsAndConditionsPage: React.FC<TermsAndConditionsPageProps> = ({ onBack }) => {
  return (
    <main className="bg-[#0B0F17] min-h-screen text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-[#D4AF37] transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </button>

        <header className="mb-8 sm:mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#D4AF37] font-mono">XPH Fotografía & Video</p>
              <h1 className="text-2xl sm:text-4xl font-bold font-serif-luxury">Términos y condiciones</h1>
            </div>
          </div>
          <p className="text-xs text-gray-500">Última actualización: 7 de octubre de 2026</p>
        </header>

        <div className="mb-9 p-4 sm:p-5 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
          <p className="text-sm text-gray-200 leading-relaxed">
            Estos términos establecen reglas generales para los servicios de XPH Fotografía & Video.
            La cotización, orden de servicio y contrato particular de cada evento forman parte de la
            relación contractual y prevalecen en sus condiciones específicas, siempre dentro del marco
            de la legislación aplicable.
          </p>
        </div>

        <div className="space-y-7">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/10 bg-[#101722] p-5 sm:p-7 shadow-lg shadow-black/10"
            >
              <h2 className="text-base sm:text-lg font-semibold text-white mb-3">{section.title}</h2>
              <div className="space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm text-gray-300 leading-7">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-9 pt-6 border-t border-white/10 text-xs text-gray-500 leading-relaxed">
          <p>
            Este texto informa las condiciones generales de servicio y no sustituye las disposiciones
            legales obligatorias ni las condiciones específicas del contrato aplicable.
          </p>
        </div>
      </div>
    </main>
  );
};
