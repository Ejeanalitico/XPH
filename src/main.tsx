import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppV2 from './AppV2';
import { ClientGalleryPage } from './components/ClientGalleryPage';
import { PrivateGalleryDownloadSettings } from './components/PrivateGalleryDownloadSettings';
import { UnifiedAdminDashboard } from './components/UnifiedAdminDashboard';
import { AdminExitHomeEnhancer } from './components/AdminExitHomeEnhancer';
import './index.css';
import './branding.css';

// XPH production entry: public quote V2 + editable promotions.
const params = new URLSearchParams(window.location.search);
const adminMode = params.get('xph-admin');
const gallerySlug = params.get('galeria') || '';
const galleryToken = params.get('k') || '';

let content = <AppV2 />;

if (adminMode === 'panel' || adminMode === 'galeria' || adminMode === 'portadas' || adminMode === 'promociones') {
  content = (
    <>
      <UnifiedAdminDashboard
        initialTab={adminMode === 'portadas' ? 'covers' : adminMode === 'galeria' ? 'public' : adminMode === 'promociones' ? 'promotions' : 'packages'}
      />
      <PrivateGalleryDownloadSettings />
      <AdminExitHomeEnhancer />
    </>
  );
} else if (gallerySlug && galleryToken) {
  content = <ClientGalleryPage slug={gallerySlug} token={galleryToken} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{content}</StrictMode>,
);
