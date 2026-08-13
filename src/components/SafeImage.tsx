import React, { useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { getDirectGoogleDriveUrl, extractDriveFolderId } from '../utils/googleDrive';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export const SafeImage: React.FC<SafeImageProps> = ({ src, alt, className = '', onClick }) => {
  const [hasError, setHasError] = useState(false);
  const [attemptedFallback, setAttemptedFallback] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>(() => getDirectGoogleDriveUrl(src));

  const handleError = () => {
    const fileId = extractDriveFileId(src);
    if (fileId && !attemptedFallback) {
      setAttemptedFallback(true);
      // Try alternate Google Drive export URL format
      setCurrentSrc(`https://drive.google.com/uc?export=view&id=${fileId}`);
    } else {
      setHasError(true);
    }
  };

  const fileId = extractDriveFileId(src);

  if (hasError) {
    return (
      <div
        onClick={onClick}
        className={`bg-[#0B0F17] border border-amber-500/30 rounded-2xl p-4 text-center flex flex-col items-center justify-center space-y-2 text-xs text-amber-300 min-h-[160px] w-full ${className}`}
      >
        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-5 h-5 animate-pulse" />
        </div>
        <span className="font-bold text-amber-200">Error al Cargar Imagen</span>
        <p className="text-[10px] text-gray-400 max-w-[200px] leading-relaxed">
          Google Drive bloqueó la vista previa o la imagen aún se está procesando.
        </p>
        {fileId && (
          <a
            href={`https://drive.google.com/file/d/${fileId}/view`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] text-[#D4AF37] hover:underline font-mono mt-1 bg-[#D4AF37]/10 px-2.5 py-1 rounded-md border border-[#D4AF37]/30"
          >
            <span>Ver en Google Drive</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={handleError}
      onClick={onClick}
      className={className}
      loading="lazy"
    />
  );
};
