import { next, rewrite } from '@vercel/functions';

// Root query links need to be resolved before Vercel serves static index.html.
// Preserve the original browser URL and all gallery/review access parameters.
export default function middleware(request) {
  const url = new URL(request.url);
  if (url.searchParams.has('xph-admin')) return next();
  if (url.searchParams.has('galeria') || url.searchParams.has('xph-review')) {
    url.pathname = '/api/category-page';
    url.searchParams.set('share', '1');
    url.searchParams.delete('signingToken');
    return rewrite(url);
  }
  return next();
}

export const config = { matcher: ['/'], runtime: 'nodejs' };
