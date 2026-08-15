import { EventType, PackageOption, AddOnOption } from '../types';
import packagesJson from './packages.json';

export const PACKAGES_BY_EVENT = packagesJson as Record<EventType, PackageOption[]>;

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
