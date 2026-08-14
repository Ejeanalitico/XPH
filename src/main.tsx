import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminFeatureFieldsEnhancer } from './components/AdminFeatureFieldsEnhancer';
import { ClientGalleryPage } from './components/ClientGalleryPage';
import { CoverAdminPage } from './components/CoverAdminPage';
import './index.css';

const params = new URLSearchParams(window.location.search);
const adminMode = params.get('xph-admin');
const gallerySlug = params.get('galeria') || '';
const galleryToken = params.get('k') || '';

let content = <App />;
if (adminMode === 'portadas') {
  content = <CoverAdminPage />;
} else if (adminMode === 'panel' || adminMode === 'galeria') {
  content = (
    <div className="min-h-screen bg-[#0B0F17]">
      <div className="sticky top-0 z-50 bg-[#0B0F17]/95 backdrop-blur border-b border-white/10 px-4 py-2">
        <div className="max-w-7xl mx-auto flex justify-end">
          <a href="/?xph-admin=portadas" className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-bold">
            Editar texto y recorte de portadas
          </a>
        </div>
      </div>
      <AdminDashboard />
      <AdminFeatureFieldsEnhancer />
    </div>
  );
} else if (gallerySlug && galleryToken) {
  content = <ClientGalleryPage slug={gallerySlug} token={galleryToken} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{content}</StrictMode>,
);
