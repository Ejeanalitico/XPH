import React, { useState, useEffect } from 'react';
import { GalleryImage, GalleryCategory, RoutePath } from '../types';
import { Heart, Maximize2, X, ChevronLeft, ChevronRight, Download, Camera, MapPin, Eye } from 'lucide-react';
import { getDirectGoogleDriveUrl } from '../utils/googleDrive';
import { SafeImage } from './SafeImage';

interface GallerySectionProps {
  currentRoute: RoutePath;
  onNavigateRoute?: (route: RoutePath) => void;
  images: GalleryImage[];
  favorites?: string[];
  onToggleFavorite?: (imageId: string) => void;
  onShowToast: (title: string, description?: string) => void;
}

export const GallerySection: React.FC<GallerySectionProps> = ({
  currentRoute,
  onNavigateRoute,
  images,
  favorites = [],
  onToggleFavorite,
  onShowToast,
}) => {
  const [activeCategory, setActiveCategory] = useState<GalleryCategory>('all');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // Automatically update active category tab when route changes
  useEffect(() => {
    if (currentRoute === 'inicio') {
      setActiveCategory('all');
    } else {
      setActiveCategory(currentRoute as GalleryCategory);
    }
  }, [currentRoute]);

  const handleSelectCategory = (cat: GalleryCategory) => {
    setActiveCategory(cat);
    if (cat !== 'all' && cat !== 'previa' && onNavigateRoute) {
      onNavigateRoute(cat as RoutePath);
    }
  };

  // Filter images based on selected category
  const filteredImages = images.filter((img) => {
    if (activeCategory === 'all') return true;
    return img.category === activeCategory;
  });

  const activeImage = selectedImageIndex !== null ? filteredImages[selectedImageIndex] : null;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex !== null && filteredImages.length > 0) {
      setSelectedImageIndex((selectedImageIndex + 1) % filteredImages.length);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex !== null && filteredImages.length > 0) {
      setSelectedImageIndex(
        (selectedImageIndex - 1 + filteredImages.length) % filteredImages.length
      );
    }
  };

  const handleDownload = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    onShowToast('Descarga HD', `Iniciando muestra de "${title}" en alta definición sin marca de agua.`);
  };

  return (
    <section id="galerias" className="py-20 bg-[#0B0F17] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
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

        {/* Filter Tabs Bar with Mobile-Friendly Horizontal Scroll */}
        <div className="flex justify-center -mx-3 sm:mx-0 px-3 sm:px-0 mb-8 sm:mb-10">
          <div className="flex overflow-x-auto no-scrollbar max-w-full gap-1.5 sm:gap-2.5 p-1 rounded-2xl bg-[#161C28]/80 border border-white/10 shadow-lg">
            {[
              { id: 'all', label: 'Todas las Fotos' },
              { id: 'bodas', label: 'Bodas Editorial' },
              { id: 'xv-anos', label: 'XV Años' },
              { id: 'bautizos', label: 'Bautizos & Familia' },
              { id: 'retratos', label: 'Retratos & Moda' },
              { id: 'empresarial', label: 'Empresarial & Branding' },
              { id: 'previa', label: 'Sesiones Previas' },
            ].map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectCategory(tab.id as GalleryCategory)}
                  className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? 'gold-gradient-bg text-black font-bold shadow-lg shadow-[#D4AF37]/20 scale-105'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Masonry Grid */}
        {filteredImages.length === 0 ? (
          <div className="text-center py-16 bg-[#161C28] rounded-2xl border border-white/10 space-y-3">
            <Camera className="w-12 h-12 text-gray-500 mx-auto" />
            <p className="text-gray-300 font-medium text-base">
              No hay fotografías disponibles en esta categoría por ahora.
            </p>
            <button
              onClick={() => handleSelectCategory('all')}
              className="px-4 py-2 rounded-xl text-xs font-semibold gold-gradient-bg text-black mt-2 cursor-pointer"
            >
              Explorar Todas las Fotos
            </button>
          </div>
        ) : (
          <div className="masonry-grid">
            {filteredImages.map((img, index) => {
              return (
                <div
                  key={img.id}
                  className="masonry-item relative group rounded-2xl overflow-hidden bg-[#161C28] border border-white/10 hover:border-[#D4AF37]/50 transition-all duration-300 shadow-xl cursor-pointer"
                  onClick={() => setSelectedImageIndex(index)}
                >
                  <SafeImage
                    src={img.url}
                    alt={img.title}
                    className="w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4" />

                  {/* Top Bar inside Overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                    <span className="px-2.5 py-1 rounded-lg bg-[#0B0F17]/80 backdrop-blur-md text-[10px] font-semibold tracking-wider uppercase text-[#D4AF37] border border-white/10">
                      {img.category.toUpperCase()}
                    </span>
                    <div className="p-2 rounded-xl bg-[#0B0F17]/80 text-white border border-white/20">
                      <Maximize2 className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                  </div>

                  {/* Bottom Bar inside Overlay */}
                  <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 space-y-1">
                    <h3 className="text-base font-bold text-white font-serif-luxury">{img.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                      <MapPin className="w-3 h-3 text-[#D4AF37]" />
                      <span>{img.location}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Lightbox Modal */}
      {activeImage && selectedImageIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6"
          onClick={() => setSelectedImageIndex(null)}
        >
          {/* Close Button */}
          <button
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-[#D4AF37] transition-all z-50 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation Controls */}
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-[#D4AF37] transition-all z-50 cursor-pointer hidden sm:block"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-[#D4AF37] transition-all z-50 cursor-pointer hidden sm:block"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Lightbox Content Container */}
          <div
            className="relative max-w-5xl w-full max-h-[90vh] bg-[#161C28] rounded-2xl border border-white/15 overflow-hidden flex flex-col md:flex-row shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Box */}
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[300px] md:min-h-[500px]">
              <SafeImage
                src={activeImage.url}
                alt={activeImage.title}
                className="max-h-[70vh] md:max-h-[85vh] w-auto object-contain"
              />
            </div>

            {/* Sidebar Details */}
            <div className="w-full md:w-80 p-6 bg-[#161C28] border-t md:border-t-0 md:border-l border-white/10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="px-2.5 py-1 rounded-md bg-[#0B0F17] text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider border border-white/10 inline-block">
                  {activeImage.category.toUpperCase()}
                </span>

                <h3 className="text-2xl font-bold font-serif-luxury text-white">
                  {activeImage.title}
                </h3>

                <div className="space-y-2 text-xs text-gray-300">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#D4AF37]" />
                    <span>{activeImage.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#D4AF37]" />
                    <span>{activeImage.camera} — {activeImage.lens}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <button
                  onClick={(e) => handleDownload(e, activeImage.title)}
                  className="w-full py-3 px-4 rounded-xl gold-gradient-bg text-black font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#D4AF37]/20"
                >
                  <Download className="w-4 h-4 text-black" />
                  <span>Descargar Muestra HD</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
