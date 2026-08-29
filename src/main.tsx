import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import AppV2 from './AppV2';
import { ClientGalleryPage } from './components/ClientGalleryPage';
import { PrivateGalleryDownloadSettings } from './components/PrivateGalleryDownloadSettings';
import { UnifiedAdminDashboard } from './components/UnifiedAdminDashboard';
import { AdminExitHomeEnhancer } from './components/AdminExitHomeEnhancer';
import { MobileContractSigningPage } from './components/MobileContractSigningPage';
import { isAnalyticsExcluded } from './utils/analyticsPrivacy';
import './index.css';
import './branding.css';

// Route browser requests that target the legacy proxy through the safety wrapper.
// This keeps existing callers unchanged while preventing a desktop preview from
// invalidating a mobile contract link and normalizes duplicate contract records.
const nativeFetch = window.fetch.bind(window);
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string') {
    const safeUrl = input.replace(/^\/api\/proxy(?=\?|$)/, '/api/proxy-safe');
    return nativeFetch(safeUrl, init);
  }
  if (input instanceof URL && input.origin === window.location.origin && input.pathname === '/api/proxy') {
    const safeUrl = new URL(input.toString());
    safeUrl.pathname = '/api/proxy-safe';
    return nativeFetch(safeUrl, init);
  }
  return nativeFetch(input, init);
}) as typeof window.fetch;

// XPH production entry: public quote V2 + editable promotions.
const params = new URLSearchParams(window.location.search);
const adminMode = params.get('xph-admin');
const gallerySlug = params.get('galeria') || '';
const galleryToken = params.get('k') || '';
const signingMatch = window.location.pathname.match(/^\/firmar\/([^/]+)\/?$/);
const signingToken = signingMatch ? decodeURIComponent(signingMatch[1]) : '';

let content = <AppV2 />;

if (signingToken) {
  content = <MobileContractSigningPage token={signingToken} />;
} else if (adminMode === 'panel' || adminMode === 'crm' || adminMode === 'galeria' || adminMode === 'portadas' || adminMode === 'promociones' || adminMode === 'analitica') {
  content = (
    <>
      <UnifiedAdminDashboard
        initialTab={adminMode === 'crm' ? 'business' : adminMode === 'portadas' ? 'covers' : adminMode === 'galeria' ? 'public' : adminMode === 'promociones' ? 'promotions' : adminMode === 'analitica' ? 'analytics' : 'business'}
      />
      <PrivateGalleryDownloadSettings />
      <AdminExitHomeEnhancer />
    </>
  );
} else if (gallerySlug && galleryToken) {
  content = <ClientGalleryPage slug={gallerySlug} token={galleryToken} />;
}

const publicView = !adminMode && !(gallerySlug && galleryToken) && !signingToken;
if (!publicView) {
  const robots = document.querySelector('meta[name="robots"]') || document.createElement('meta');
  robots.setAttribute('name', 'robots');
  robots.setAttribute('content', 'noindex,nofollow,noarchive');
  if (!robots.parentNode) document.head.appendChild(robots);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {content}
    {publicView ? <Analytics beforeSend={(event) => isAnalyticsExcluded() ? null : event} /> : null}
  </StrictMode>,
);
