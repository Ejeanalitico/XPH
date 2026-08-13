import { EventType, PackageOption, AddOnOption } from '../types';

export const PACKAGES_BY_EVENT: Record<EventType, PackageOption[]> = {
  bodas: [
    {
      id: 'civil',
      name: 'PAQUETE BÁSICO / CIVIL',
      price: 12500,
      description: 'Cobertura esencial para ceremonia civil o íntima con entrega digital HD.',
      features: [
        'Cobertura de 4 horas continuas',
        'Galería Web HD (3 meses activa)',
        '150+ Fotografías editadas en alta resolución',
        'Entrega digital segura con PIN para invitados',
        'Derechos de impresión personal incluidos'
      ],
      notIncludes: [
        'Segundo fotógrafo de apoyo',
        'Photobook impreso en lino',
        'Sesión Previa Engagement',
        'Horas extra de fiesta'
      ]
    },
    {
      id: 'pro',
      name: 'COBERTURA TOTAL (PRO)',
      price: 24500,
      badge: 'EL MÁS ELEGIDO',
      popular: true,
      description: 'Cobertura completa del día de boda, desde Getting Ready hasta la fiesta.',
      features: [
        'Cobertura de 8 horas continuas',
        '2º Fotógrafo profesional asistente',
        'Sesión Previa Engagement (Compromiso)',
        'USB de madera en caja personalizada + Galería web',
        'Galería Web Ilimitada activa por 1 año',
        '350+ Fotografías editadas en color & B/N'
      ],
      notIncludes: [
        'Photobook impreso de lujo 30x30cm (Disponible como Add-on)',
        'Sesión Trash the Dress posterior'
      ]
    },
    {
      id: 'leyenda',
      name: 'PAQUETE LEYENDA (ALL-INCLUSIVE)',
      price: 42000,
      badge: 'EXPERIENCIA LEYENDA',
      description: 'Cobertura sin límite de tiempo, atención editorial completa y acabados de lujo.',
      features: [
        'Cobertura Ilimitada sin límite de horario',
        '2º Fotógrafo profesional principal',
        'Photobook impreso de lujo en lino (30x30cm - 40 págs)',
        'Sesión previa (Engagement) + Sesión posterior (Trash the Dress)',
        'Entrega Express Prioritaria 72 Horas',
        '600+ Fotografías editadas con retoque de alta gama'
      ],
      notIncludes: [
        'Gastos de viáticos internacionales fuera de México (se cotizan por separado)'
      ]
    }
  ],
  'xv-anos': [
    {
      id: 'esencial',
      name: 'PAQUETE ESENCIAL XV',
      price: 11500,
      description: 'Cobertura de misa y recepción básica con estilo fresco y juvenil.',
      features: [
        'Cobertura de 4 horas continuas',
        'Misa de Acción de Gracias + Recepción básica',
        'Galería Web HD por 3 meses',
        '130+ Fotografías editadas en alta resolución',
        'Entregables digitales en formato Web y Print'
      ],
      notIncludes: [
        'Sesión previa de fotos youth/editorial',
        'Álbum impreso o cuadros de bienvenida',
        '2º fotógrafo asistente'
      ]
    },
    {
      id: 'pro',
      name: 'PAQUETE XV PRO',
      price: 21500,
      badge: 'MÁS POPULAR',
      popular: true,
      description: 'Cobertura completa del evento con sesión previa de fotos youth/editorial.',
      features: [
        'Cobertura de 8 horas continuas',
        'Sesión previa de fotos con cambio de vestuario',
        'Entrega física en USB de madera + Galería Web',
        'Cuadro impreso 50x70cm con marco de madera',
        '300+ Fotografías editadas en HD',
        'Galería Web activa por 1 año'
      ],
      notIncludes: [
        'Photobook encuadernado de lujo (Disponible como Add-on)',
        'Cobertura de horario ilimitado tras la medianoche'
      ]
    },
    {
      id: 'imperial',
      name: 'PAQUETE XV IMPERIAL',
      price: 38000,
      badge: 'EDICIÓN IMPERIAL',
      description: 'Cobertura total de la celebración de XV Años con detalles de lujo impresos.',
      features: [
        'Cobertura sin límite de horario',
        '2º Fotógrafo asistente',
        'Sesión previa con múltiples cambios de outfit',
        'Photobook impreso de lujo 30x30cm (30 páginas)',
        'Cuadro de bienvenida 50x70cm con marco de madera',
        'Entrega express en 5 días hábiles'
      ],
      notIncludes: []
    }
  ],
  bautizos: [
    {
      id: 'ceremonia',
      name: 'PAQUETE CEREMONIA',
      price: 5500,
      description: 'Cobertura de la misa o ceremonia religiosa con calidez, agilidad y respeto.',
      features: [
        'Cobertura de 2 horas en iglesia / ceremonia',
        'Fotografía documental de bautizo, padrinos y familia',
        'Galería digital HD activa por 3 meses',
        '80+ Fotografías editadas en alta resolución',
        'Entrega digital lista para compartir con familiares'
      ],
      notIncludes: [
        'Cobertura de la recepción o fiesta posterior',
        'Impresiones fotográficas en papel fine art'
      ]
    },
    {
      id: 'recepcion',
      name: 'CEREMONIA + RECEPCIÓN',
      price: 12000,
      badge: 'RECOMENDADO',
      popular: true,
      description: 'Cobertura completa de la iglesia y comida o fiesta familiar (hasta 4 horas).',
      features: [
        'Cobertura de hasta 4 horas (Iglesia + Recepción)',
        'Retratos familiares espontáneos y foto grupal',
        'Galería digital HD ilimitada por 6 meses',
        '180+ Fotografías editadas en alta resolución',
        'Paquete de 20 fotos impresas fine art 5x7" de regalo'
      ],
      notIncludes: [
        'Horas adicionales después de 4 horas'
      ]
    }
  ],
  retratos: [
    {
      id: 'individual',
      name: 'SESIÓN INDIVIDUAL / PERSONAL',
      price: 3500,
      description: 'Para perfil profesional, branding personal o retratos artísticos en CDMX.',
      features: [
        '1.5 Horas de sesión en Estudio o Locación (CDMX)',
        '2 Cambios de ropa / outfit',
        '25 Fotografías editadas con retoque de piel fino',
        'Galería digital para selección'
      ],
      notIncludes: [
        'Maquillaje y peinado profesional (se cotiza extra)',
        'Impresiones en cuadro de madera'
      ]
    },
    {
      id: 'pareja',
      name: 'SESIÓN PAREJA / EDITORIAL',
      price: 6800,
      badge: 'ESTILO MAGAZINE',
      popular: true,
      description: 'Producción fotográfica de pareja o editorial con dirección de arte en CDMX.',
      features: [
        '2.5 Horas de sesión en exteriores o locación especial en CDMX',
        'Múltiples cambios de outfit con dirección de posado',
        '60 Fotografías editadas nivel portada de revista',
        'Galería Web HD activa por 1 año',
        'Derechos de uso impreso y personal'
      ],
      notIncludes: [
        'Locaciones con costo de renta por hora no incluidas'
      ]
    },
    {
      id: 'graduacion',
      name: 'SESIÓN GRADUACIÓN',
      price: 9500,
      badge: 'MÁS SOLICITADO',
      description: 'Sesión de graduación individual, familiar o en grupo de amigos en CDMX.',
      features: [
        '2 Horas de sesión en campus o locación a elegir en CDMX',
        'Toga, birrete, estola y cambio de ropa casual',
        'Cobertura individual + retratos con padres/familia',
        '40 Fotografías editadas en alta resolución',
        'Galería digital HD para descarga ilimitada'
      ],
      notIncludes: [
        'Renta de toga/birrete física por parte del estudio'
      ]
    }
  ],
  empresarial: [
    {
      id: 'headshots',
      name: 'PAQUETE HEADSHOTS & PERFIL CORPORATIVO',
      price: 4500,
      description: 'Fotografía de retrato profesional para directivos, ejecutivos y equipos en CDMX.',
      features: [
        'Hasta 5 colaboradores o perfil directivo',
        '1.5 Horas de sesión en estudio o instalaciones en CDMX',
        'Retoque digital de alta gama en piel y color',
        '20 Fotografías editadas en alta resolución',
        'Derechos de uso comercial, web y redes sociales'
      ],
      notIncludes: [
        'Maquillador en sitio (Disponible como Add-on)',
        'Cobertura de eventos masivos'
      ]
    },
    {
      id: 'branding',
      name: 'PAQUETE BRANDING & MARCA PERSONAL',
      price: 9500,
      badge: 'MÁS SOLICITADO',
      popular: true,
      description: 'Contenido visual estratégico para sitios web, redes y kits de prensa de marcas.',
      features: [
        '3 Horas de sesión en locación o empresa (CDMX)',
        'Dirección de posado y storytelling de marca',
        'Múltiples cambios de outfit y entornos de trabajo',
        '50 Fotografías editadas estilo editorial',
        'Galería Web HD con descarga en alta y baja resolución'
      ],
      notIncludes: [
        'Diseño de logotipos o diseño gráfico'
      ]
    },
    {
      id: 'corporativo',
      name: 'PAQUETE COBERTURA EVENTO CORPORATIVO',
      price: 18000,
      badge: 'CORPORATIVO PRO',
      description: 'Cobertura documental de congresos, galas, lanzamientos y ponencias en CDMX.',
      features: [
        'Cobertura de 6 horas continuas en CDMX',
        'Fotografía documental de ponentes, invitados y networking',
        'Adelanto de 10 fotografías en 12h para prensa y redes',
        '250+ Fotografías editadas en alta resolución',
        'Galería privada activa por 1 año con PIN institucional'
      ],
      notIncludes: [
        'Cobertura fuera de la Ciudad de México'
      ]
    }
  ]
};

