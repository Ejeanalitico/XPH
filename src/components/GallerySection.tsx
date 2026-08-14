import React, { useEffect, useState } from 'react';
import { GalleryImage, GalleryCategory, RoutePath } from '../types';
import { Maximize2, X, ChevronLeft, ChevronRight, Camera, MapPin } from 'lucide-react';

interface GallerySectionProps {
  currentRoute: RoutePath;
  onNavigateRoute: (route: RoutePath) => void;
  images: GalleryImage[];
}

export const GallerySection: React.FC<GallerySectionProps> = ({
  currentRoute,
  onNavigateRoute,
  images,
}) => {
  const [activeCategory, setActiveCategory] = useState<GalleryCategory>('all');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  useEffect(() => {
    if (currentRoute === 'inicio') {
      setActiveCategory('all');
    } else {
      setActiveCategory(currentRoute as GalleryCategory);
    }
  }, [currentRoute]);

  const handleSelectCategory = (category: GalleryCategory) => {
    setActiveCategory(category);
    if (category !== 'all' && category !== 'previa') {
      onNavigateRoute(category as RoutePath);
    }
  };

  const filteredImages = images.filter((image) => {
    if (activeCategory === 'all') return true;
    return image.category === activeCategory;
  });

  const activeImage = selectedImageIndex !== null ? filteredImages[selectedImageIndex] : null;

  const handleNext = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (selectedImageIndex !== null && filteredImages.length > 0) {
      setSelectedImageIndex((selectedImageIndex + 1) % filteredImages.length);
    }
  };

  const handlePrev = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (selectedImageIndex !== null && filteredImages.length > 0) {
      setSelectedImageIndex(
        (selectedImageIndex - 1 + filteredImages.length) % filteredImages.length
      );
    }
  };

  return (
    <section id="galerias" className="py-20 bg-[#0B0F17] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold font-mono">
            REFERENCIAS VISUALES
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif-luxury text-white">
            Estilos y tipos de cobertura
          </h2>
          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
            Estas imágenes son referencias visuales de estilo y categoría; no se presentan como fotografías realizadas por Xavi.Ph. El portafolio propio se integrará por separado.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-10">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'bodas', label: 'Bodas' },
            { id: 'xv-anos', label: 'XV Años' },
            { id: 'bautizos', label: 'Bautizos & Familia' },
            { id: 'retratos', label: 'Retratos' },
            { id: 'empresarial', label: 'Empresarial' },
            { id: 'previa', label: 'Sesiones Previas' },
          ].map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectCategory(tab.id as GalleryCategory)}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? 'gold-gradient-bg text-black font-bold shadow-lg shadow-[#D4AF37]/20 scale-105'
                    : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {filteredImages.length === 0 ? (
          <div className="text-center py-16 bg-[#161C28] rounded-2xl border border-white/10 space-y-3">
            <Camera className="w-12 h-12 text-gray-500 mx-auto" />
            <p className="text-gray-300 font-medium text-base">No hay referencias disponibles en esta categoría.</p>
            <button
              onClick={() => handleSelectCategory('all')}
              className="px-4 py-2 rounded-xl text-xs font-semibold gold-gradient-bg text-black mt-2 cursor-pointer"
            >
              Ver todas
            </button>
          </div>
        ) : (
          <div className="masonry-grid">
            {filteredImages.map((image, index) => (
              <button
                type="button"
                key={image.id}
                className="masonry-item relative group rounded-2xl overflow-hidden bg-[#161C28] border border-white/10 hover:border-[#D4AF37]/50 transition-all duration-300 shadow-xl cursor-pointer text-left"
                onClick={() => setSelectedImageIndex(index)}
              >
                <img
                  src={image.url}
                  alt={image.title}
                  className="w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                  <span className="px-2.5 py-1 rounded-lg bg-[#0B0F17]/80 backdrop-blur-md text-[10px] font-semibold tracking-wider uppercase text-[#D4AF37] border border-white/10">
                    REFERENCIA
                  </span>
                  <div className="p-2 rounded-xl bg-[#0B0F17]/80 text-white border border-white/20">
                    <Maximize2 className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 space-y-1">
                  <h3 className="text-base font-bold text-white font-serif-luxury">{image.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <MapPin className="w-3 h-3 text-[#D4AF37]" />
                    <span>{image.location}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeImage && selectedImageIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6"
          onClick={() => setSelectedImageIndex(null)}
        >
          <button
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-[#D4AF37] transition-all z-50 cursor-pointer"
            aria-label="Cerrar imagen"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-[#D4AF37] transition-all z-50 cursor-pointer hidden sm:block"
            aria-label="Imagen anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-[#D4AF37] transition-all z-50 cursor-pointer hidden sm:block"
            aria-label="Imagen siguiente"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div
            className="relative max-w-5xl w-full max-h-[90vh] bg-[#161C28] rounded-2xl border border-white/15 overflow-hidden flex flex-col md:flex-row shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[300px] md:min-h-[500px]">
              <img
                src={activeImage.url}
                alt={activeImage.title}
                className="max-h-[70vh] md:max-h-[85vh] w-auto object-contain"
              />
            </div>

            <div className="w-full md:w-80 p-6 bg-[#161C28] border-t md:border-t-0 md:border-l border-white/10 space-y-4">
              <span className="px-2.5 py-1 rounded-md bg-[#0B0F17] text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider border border-white/10 inline-block">
                Imagen de referencia
              </span>
              <h3 className="text-2xl font-bold font-serif-luxury text-white">{activeImage.title}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <MapPin className="w-4 h-4 text-[#D4AF37]" />
                <span>{activeImage.location}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Esta imagen sirve únicamente como referencia visual y no forma parte del portafolio propio de Xavi.Ph.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
