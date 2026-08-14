import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ClientGalleryPage } from './components/ClientGalleryPage';
import { PrivateGalleryDownloadSettings } from './components/PrivateGalleryDownloadSettings';
import { UnifiedAdminDashboard } from './components/UnifiedAdminDashboard';
import './index.css';
import './branding.css';

const params = new URLSearchParams(window.location.search);
const adminMode = params.get('xph-admin');
const gallerySlug = params.get('galeria') || '';
const galleryToken = params.get('k') || '';

let content = <App />;

if (adminMode === 'panel' || adminMode === 'galeria' || adminMode === 'portadas') {
  content = (
    <>
      <UnifiedAdminDashboard
        initialTab={adminMode === 'portadas' ? 'covers' : adminMode === 'galeria' ? 'public' : 'packages'}
      />
      <PrivateGalleryDownloadSettings />
    </>
  );
} else if (gallerySlug && galleryToken) {
  content = <ClientGalleryPage slug={gallerySlug} token={galleryToken} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{content}</StrictMode>,
);
