import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { BulkGalleryAdmin } from './components/BulkGalleryAdmin';
import './index.css';

const params = new URLSearchParams(window.location.search);
const isBulkGalleryAdmin = params.get('xph-admin') === 'galeria';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isBulkGalleryAdmin ? <BulkGalleryAdmin /> : <App />}
  </StrictMode>,
);
