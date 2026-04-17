import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageLightboxProps {
  images: { src: string; alt: string }[];
  currentIndex: number;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}

export default function ImageLightbox({ images, currentIndex, onClose, onChangeIndex }: ImageLightboxProps) {
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && hasPrev) onChangeIndex(currentIndex - 1);
    if (e.key === 'ArrowRight' && hasNext) onChangeIndex(currentIndex + 1);
  }, [onClose, onChangeIndex, currentIndex, hasPrev, hasNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Close button */}
      <button className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition">
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <span className="absolute top-4 left-4 z-10 text-sm text-white/70">
          {currentIndex + 1} / {images.length}
        </span>
      )}

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onChangeIndex(currentIndex - 1); }}
          className="absolute left-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <img
        src={images[currentIndex].src}
        alt={images[currentIndex].alt}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
      />

      {/* Next */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onChangeIndex(currentIndex + 1); }}
          className="absolute right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
