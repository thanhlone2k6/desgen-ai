
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UploadedImage } from '../types';
import { CROP_RATIOS } from '../constants';

interface ImageCropperModalProps {
  image: UploadedImage | null;
  aspectRatio: number; // Passed from parent (e.g. 16/9 or 0 for free)
  onConfirm: (croppedImage: UploadedImage, maskImage?: UploadedImage) => void;
  onCancel: () => void;
  isOutpaintMode?: boolean; // NEW: Enable Outpaint logic
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ image, aspectRatio: initialRatio, onConfirm, onCancel, isOutpaintMode = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Crop Logic State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [selectedRatio, setSelectedRatio] = useState<number>(initialRatio);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    if (image) {
      const img = new Image();
      img.src = `data:${image.mimeType};base64,${image.base64}`;
      img.onload = () => {
        setImgElement(img);
        if (initialRatio === 0) {
          setSelectedRatio(0);
        } else {
          setSelectedRatio(initialRatio);
        }
        setRotation(0);
        setPosition({ x: 0, y: 0 });
        // For Outpaint, start with image fitting inside (zoom out)
        // For Crop, start with image filling (zoom in)
        setScale(isOutpaintMode ? 0.8 : 1);
      };
    }
  }, [image, initialRatio, isOutpaintMode]);

  // Rotate handler
  const rotateLeft = () => setRotation(r => (r - 90 + 360) % 360);
  const rotateRight = () => setRotation(r => (r + 90) % 360);

  // Helper: Get visual constraints based on canvas size, ratio, and image rotation
  const getConstraints = useCallback(() => {
    if (!canvasRef.current || !imgElement) return null;
    const cw = canvasRef.current.width;
    const ch = canvasRef.current.height;

    const padding = 20; // Reduce padding for mobile
    const availW = cw - padding * 2;
    const availH = ch - padding * 2;

    const isRotated = rotation % 180 !== 0;
    const imgAspect = isRotated ? imgElement.height / imgElement.width : imgElement.width / imgElement.height;

    const effectiveRatio = selectedRatio === 0 ? imgAspect : selectedRatio;

    let boxW, boxH;
    if (effectiveRatio > availW / availH) {
      boxW = availW;
      boxH = boxW / effectiveRatio;
    } else {
      boxH = availH;
      boxW = boxH * effectiveRatio;
    }

    const imgW = isRotated ? imgElement.height : imgElement.width;
    const imgH = isRotated ? imgElement.width : imgElement.height;

    const minScaleX = boxW / imgW;
    const minScaleY = boxH / imgH;

    // In Outpaint mode, we allow scaling down to 0.2x (very small image in big canvas)
    // In Crop mode, we limit to minScale (image must fill box)
    const minScale = isOutpaintMode ? Math.min(minScaleX, minScaleY) * 0.2 : Math.max(minScaleX, minScaleY);

    return {
      cw, ch, boxW, boxH, boxX: (cw - boxW) / 2, boxY: (ch - boxH) / 2,
      imgW, imgH, minScale,
      fitScale: Math.min(minScaleX, minScaleY) // Scale where image fits perfectly inside
    };
  }, [imgElement, selectedRatio, rotation, isOutpaintMode]);

  useEffect(() => {
    const c = getConstraints();
    if (c) {
      // If Outpaint, default to "Fit" (image fully visible inside box)
      // If Crop, default to "Fill" (image covers box)
      setScale(prev => isOutpaintMode ? c.fitScale * 0.8 : Math.max(prev, c.minScale));
    }
  }, [getConstraints, isOutpaintMode]);

  useEffect(() => {
    const c = getConstraints();
    if (c) {
      setScale(isOutpaintMode ? c.fitScale * 0.8 : c.minScale);
      setPosition({ x: 0, y: 0 });
    }
  }, [selectedRatio, rotation, isOutpaintMode]);

  // Draw loop
  useEffect(() => {
    const constraints = getConstraints();
    if (!canvasRef.current || !imgElement || !constraints) return;

    const { cw, ch, boxW, boxH, boxX, boxY, minScale } = constraints;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, cw, ch);

    // --- DRAW IMAGE ---
    ctx.save();

    ctx.beginPath();
    ctx.rect(boxX, boxY, boxW, boxH);
    ctx.clip();

    // Fill background of the crop box (visible in Outpaint mode)
    ctx.fillStyle = '#1e293b'; // Slate-800
    ctx.fillRect(boxX, boxY, boxW, boxH);

    const activeScale = Math.max(scale, minScale);

    const isRotated = rotation % 180 !== 0;
    const renderW = (isRotated ? imgElement.height : imgElement.width) * activeScale;
    const renderH = (isRotated ? imgElement.width : imgElement.height) * activeScale;

    // In Outpaint, we don't clamp as strictly, allowing image to move freely inside
    // In Crop, we clamp so image always covers box
    let clampedX = position.x;
    let clampedY = position.y;

    if (!isOutpaintMode) {
      const maxDX = Math.max(0, (renderW - boxW) / 2);
      const maxDY = Math.max(0, (renderH - boxH) / 2);
      clampedX = Math.max(-maxDX, Math.min(maxDX, position.x));
      clampedY = Math.max(-maxDY, Math.min(maxDY, position.y));
    }

    const cx = boxX + boxW / 2 + clampedX;
    const cy = boxY + boxH / 2 + clampedY;

    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(activeScale, activeScale);

    ctx.drawImage(imgElement, -imgElement.width / 2, -imgElement.height / 2);

    ctx.restore();

    // --- OVERLAY ---
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, cw, boxY); // Top
    ctx.fillRect(0, boxY + boxH, cw, ch - (boxY + boxH)); // Bottom
    ctx.fillRect(0, boxY, boxX, boxH); // Left
    ctx.fillRect(boxX + boxW, boxY, cw - (boxX + boxW), boxH); // Right

    // --- BORDER & GRID ---
    ctx.strokeStyle = isOutpaintMode ? '#3b82f6' : 'white'; // Blue for Outpaint
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    if (!isOutpaintMode) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(boxX + boxW / 3, boxY);
      ctx.lineTo(boxX + boxW / 3, boxY + boxH);
      ctx.moveTo(boxX + 2 * boxW / 3, boxY);
      ctx.lineTo(boxX + 2 * boxW / 3, boxY + boxH);
      ctx.moveTo(boxX, boxY + boxH / 3);
      ctx.lineTo(boxX + boxW, boxY + boxH / 3);
      ctx.moveTo(boxX, boxY + 2 * boxH / 3);
      ctx.lineTo(boxX + boxW, boxY + 2 * boxH / 3);
      ctx.stroke();
    } else {
      // Outpaint: Show text "Canvas Area"
      ctx.fillStyle = '#3b82f6';
      ctx.font = '12px sans-serif';
      ctx.fillText("Canvas Area (Vùng mở rộng)", boxX + 5, boxY - 8);
    }

  }, [imgElement, scale, position, rotation, getConstraints, isOutpaintMode]);

  // Input Handlers
  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (isDragging) {
      const constraints = getConstraints();
      if (!constraints) return;

      const { minScale, boxW, boxH, imgW, imgH } = constraints;
      const activeScale = Math.max(scale, minScale);

      const rawX = clientX - dragStart.x;
      const rawY = clientY - dragStart.y;

      // In Outpaint, free movement
      if (isOutpaintMode) {
        setPosition({ x: rawX, y: rawY });
      } else {
        // Crop: Clamp
        const renderW = imgW * activeScale;
        const renderH = imgH * activeScale;
        const maxDX = Math.max(0, (renderW - boxW) / 2);
        const maxDY = Math.max(0, (renderH - boxH) / 2);

        const clampedX = Math.max(-maxDX, Math.min(maxDX, rawX));
        const clampedY = Math.max(-maxDY, Math.min(maxDY, rawY));
        setPosition({ x: clampedX, y: clampedY });
      }
    }
  };

  const handleEnd = () => setIsDragging(false);

  // Mouse
  const handleMouseDown = (e: React.MouseEvent) => handleStart(e.clientX, e.clientY);
  const handleMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  const handleMouseUp = () => handleEnd();

  // Touch
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const handleTouchEnd = () => handleEnd();

  const handleWheel = (e: React.WheelEvent) => {
    const constraints = getConstraints();
    if (!constraints) return;

    const delta = -e.deltaY * 0.001;
    // In Outpaint, allow zooming out more
    const minS = isOutpaintMode ? constraints.minScale : constraints.minScale;
    const newScale = Math.max(minS, Math.min(10, scale + delta));
    setScale(newScale);
  };

  const handleSave = () => {
    if (!imgElement || !image) return;
    const constraints = getConstraints();
    if (!constraints) return;

    const { minScale, boxW, boxH, imgW, imgH } = constraints;

    const targetWidth = 1500;
    const effectiveRatio = boxW / boxH;
    const targetHeight = targetWidth / effectiveRatio;

    // 1. Generate Image Canvas (Black background for outpaint area? No, usually content)
    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetWidth;
    outCanvas.height = targetHeight;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    // Fill background
    // For Outpaint, we want empty area to be transparent or specific color?
    // Gemini usually expects the image to be placed on the canvas.
    ctx.fillStyle = 'black'; // Default background
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const outputRatio = targetWidth / boxW;
    const activeScale = Math.max(scale, minScale);
    const finalRenderScale = activeScale * outputRatio;

    const renderW = imgW * activeScale;
    const renderH = imgH * activeScale;

    // Clamp logic for final render
    let clampedX = position.x;
    let clampedY = position.y;
    if (!isOutpaintMode) {
      const maxDX = Math.max(0, (renderW - boxW) / 2);
      const maxDY = Math.max(0, (renderH - boxH) / 2);
      clampedX = Math.max(-maxDX, Math.min(maxDX, position.x));
      clampedY = Math.max(-maxDY, Math.min(maxDY, position.y));
    }

    const cx = targetWidth / 2 + clampedX * outputRatio;
    const cy = targetHeight / 2 + clampedY * outputRatio;

    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(finalRenderScale, finalRenderScale);
    ctx.drawImage(imgElement, -imgElement.width / 2, -imgElement.height / 2);

    const base64 = outCanvas.toDataURL('image/png').split(',')[1]; // Use PNG for transparency support if needed

    // 2. Generate Mask (If Outpaint)
    let maskBase64 = undefined;
    if (isOutpaintMode) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = targetWidth;
      maskCanvas.height = targetHeight;
      const mCtx = maskCanvas.getContext('2d');
      if (mCtx) {
        // White = Edit (Empty Space), Black = Keep (Original Image)
        mCtx.fillStyle = 'white';
        mCtx.fillRect(0, 0, targetWidth, targetHeight);

        mCtx.translate(cx, cy);
        mCtx.rotate((rotation * Math.PI) / 180);
        mCtx.scale(finalRenderScale, finalRenderScale);

        // Draw Black rectangle where image is
        mCtx.fillStyle = 'black';
        mCtx.fillRect(-imgElement.width / 2, -imgElement.height / 2, imgElement.width, imgElement.height);

        maskBase64 = maskCanvas.toDataURL('image/png').split(',')[1];
      }
    }

    onConfirm(
      {
        ...image,
        base64: base64,
        mimeType: 'image/png'
      },
      maskBase64 ? {
        id: 'mask-' + Date.now(),
        base64: maskBase64,
        mimeType: 'image/png'
      } : undefined
    );
  };

  if (!image) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-6">
      <div className="flex flex-col gap-0 rounded-2xl bg-slate-900 shadow-2xl w-full h-full sm:max-w-[95vw] sm:max-h-[92vh] border border-slate-700 overflow-hidden">

        {/* HEADER */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-700 bg-slate-800 z-10 shrink-0">
          <h3 className="font-bold text-base sm:text-lg text-white">
            {isOutpaintMode ? 'Mở rộng ảnh (Outpaint)' : 'Cắt ảnh'}
          </h3>
          <div className="flex gap-2 items-center">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold">Tỉ lệ:</span>
              <select
                value={selectedRatio}
                onChange={(e) => setSelectedRatio(parseFloat(e.target.value))}
                className="bg-slate-700 text-white text-xs py-2 px-3 rounded-lg border border-slate-600 focus:ring-2 focus:ring-brand-500 outline-none hover:bg-slate-600 transition"
              >
                {CROP_RATIOS.map(r => (
                  <option key={r.label} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <button onClick={onCancel} className="h-8 w-8 rounded-full bg-slate-700 text-gray-300 hover:bg-red-500 hover:text-white flex items-center justify-center transition">✕</button>
          </div>
        </div>

        {/* CANVAS AREA */}
        <div className="relative flex-1 bg-black overflow-hidden cursor-move touch-none flex items-center justify-center select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <canvas
            ref={canvasRef}
            width={1600}
            height={1000}
            className="w-full h-full object-contain pointer-events-none"
          />

          {isOutpaintMode && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none backdrop-blur">
              Kéo để di chuyển ảnh • Dùng thanh Zoom bên dưới để thu phóng
            </div>
          )}
        </div>

        {/* FOOTER CONTROLS */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex flex-col gap-4 z-10 shrink-0">

          {/* Zoom Slider */}
          <div className="flex items-center gap-3 px-1">
            <button 
              onClick={() => {
                const constraints = getConstraints();
                if (constraints) {
                  const minS = isOutpaintMode ? constraints.minScale : constraints.minScale;
                  setScale(Math.max(minS, scale - 0.1));
                }
              }}
              className="p-2 rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600 hover:text-white transition border border-slate-600"
              title="Thu nhỏ"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            
            <div className="flex-1 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
              </svg>
              <input
                type="range"
                min={(() => {
                  const c = getConstraints();
                  return c ? (isOutpaintMode ? c.minScale : c.minScale) : 0.1;
                })()}
                max="3"
                step="0.01"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500 
                  [&::-webkit-slider-thumb]:appearance-none 
                  [&::-webkit-slider-thumb]:w-5 
                  [&::-webkit-slider-thumb]:h-5 
                  [&::-webkit-slider-thumb]:rounded-full 
                  [&::-webkit-slider-thumb]:bg-brand-500 
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:shadow-brand-500/30
                  [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-white
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:transition-transform
                  [&::-webkit-slider-thumb]:hover:scale-110
                  [&::-moz-range-thumb]:w-5
                  [&::-moz-range-thumb]:h-5
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-brand-500
                  [&::-moz-range-thumb]:border-2
                  [&::-moz-range-thumb]:border-white
                  [&::-moz-range-thumb]:cursor-pointer"
              />
              <span className="text-xs font-mono text-brand-400 min-w-[45px] text-right">
                {Math.round(scale * 100)}%
              </span>
            </div>
            
            <button 
              onClick={() => setScale(Math.min(3, scale + 0.1))}
              className="p-2 rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600 hover:text-white transition border border-slate-600"
              title="Phóng to"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button onClick={rotateLeft} className="p-2.5 rounded-xl bg-slate-700 text-gray-300 hover:bg-slate-600 hover:text-white transition shadow-sm border border-slate-600" title="Xoay trái">
                ↺
              </button>
              <button onClick={rotateRight} className="p-2.5 rounded-xl bg-slate-700 text-gray-300 hover:bg-slate-600 hover:text-white transition shadow-sm border border-slate-600" title="Xoay phải">
                ↻
              </button>
              
              {/* Fit/Fill buttons */}
              {isOutpaintMode && (
                <button 
                  onClick={() => {
                    const c = getConstraints();
                    if (c) {
                      setScale(c.fitScale);
                      setPosition({ x: 0, y: 0 });
                    }
                  }}
                  className="px-3 py-2.5 rounded-xl bg-slate-700 text-gray-300 hover:bg-brand-600 hover:text-white transition shadow-sm border border-slate-600 text-xs font-medium"
                  title="Fit ảnh vừa khung"
                >
                  Fit
                </button>
              )}
            </div>

            {/* Mobile Ratio Select */}
            <div className="sm:hidden flex-1 max-w-[150px]">
              <select
                value={selectedRatio}
                onChange={(e) => setSelectedRatio(parseFloat(e.target.value))}
                className="w-full bg-slate-700 text-white text-sm py-2.5 px-3 rounded-xl border border-slate-600"
              >
                {CROP_RATIOS.map(r => (
                  <option key={r.label} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-6 py-3 rounded-xl bg-slate-700 text-gray-300 font-semibold hover:bg-slate-600 transition border border-slate-600 text-sm">
              Hủy
            </button>
            <button onClick={handleSave} className="flex-1 px-8 py-3 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-500 shadow-lg shadow-brand-600/20 transition active:scale-95 text-sm">
              {isOutpaintMode ? 'Tạo Canvas & Mask' : 'Cắt ảnh'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
