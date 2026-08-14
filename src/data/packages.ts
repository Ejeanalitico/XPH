import { EventType, PackageOption, AddOnOption } from '../types';

export const PACKAGES_BY_EVENT: Record<EventType, PackageOption[]> = {
  bodas: [
    {
      id: 'civil',
      name: 'EL PRIMER CAPÍTULO',
      price: 6499,
      description: 'Cobertura para boda civil con fotografía y video, diseñada para una celebración íntima y completa.',
      features: [
        '5 horas de cobertura',
        'Fotografía ilimitada durante la cobertura',
        'Video cinematográfico',
        'Sesión fotográfica previa',
        '50 fotografías editadas',
        'Galería digital Lifetime',
        'Entrega en 15 días hábiles',
      ],
      notIncludes: ['Servicios adicionales no especificados en el paquete'],
    },
    {
      id: 'pro',
      name: 'BODA DE ENSUEÑO',
      price: 9990,
      badge: 'PAQUETE PROFESIONAL',
      popular: true,
      description: 'Cobertura profesional con preparación de novia, sesión previa, fotografía y video.',
      features: [
        '6 horas de fotografía ilimitada y video',
        'Maquillaje y peinado de novia con prueba',
        'Sesión fotográfica previa',
        '50 fotografías editadas',
        'Video profesional a 2 cámaras',
        'Entrega digital / USB',
      ],
      notIncludes: ['Adicionales y horas extra fuera de la cobertura contratada'],
    },
  ],
  'xv-anos': [
    {
      id: 'noche-estrellas',
      name: 'NOCHE DE ESTRELLAS',
      price: 6499,
      badge: 'XV AÑOS',
      popular: true,
      description: 'Cobertura de XV años con fotografía y video para documentar los momentos principales de la celebración.',
      features: [
        '5 horas de fotografía y video',
        'Cobertura de misa cuando aplique',
        'Cobertura del vals',
        '50 fotografías digitales editadas',
      ],
      notIncludes: ['Servicios adicionales no especificados en el paquete'],
    },
    {
      id: 'pro',
      name: 'XV AÑOS PROFESIONAL',
      price: 9990,
      description: 'Paquete profesional con preparación de quinceañera, fotografía y video.',
      features: [
        'Maquillaje de quinceañera con prueba',
        'Fotografía ilimitada durante la cobertura contratada',
        '50 fotografías editadas',
        'Video profesional a 2 cámaras',
        'Entrega en USB',
      ],
      notIncludes: ['Adicionales y horas extra fuera de la cobertura contratada'],
    },
  ],
  bautizos: [
    {
      id: 'personalizado',
      name: 'COTIZACIÓN PERSONALIZADA',
      price: 0,
      popular: true,
      description: 'El precio se define según duración, ceremonia, recepción, ubicación y entregables requeridos.',
      features: [
        'Cotización según necesidades del evento',
        'Cobertura en CDMX, Estado de México y zona centro',
        'Confirmación de disponibilidad antes de cualquier apartado',
      ],
    },
  ],
  retratos: [
    {
      id: 'personalizado',
      name: 'COTIZACIÓN PERSONALIZADA',
      price: 0,
      popular: true,
      description: 'Sesiones personales, de pareja, graduación o editoriales cotizadas según locación y producción.',
      features: [
        'Cotización según duración y locación',
        'Dirección fotográfica durante la sesión',
        'Entregables definidos antes de confirmar',
      ],
    },
  ],
  empresarial: [
    {
      id: 'personalizado',
      name: 'COTIZACIÓN PERSONALIZADA',
      price: 0,
      popular: true,
      description: 'Fotografía corporativa, headshots, branding y eventos cotizados según equipo, tiempo y alcance.',
      features: [
        'Cotización según número de personas y horas',
        'Opciones para retrato, branding y cobertura de eventos',
        'Entregables y derechos de uso definidos en la propuesta',
      ],
    },
  ],
};

export const ADDONS_CATALOG: AddOnOption[] = [
  {
    id: 'extra_hours',
    name: 'Hora Extra de Cobertura',
    price: 500,
    description: 'Hora completa adicional de cobertura.',
    type: 'counter',
    includes: ['1 hora adicional de cobertura'],
  },
  {
    id: 'photobook_10',
    name: 'Photobook de 10 páginas',
    price: 1500,
    description: 'Photobook adicional de 10 páginas.',
    type: 'checkbox',
  },
  {
    id: 'photobook_15',
    name: 'Photobook de 15 páginas',
    price: 2000,
    description: 'Photobook adicional de 15 páginas.',
    type: 'checkbox',
  },
  {
    id: 'cuadro_40x60',
    name: 'Cuadro 40×60 cm',
    price: 1000,
    description: 'Cuadro fotográfico de 40×60 cm.',
    type: 'checkbox',
  },
  {
    id: 'cuadro_100x70',
    name: 'Cuadro 100×70 cm',
    price: 2000,
    description: 'Cuadro fotográfico de 100×70 cm.',
    type: 'checkbox',
  },
];