export const ADDONS_CATALOG: AddOnOption[] = [
  {
    id: 'extra_hours',
    name: 'Horas Extra de Cobertura',
    price: 2000,
    description: 'Añade horas adicionales para documentar la fiesta o momentos previos.',
    type: 'counter',
    includes: [
      'Cobertura documental continua por hora',
      'Edición y entrega digital proporcional de fotos adicionales',
      'Sin recargo nocturno durante el evento'
    ]
  },
  {
    id: 'photobook_parents',
    name: 'Photobook Impreso para Padres / Padrinos',
    price: 4500,
    description: 'Álbum duplicado 20x20cm impreso en papel fotográfico fine art con pasta dura.',
    type: 'checkbox',
    includes: [
      'Encuadernación artesanal en lino o piel sintética',
      '20 páginas en papel fotográfico HD de 800 grs',
      'Diseño editorial de maquetación personalizado',
      'Caja protectora rígida incluida'
    ]
  },
  {
    id: 'additional_session',
    name: 'Sesión Previa o Post-Evento Adicional',
    price: 3500,
    description: 'Sesión de 2 horas en locación especial (Trash the dress, Save the date o Retrato familiar).',
    type: 'checkbox',
    includes: [
      '2 horas de sesión fotográfica en locación',
      '30 fotografías editadas en alta resolución',
      'Asesoría de vestuario y conceptos creativos',
      'Galería web para descarga'
    ]
  },
  {
    id: 'express_delivery',
    name: 'Entrega Prioritaria Express 48 Horas',
    price: 3000,
    description: 'Recibe todo el catálogo editado y tu galería web lista en menos de 48 horas.',
    type: 'checkbox',
    includes: [
      'Procesamiento y retoque prioritario en flujo acelerado',
      'Galería digital habilitada en 48h hábiles',
      'Adelanto de 15 fotos en 12 horas para redes sociales'
    ]
  },
  {
    id: 'welcome_canvas',
    name: 'Cuadro Impreso 50x70cm con Marco de Madera',
    price: 2500,
    description: 'Ampliación en alta definición lista para exhibir en el salón o tu hogar.',
    type: 'checkbox',
    includes: [
      'Impresión sobre lienzo canvas o papel fotográfico metallic',
      'Marco de madera sólida (negro, madero natural o blanco)',
      'Vidrio antireflejante de protección',
      'Listo para colgar'
    ]
  }
];
