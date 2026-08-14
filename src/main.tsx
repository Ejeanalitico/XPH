import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminFeatureFieldsEnhancer } from './components/AdminFeatureFieldsEnhancer';
import { ClientGalleryPage } from './components/ClientGalleryPage';
import './index.css';

const params = new URLSearchParams(window.location.search);
const adminMode = params.get('xph-admin');
const gallerySlug = params.get('galeria') || '';
const galleryToken = params.get('k') || '';

let content = <App />;
if (adminMode === 'panel' || adminMode === 'galeria') {
  content = (
    <>
      <AdminDashboard />
      <AdminFeatureFieldsEnhancer />
    </>
  );
} else if (gallerySlug && galleryToken) {
  content = <ClientGalleryPage slug={gallerySlug} token={galleryToken} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{content}</StrictMode>,
);
