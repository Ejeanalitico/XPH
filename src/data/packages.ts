import { EventType, PackageOption, AddOnOption } from '../types';
import packagesJson from './packages.json';
import addonsJson from './addons.json';

export const PACKAGES_BY_EVENT = packagesJson as Record<EventType, PackageOption[]>;
export const ADDONS_CATALOG = addonsJson as AddOnOption[];
