import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { extractGoogleDriveFileId, getGoogleDriveImageCandidates } from '../utils/googleDrive';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  preventDownload?: boolean;
}

export function extractDriveFileId(url: string): string | null {
  return extractGoogleDriveFileId(url) || null;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  onClick,
  preventDownload = false,
}) => {
  const candidates = useMemo(() => getGoogleDriveImageCandidates(src), [src]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((current) => current + 1);
      return;
    }
    setHasError(true);
  };

  const fileId = extractDriveFileId(src);
  const currentSrc = candidates[candidateIndex] || src;

  if (hasError) {
    return (
      <div
        onClick={onClick}
        onContextMenu={preventDownload ? (event) => event.preventDefault() : undefined}
        className={`bg-[#0B0F17] border border-amber-500/30 rounded-2xl p-4 text-center flex flex-col items-center justify-center space-y-2 text-xs text-amber-300 min-h-[160px] w-full ${className}`}
      >
        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <span className="font-bold text-amber-200">Imagen no disponible</span>
        <p className="text-[10px] text-gray-400 max-w-[240px] leading-relaxed">
          Google Drive devolvió el archivo, pero no permitió mostrar una vista previa pública.
        </p>
        {!preventDownload && fileId && (
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
      onContextMenu={preventDownload ? (event) => event.preventDefault() : undefined}
      onDragStart={preventDownload ? (event) => event.preventDefault() : undefined}
      draggable={preventDownload ? false : undefined}
      className={`${preventDownload ? 'select-none' : ''} ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={preventDownload ? ({ WebkitUserDrag: 'none', userSelect: 'none' } as React.CSSProperties) : undefined}
    />
  );
};
