import React, { useEffect, useRef, useState } from 'react';

interface SignaturePadProps {
  onChange: (dataUrl: string) => void;
  label?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onChange, label = 'Firma dentro del recuadro' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const previous = hasInk ? canvas.toDataURL('image/png') : '';
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#111827';
      if (previous) {
        const image = new Image();
        image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);
        image.src = previous;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [hasInk]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const ctx = event.currentTarget.getContext('2d');
    const next = point(event);
    ctx?.beginPath();
    ctx?.moveTo(next.x, next.y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = event.currentTarget.getContext('2d');
    const next = point(event);
    ctx?.lineTo(next.x, next.y);
    ctx?.stroke();
    setHasInk(true);
  };

  const finish = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    event.currentTarget.getContext('2d')?.closePath();
    if (hasInk || event.type === 'pointerup') {
      setHasInk(true);
      onChange(event.currentTarget.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-gray-400">{label}</span>
        <button type="button" onClick={clear} className="text-xs text-[#D4AF37] underline underline-offset-4">Limpiar</button>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-gray-300 bg-white shadow-inner"
        aria-label={label}
      />
    </div>
  );
};
