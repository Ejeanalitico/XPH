import { GalleryImage, HeroCoverSetting, RoutePath } from '../types';

const PUBLIC_MEDIA_CACHE_KEY = 'xph-public-media:v2';
const CACHE_VERSION = 2;

export interface PublicMediaSnapshot {
  version: number;
  galleryImages: GalleryImage[];
  heroCovers: Partial<Record<RoutePath, string>>;
  heroCoverSettings: Partial<Record<RoutePath, HeroCoverSetting>>;
}

export const filterPublicGalleryImages = (images: unknown): GalleryImage[] => {
  if (!Array.isArray(images)) return [];

  return images.filter((image): image is GalleryImage =>
    Boolean(
      image?.id && image?.url && image?.category &&
      image.visibility !== 'private' && image.visibility !== 'cover' &&
      image.mediaType !== 'gallery-meta' && image.mediaType !== 'cover-meta' &&
      image.mediaType !== 'video' && image.category !== 'private'
    )
  );
};

export const readPublicMediaCache = (): PublicMediaSnapshot | null => {
  try {
    const raw = window.localStorage.getItem(PUBLIC_MEDIA_CACHE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw) as Partial<PublicMediaSnapshot>;
    if (
      cached.version !== CACHE_VERSION ||
      !Array.isArray(cached.galleryImages) ||
      !cached.heroCovers || typeof cached.heroCovers !== 'object' ||
      !cached.heroCoverSettings || typeof cached.heroCoverSettings !== 'object'
    ) {
      return null;
    }

    return cached as PublicMediaSnapshot;
  } catch {
    return null;
  }
};

export const writePublicMediaCache = (snapshot: Omit<PublicMediaSnapshot, 'version'>) => {
  try {
    window.localStorage.setItem(
      PUBLIC_MEDIA_CACHE_KEY,
      JSON.stringify({ version: CACHE_VERSION, ...snapshot }),
    );
  } catch {
    // La página puede seguir funcionando si el navegador bloquea localStorage.
  }
};

const preloadImage = (url: string): Promise<void> => new Promise((resolve) => {
  if (!url) {
    resolve();
    return;
  }

  const image = new Image();
  let settled = false;
  let decoding = false;
  const timeoutId = window.setTimeout(() => finish(), 3000);

  function finish() {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeoutId);
    image.onload = null;
    image.onerror = null;
    resolve();
  }

  const decodeAndFinish = () => {
    if (decoding || settled) return;
    decoding = true;
    if (typeof image.decode === 'function') {
      void image.decode().catch(() => undefined).finally(finish);
    } else {
      finish();
    }
  };

  image.onload = decodeAndFinish;
  image.onerror = finish;
  image.src = url;
  if (image.complete) decodeAndFinish();
});

export const preloadCriticalPublicMedia = async (
  snapshot: Omit<PublicMediaSnapshot, 'version'>,
  route: RoutePath,
) => {
  const heroUrl = snapshot.heroCoverSettings[route]?.url || snapshot.heroCovers[route];
  const urls = [heroUrl, ...snapshot.galleryImages.slice(0, 5).map((image) => image.url)]
    .filter((url): url is string => Boolean(url));

  await Promise.allSettled([...new Set(urls)].map(preloadImage));
};
