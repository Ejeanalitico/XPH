import { ADDONS_CATALOG, PACKAGES_BY_EVENT } from '../data/packages';
import { AddOnOption, EventType, PackageOption } from '../types';

export const CURRENT_CATALOG_VERSION = 2;
const EVENT_TYPES: EventType[] = ['bodas', 'xv-anos', 'bautizos', 'retratos', 'empresarial'];

export function resolvePublishedPackages(config: Record<string, any> = {}): Record<EventType, PackageOption[]> {
  const cloud = config.packages;
  const managed = cloud && typeof cloud === 'object' && Object.values(cloud).flat().some((pkg: any) => pkg?.managedByAdmin);
  if (!managed) return PACKAGES_BY_EVENT;
  if (Number(config.catalogVersion || 0) >= CURRENT_CATALOG_VERSION) return cloud;

  return Object.fromEntries(EVENT_TYPES.map((type) => {
    const localList = PACKAGES_BY_EVENT[type] || [];
    const cloudList: PackageOption[] = Array.isArray(cloud[type]) ? cloud[type] : [];
    const cloudById = new Map(cloudList.map((pkg) => [pkg.id, pkg]));
    const localIds = new Set(localList.map((pkg) => pkg.id));
    const merged = localList.map((pkg) => cloudById.has(pkg.id) ? { ...pkg, ...cloudById.get(pkg.id), managedByAdmin: true } : pkg);
    const extras = cloudList.filter((pkg) => !localIds.has(pkg.id) && pkg.id !== 'personalizado');
    return [type, [...merged, ...extras]];
  })) as Record<EventType, PackageOption[]>;
}

export function resolvePublishedAddons(config: Record<string, any> = {}): AddOnOption[] {
  const cloud: AddOnOption[] = Array.isArray(config.addons) ? config.addons : [];
  const managed = cloud.some((addon) => addon?.managedByAdmin);
  if (!managed) return ADDONS_CATALOG;
  if (Number(config.catalogVersion || 0) >= CURRENT_CATALOG_VERSION) return cloud;

  const cloudById = new Map(cloud.map((addon) => [addon.id, addon]));
  const localIds = new Set(ADDONS_CATALOG.map((addon) => addon.id));
  const merged = ADDONS_CATALOG.map((addon) => {
    const saved = cloudById.get(addon.id);
    return saved ? { ...addon, ...saved, type: addon.type, managedByAdmin: true } : addon;
  });
  return [...merged, ...cloud.filter((addon) => !localIds.has(addon.id))];
}
