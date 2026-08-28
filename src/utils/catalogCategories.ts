import { CatalogCategory, PackageOption, RoutePath } from '../types';

export const BUILT_IN_CATEGORY_LABELS: Record<string, string> = {
  bodas: 'Bodas',
  'xv-anos': 'XV Años',
  bautizos: 'Bautizos & Familia',
  retratos: 'Retratos & Editorial',
  empresarial: 'Empresarial & Branding',
};

export const DEFAULT_CATALOG_CATEGORIES: CatalogCategory[] = Object.entries(BUILT_IN_CATEGORY_LABELS).map(([id, name], index) => ({
  id,
  name,
  slug: id,
  description: '',
  imageUrl: '',
  active: true,
  order: index + 1,
}));

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60);

export function resolvePublishedCategories(
  config: Record<string, any> = {},
  packages: Record<string, PackageOption[]> = {},
): CatalogCategory[] {
  const raw = Array.isArray(config.catalogCategories) ? config.catalogCategories : [];
  const source = raw.length ? raw : DEFAULT_CATALOG_CATEGORIES;
  const categories = source.map((item: any, index: number): CatalogCategory => ({
    id: String(item?.id || `categoria-${index + 1}`),
    name: String(item?.name || BUILT_IN_CATEGORY_LABELS[String(item?.id || '')] || 'Categoría'),
    slug: slugify(String(item?.slug || item?.name || item?.id || `categoria-${index + 1}`)),
    description: String(item?.description || ''),
    imageUrl: String(item?.imageUrl || ''),
    active: item?.active !== false,
    order: Number(item?.order) || index + 1,
    createdAt: String(item?.createdAt || ''),
    updatedAt: String(item?.updatedAt || ''),
  }));

  Object.keys(packages).forEach((id) => {
    if (categories.some((item) => item.id === id)) return;
    categories.push({
      id,
      name: BUILT_IN_CATEGORY_LABELS[id] || id,
      slug: slugify(id),
      description: '',
      imageUrl: '',
      active: true,
      order: categories.length + 1,
    });
  });

  return categories.sort((a, b) => a.order - b.order);
}

export const categoryLabel = (id: string, categories: CatalogCategory[]) =>
  categories.find((item) => item.id === id)?.name || BUILT_IN_CATEGORY_LABELS[id] || id;

const BUILT_IN_ROUTES = new Set<RoutePath>(['bodas', 'xv-anos', 'bautizos', 'retratos', 'empresarial']);

export const isBuiltInCategoryRoute = (value: string): value is Exclude<RoutePath, 'inicio'> =>
  BUILT_IN_ROUTES.has(value as RoutePath);
