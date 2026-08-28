import React, { useEffect, useState } from 'react';
import { CatalogCategory, GalleryImage, GalleryCategory, RoutePath } from '../types';
import { Maximize2, X, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { SafeImage } from './SafeImage';
import { isBuiltInCategoryRoute } from '../utils/catalogCategories';

interface GallerySectionProps {
  currentRoute: RoutePath;
  onNavigateRoute?: (route: RoutePath) => void;
  images: GalleryImage[];
  categories?: CatalogCategory[];
  favorites?: string[];
  onToggleFavorite?: (imageId: string) => void;
  onShowToast: (title: string, description?: string) => void;
  loading?: boolean;
}

const INITIAL_VISIBLE_PHOTOS = 5;
const galleryAspectRatio = (index: number) => index % 3 === 2 ? '16 / 10' : '2 / 3';
const CATEGORY_LABELS: Record<string, string> = {
  bodas: 'boda',
  'xv-anos': 'XV años',
  bautizos: 'bautizo y familia',
  retratos: 'retrato',
  empresarial: 'fotografía empresarial',
  previa: 'sesión previa',
};

export const GallerySection: React.FC<GallerySectionProps> = ({
  currentRoute,
  onNavigateRoute,
  images,
  categories = [],
  loading = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<GalleryCategory>('all');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_PHOTOS);

  useEffect(() => {
    if (currentRoute === 'inicio') {
      setActiveCategory('all');
    } else {
      setActiveCategory(currentRoute as GalleryCategory);
    }
    setVisibleCount(INITIAL_VISIBLE_PHOTOS);
    setSelectedImageIndex(null);
  }, [currentRoute]);

  const handleSelectCategory = (cat: GalleryCategory) => {
    setActiveCategory(cat);
    setVisibleCount(INITIAL_VISIBLE_PHOTOS);
    setSelectedImageIndex(null);
    if (cat !== 'all' && cat !== 'previa' && isBuiltInCategoryRoute(cat) && onNavigateRoute) {
      onNavigateRoute(cat);
    }
  };

  const filteredImages = images.filter((img) => {
    if (activeCategory === 'all') return true;
    return img.category === activeCategory;
  });

  const visibleImages = filteredImages.slice(0, visibleCount);
  const hasMoreImages = visibleCount < filteredImages.length;
  const activeImage = selectedImageIndex !== null ? visibleImages[selectedImageIndex] : null;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex !== null && visibleImages.length > 0) {
      setSelectedImageIndex((selectedImageIndex + 1) % visibleImages.length);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex !== null && visibleImages.length > 0) {
      setSelectedImageIndex((selectedImageIndex - 1 + visibleImages.length) % visibleImages.length);
    }
  };

  return (
    <section
      id="galerias"
      className="py-20 bg-[#0B0F17] border-b border-white/5 relative"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4 mb-8 sm:mb-12">
          <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#D4AF37] font-semibold font-mono">
            PORTAFOLIO FOTOGRÁFICO
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold font-serif-luxury text-white">
            Galerías Editoriales & Historias Documentadas
          </h2>
          <p className="text-gray-300 text-xs sm:text-base leading-relaxed">
            Cada captura cuenta una historia viva con iluminación natural, composición cinematográfica y edición artesanal en la Ciudad de México.
          </p>
        </div>

        <div className="flex justify-center -mx-3 sm:mx-0 px-3 sm:px-0 mb-8 sm:mb-10">
          <div className="flex overflow-x-auto no-scrollbar max-w-full gap-1.5 sm:gap-2.5 p-1 rounded-2xl bg-[#161C28]/80 border border-white/10 shadow-lg">
            {[
              { id: 'all', label: 'Todas las Fotos' },
              ...categories.filter((category) => category.active).map((category) => ({ id: category.id, label: category.name })),
              ...(images.some((image) => image.category === 'previa') ? [{ id: 'previa', label: 'Sesiones Previas' }] : []),
            ].filter((tab, index, tabs) => tabs.findIndex((item) => item.id === tab.id) === index).map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectCategory(tab.id as GalleryCategory)}
                  className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? 'gold-gradient-bg text-black font-bold shadow-lg shadow-[#D4AF37]/20 scale-105'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="masonry-grid" aria-label="Cargando fotografías" aria-busy="true">
            {Array.from({ length: INITIAL_VISIBLE_PHOTOS }, (_, index) => (
              <div
                key={index}
                className="masonry-item rounded-2xl overflow-hidden bg-gradient-to-br from-[#161C28] via-[#111722] to-[#0B0F17] border border-white/10 animate-pulse"
                style={{ aspectRatio: galleryAspectRatio(index) }}
              />
            ))}
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-16 bg-[#161C28] rounded-2xl border border-white/10 space-y-3">
            <Camera className="w-12 h-12 text-gray-500 mx-auto" />
            <p className="text-gray-300 font-medium text-base">
              No hay fotografías disponibles en esta categoría por ahora.
            </p>
            <button
              type="button"
              onClick={() => handleSelectCategory('all')}
              className="px-4 py-2 rounded-xl text-xs font-semibold gold-gradient-bg text-black mt-2 cursor-pointer"
            >
              Explorar Todas las Fotos
            </button>
          </div>
        ) : (
          <>
            <div className="masonry-grid">
              {visibleImages.map((img, index) => (
                <div
                  key={img.id}
                  className="masonry-item relative group rounded-2xl overflow-hidden bg-[#161C28] border border-white/10 hover:border-[#D4AF37]/50 transition-all duration-300 shadow-xl cursor-pointer select-none"
                  onClick={() => setSelectedImageIndex(index)}
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                  style={{ aspectRatio: galleryAspectRatio(index) }}
                >
                  <SafeImage
                    src={img.url}
                    alt={`${img.title || `Fotografía de ${CATEGORY_LABELS[img.category] || 'evento'}`} por XPH${img.location ? ` en ${img.location}` : ''}`}
                    preventDownload
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="p-2 rounded-xl bg-[#0B0F17]/80 text-white border border-white/20 backdrop-blur-md">
                      <Maximize2 className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMoreImages && (
              <div className="flex justify-center mt-10">
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => Math.min(current + INITIAL_VISIBLE_PHOTOS, filteredImages.length))}
                  className="px-7 py-3 rounded-xl border border-[#D4AF37]/50 bg-[#161C28] text-[#D4AF37] hover:bg-[#D4AF37]/10 font-bold text-sm transition-all"
                >
                  Ver más fotografías
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {activeImage && selectedImageIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6"
          onClick={() => setSelectedImageIndex(null)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-[#D4AF37] transition-all z-50 cursor-pointer"
            aria-label="Cerrar fotografía"
          >
            <X className="w-6 h-6" />
          </button>

          {visibleImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-[#D4AF37] transition-all z-50 cursor-pointer hidden sm:block"
                aria-label="Fotografía anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-[#D4AF37] transition-all z-50 cursor-pointer hidden sm:block"
                aria-label="Fotografía siguiente"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div
            className="relative max-w-6xl w-full max-h-[92vh] rounded-2xl overflow-hidden flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <SafeImage
              src={activeImage.url}
              alt="Fotografía XPH"
              preventDownload
              className="max-h-[90vh] max-w-full w-auto h-auto object-contain select-none"
            />
          </div>
        </div>
      )}
    </section>
  );
};
