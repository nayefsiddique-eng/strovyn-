'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Camera,
  Upload,
  Paintbrush,
  Eraser,
  Wand2,
  Undo2,
  Redo2,
  RotateCcw,
  Trash2,
  Download,
  Eye,
  MessageCircle,
  FileText,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';
import {
  DecodedRoomImage,
  decodeImageSource,
  floodFillMask,
  paintBrushStroke,
  renderTintedComposite,
  validateRoomImageFile,
} from '@/lib/visualiser/imageProcessing';
import {
  ILLUSTRATIVE_PALETTE,
  PALETTE_FAMILIES,
  PAINT_FINISHES,
  type IllustrativePaletteSwatch,
  type PaletteFamily,
  type PaintFinishSpec,
} from './palette';

type ToolMode = 'smart-fill' | 'brush' | 'eraser';

const SAMPLE_IMAGE_URL = '/images/projects/adelaide-luxury-residence/living-dining-2.jpg';
const MAX_HISTORY = 12;

export const WallColourVisualiser: React.FC = () => {
  const searchParams = useSearchParams();
  const requestedFinish = searchParams.get('finish')?.trim().toLowerCase();
  const initialSwatch =
    (requestedFinish
      ? ILLUSTRATIVE_PALETTE.find((s) => s.name.toLowerCase() === requestedFinish)
      : undefined) || ILLUSTRATIVE_PALETTE[4];

  const [selectedSwatch, setSelectedSwatch] = useState<IllustrativePaletteSwatch>(initialSwatch);
  const [selectedFinish, setSelectedFinish] = useState<PaintFinishSpec>(PAINT_FINISHES[1]);
  const [activeFamily, setActiveFamily] = useState<'All' | PaletteFamily>('All');
  const [colourSearch, setColourSearch] = useState<string>('');
  const [recentSwatches, setRecentSwatches] = useState<IllustrativePaletteSwatch[]>([initialSwatch]);
  const [activeTool, setActiveTool] = useState<ToolMode>('smart-fill');
  const [brushRadius, setBrushRadius] = useState<number>(22);
  const [fillTolerance, setFillTolerance] = useState<number>(26);
  const [compareSplit, setCompareSplit] = useState<number>(50);
  const [holdingOriginal, setHoldingOriginal] = useState<boolean>(false);

  const [hasCustomPhoto, setHasCustomPhoto] = useState<boolean>(false);
  const [hasMaskEdits, setHasMaskEdits] = useState<boolean>(false);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dimensions, setDimensions] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Undo / Redo state flags for button disabled states
  const [historyMeta, setHistoryMeta] = useState<{ index: number; total: number }>({
    index: 0,
    total: 1,
  });

  // Unfinished session discard confirmation
  const [pendingAction, setPendingAction] = useState<
    | { type: 'upload'; file: File }
    | { type: 'reset-sample' }
    | null
  >(null);

  // Refs for mutable pixel buffers (avoids React state overhead on every stroke)
  const roomRef = useRef<DecodedRoomImage | null>(null);
  const maskRef = useRef<Uint8Array | null>(null);
  const historyRef = useRef<Uint8Array[]>([]);
  const historyIndexRef = useRef<number>(0);

  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tintedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tintedPixelsRef = useRef<Uint8ClampedArray | null>(null);

  const isDrawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Warn before closing tab if user has custom photo + unsaved edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasCustomPhoto && hasMaskEdits) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasCustomPhoto, hasMaskEdits]);

  const checkMaskHasEdits = (mask: Uint8Array): boolean => {
    for (let i = 0; i < mask.length; i += 16) {
      if (mask[i] > 0) return true;
    }
    return false;
  };

  const redrawCanvases = useCallback(
    (swatchHex: string, specBoost = 0) => {
      const room = roomRef.current;
      const mask = maskRef.current;
      const origCanvas = originalCanvasRef.current;
      const tintCanvas = tintedCanvasRef.current;
      if (!room || !mask || !origCanvas || !tintCanvas) return;

      const { width, height, originalPixels } = room;

      if (origCanvas.width !== width || origCanvas.height !== height) {
        origCanvas.width = width;
        origCanvas.height = height;
        const oCtx = origCanvas.getContext('2d');
        if (oCtx) {
          oCtx.putImageData(new ImageData(new Uint8ClampedArray(originalPixels), width, height), 0, 0);
        }
      }

      if (tintCanvas.width !== width || tintCanvas.height !== height) {
        tintCanvas.width = width;
        tintCanvas.height = height;
      }

      if (!tintedPixelsRef.current || tintedPixelsRef.current.length !== originalPixels.length) {
        tintedPixelsRef.current = new Uint8ClampedArray(originalPixels.length);
      }

      renderTintedComposite(
        originalPixels,
        mask,
        width,
        height,
        swatchHex,
        tintedPixelsRef.current,
        specBoost
      );

      const tCtx = tintCanvas.getContext('2d');
      if (tCtx) {
        tCtx.putImageData(new ImageData(new Uint8ClampedArray(tintedPixelsRef.current), width, height), 0, 0);
      }
    },
    []
  );

  const selectSwatch = useCallback((swatch: IllustrativePaletteSwatch) => {
    setSelectedSwatch(swatch);
    setRecentSwatches((prev) => [
      swatch,
      ...prev.filter((s) => s.id !== swatch.id),
    ].slice(0, 6));
  }, []);

  const pushHistorySnapshot = useCallback((mask: Uint8Array) => {
    const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);
    truncated.push(new Uint8Array(mask));
    if (truncated.length > MAX_HISTORY) {
      truncated.shift();
    }
    historyRef.current = truncated;
    historyIndexRef.current = truncated.length - 1;
    setHistoryMeta({ index: historyIndexRef.current, total: truncated.length });
    setHasMaskEdits(checkMaskHasEdits(mask));
  }, []);

  const loadRoomSource = useCallback(
    async (source: File | string, isCustom: boolean) => {
      setIsLoadingImage(true);
      setErrorMsg('');
      try {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const maxEdge = isMobile ? 1200 : 1600;
        const decoded = await decodeImageSource(source, maxEdge);

        const blankMask = new Uint8Array(decoded.width * decoded.height);

        // Pre-seed a clean initial wall tap on the default sample so visitors immediately see the effect
        if (!isCustom) {
          floodFillMask(
            decoded.originalPixels,
            decoded.sobelEdges,
            blankMask,
            decoded.width,
            decoded.height,
            Math.round(decoded.width * 0.22),
            Math.round(decoded.height * 0.26),
            24
          );
        }

        roomRef.current = decoded;
        maskRef.current = blankMask;
        historyRef.current = [new Uint8Array(blankMask)];
        historyIndexRef.current = 0;

        setDimensions({ w: decoded.width, h: decoded.height });
        setHasCustomPhoto(isCustom);
        setHasMaskEdits(isCustom ? false : checkMaskHasEdits(blankMask));
        setHistoryMeta({ index: 0, total: 1 });

        // Force original canvas redraw on next frame
        if (originalCanvasRef.current) {
          originalCanvasRef.current.width = 0;
        }
        redrawCanvases(selectedSwatch.hex, selectedFinish.specBoost);
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to decode this photograph. Please try a JPEG, PNG, or WebP image.'
        );
      } finally {
        setIsLoadingImage(false);
      }
    },
    [redrawCanvases, selectedFinish.specBoost, selectedSwatch.hex]
  );

  // Initial mount: load sample room
  useEffect(() => {
    loadRoomSource(SAMPLE_IMAGE_URL, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render tinted layer whenever selected swatch or finish changes
  useEffect(() => {
    if (roomRef.current && maskRef.current) {
      redrawCanvases(selectedSwatch.hex, selectedFinish.specBoost);
    }
  }, [selectedSwatch, selectedFinish, redrawCanvases]);

  const handleFileChosen = (file: File | undefined) => {
    if (!file) return;
    const check = validateRoomImageFile(file);
    if (!check.valid) {
      setErrorMsg(check.error || 'Invalid image file.');
      return;
    }

    if (hasCustomPhoto && hasMaskEdits) {
      setPendingAction({ type: 'upload', file });
      return;
    }
    loadRoomSource(file, true);
  };

  const handleResetToSample = () => {
    if (hasCustomPhoto && hasMaskEdits) {
      setPendingAction({ type: 'reset-sample' });
      return;
    }
    loadRoomSource(SAMPLE_IMAGE_URL, false);
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action.type === 'upload') {
      loadRoomSource(action.file, true);
    } else if (action.type === 'reset-sample') {
      loadRoomSource(SAMPLE_IMAGE_URL, false);
    }
  };

  const handleClearSelection = () => {
    const room = roomRef.current;
    if (!room) return;
    const empty = new Uint8Array(room.width * room.height);
    maskRef.current = empty;
    pushHistorySnapshot(empty);
      redrawCanvases(selectedSwatch.hex, selectedFinish.specBoost);
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snapshot = new Uint8Array(historyRef.current[historyIndexRef.current]);
    maskRef.current = snapshot;
    setHistoryMeta({ index: historyIndexRef.current, total: historyRef.current.length });
    setHasMaskEdits(checkMaskHasEdits(snapshot));
    redrawCanvases(selectedSwatch.hex, selectedFinish.specBoost);
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = new Uint8Array(historyRef.current[historyIndexRef.current]);
    maskRef.current = snapshot;
    setHistoryMeta({ index: historyIndexRef.current, total: historyRef.current.length });
    setHasMaskEdits(checkMaskHasEdits(snapshot));
    redrawCanvases(selectedSwatch.hex, selectedFinish.specBoost);
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = tintedCanvasRef.current;
    const room = roomRef.current;
    if (!canvas || !room) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * room.width;
    const y = ((e.clientY - rect.top) / rect.height) * room.height;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isLoadingImage || holdingOriginal) return;
    const room = roomRef.current;
    const mask = maskRef.current;
    const coords = getCanvasCoords(e);
    if (!room || !mask || !coords) return;

    if (activeTool === 'smart-fill') {
      const changed = floodFillMask(
        room.originalPixels,
        room.sobelEdges,
        mask,
        room.width,
        room.height,
        coords.x,
        coords.y,
        fillTolerance
      );
      if (changed) {
        pushHistorySnapshot(mask);
        redrawCanvases(selectedSwatch.hex, selectedFinish.specBoost);
      }
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = coords;

    const val: 0 | 255 = activeTool === 'brush' ? 255 : 0;
    paintBrushStroke(
      mask,
      room.width,
      room.height,
      coords.x,
      coords.y,
      coords.x,
      coords.y,
      brushRadius,
      val
    );
    redrawCanvases(selectedSwatch.hex, selectedFinish.specBoost);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activeTool === 'smart-fill') return;
    const room = roomRef.current;
    const mask = maskRef.current;
    const coords = getCanvasCoords(e);
    const prev = lastPointRef.current;
    if (!room || !mask || !coords || !prev) return;

    const val: 0 | 255 = activeTool === 'brush' ? 255 : 0;
    paintBrushStroke(
      mask,
      room.width,
      room.height,
      prev.x,
      prev.y,
      coords.x,
      coords.y,
      brushRadius,
      val
    );
    lastPointRef.current = coords;
    redrawCanvases(selectedSwatch.hex, selectedFinish.specBoost);
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    if (maskRef.current) {
      pushHistorySnapshot(maskRef.current);
    }
  };

  const handleDownloadPreview = () => {
    const canvas = tintedCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strovyn-preview-${selectedSwatch.id}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  const whatsappText = encodeURIComponent(
    `Hello Strovyn Painting Co. I previewed "${selectedSwatch.name}" (${selectedSwatch.hex}, Illustrative Palette) in the Wall Colour Visualiser and would like to discuss my Adelaide project.`
  );
  const whatsappUrl = `${WHATSAPP_DETAILS.chatUrl}?text=${whatsappText}`;
  const quoteHref = `/contact?finish=${encodeURIComponent(selectedSwatch.name)}&hex=${encodeURIComponent(selectedSwatch.hex)}`;

  const effectiveSplit = holdingOriginal ? 100 : compareSplit;

  return (
    <section
      aria-label="Strovyn Wall Colour Visualiser"
      className="py-16 md:py-24 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto"
    >
      {/* Header & Privacy Assurance */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-warm-grey/40 dark:border-white/15 pb-6 mb-8 gap-6">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-bronze dark:text-[#C9B28F] font-semibold block mb-2">
            [ 02 / INTERACTIVE WALL COLOUR VISUALISER ]
          </span>
          <h1 className="type-page-title text-3xl sm:text-4xl lg:text-5xl text-charcoal dark:text-white">
            Preview Finishes On Your Own Walls
          </h1>
          <p className="font-sans text-sm sm:text-base text-charcoal/80 dark:text-[#F4F1EA]/80 max-w-2xl mt-3 leading-relaxed">
            Upload a room photograph or capture one directly from your mobile camera. Tap any wall to select it, refine edges with the brush or eraser, and compare finishes before requesting an on-site Adelaide assessment.
          </p>
        </div>

        <div className="flex items-start gap-2.5 bg-white dark:bg-[#242523] border border-warm-grey/50 dark:border-white/15 px-4 py-3 text-xs text-charcoal dark:text-[#F4F1EA] max-w-sm shrink-0">
          <ShieldCheck className="w-4 h-4 text-bronze dark:text-[#C9B28F] shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong className="font-medium">Private &amp; Local:</strong> Photos are processed entirely inside your browser and are never uploaded automatically.
          </span>
        </div>
      </div>

      {/* Unfinished Session Discard Confirmation */}
      {pendingAction && (
        <div
          role="alertdialog"
          aria-label="Discard current visualiser edits"
          className="scroll-mt-24 mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-700/40 dark:border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-charcoal dark:text-[#F4F1EA]"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-800 dark:text-amber-300 shrink-0" aria-hidden="true" />
            <span>
              You have wall selections on your current photograph. Replacing it will discard your current mask edits.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              className="px-3 py-1.5 border border-warm-grey/60 bg-white dark:bg-[#242523] text-charcoal dark:text-white font-mono uppercase tracking-wider cursor-pointer"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={confirmPendingAction}
              className="px-3 py-1.5 bg-brand-red text-white font-mono uppercase tracking-wider cursor-pointer"
            >
              Discard &amp; Continue
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-700/40 text-xs text-rose-900 dark:text-rose-200"
        >
          {errorMsg}
        </div>
      )}

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 8 Cols: Canvas Editing Workspace */}
        <div className="lg:col-span-8 space-y-4">
          {/* Top Action Toolbar: Camera / Upload / History / Reset */}
          <div className="bg-white dark:bg-[#242523] border border-warm-grey/40 dark:border-white/15 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Upload room photograph"
                onChange={(e) => {
                  handleFileChosen(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                aria-label="Take room photograph with camera"
                onChange={(e) => {
                  handleFileChosen(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-charcoal dark:bg-[#F4F1EA] text-white dark:text-charcoal hover:bg-black dark:hover:bg-white text-xs font-mono uppercase tracking-wider cursor-pointer transition-colors"
              >
                <Upload size={14} aria-hidden="true" />
                <span>Upload Photo</span>
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-ivory dark:bg-[#1A1B19] text-charcoal dark:text-[#F4F1EA] border border-warm-grey/60 dark:border-white/20 hover:border-bronze text-xs font-mono uppercase tracking-wider cursor-pointer transition-colors"
              >
                <Camera size={14} aria-hidden="true" />
                <span>Use Camera</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyMeta.index <= 0}
                aria-label="Undo last selection"
                className="p-2 border border-warm-grey/40 dark:border-white/15 text-charcoal dark:text-[#F4F1EA] disabled:opacity-35 hover:border-bronze cursor-pointer disabled:cursor-not-allowed"
              >
                <Undo2 size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyMeta.index >= historyMeta.total - 1}
                aria-label="Redo selection"
                className="p-2 border border-warm-grey/40 dark:border-white/15 text-charcoal dark:text-[#F4F1EA] disabled:opacity-35 hover:border-bronze cursor-pointer disabled:cursor-not-allowed"
              >
                <Redo2 size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                disabled={!hasMaskEdits}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 border border-warm-grey/40 dark:border-white/15 text-charcoal dark:text-[#F4F1EA] disabled:opacity-35 hover:border-bronze text-[11px] font-mono uppercase cursor-pointer disabled:cursor-not-allowed"
              >
                <Trash2 size={13} aria-hidden="true" />
                <span>Clear</span>
              </button>
              {hasCustomPhoto && (
                <button
                  type="button"
                  onClick={handleResetToSample}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 border border-warm-grey/40 dark:border-white/15 text-charcoal dark:text-[#F4F1EA] hover:border-bronze text-[11px] font-mono uppercase cursor-pointer"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  <span>Sample</span>
                </button>
              )}
            </div>
          </div>

          {/* Selection Tools Bar */}
          <div className="bg-ivory-light dark:bg-[#1E1F1D] border border-warm-grey/40 dark:border-white/15 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Wall selection tool">
              {[
                { id: 'smart-fill' as ToolMode, label: 'Tap Wall (Smart Fill)', icon: Wand2 },
                { id: 'brush' as ToolMode, label: 'Brush', icon: Paintbrush },
                { id: 'eraser' as ToolMode, label: 'Eraser', icon: Eraser },
              ].map((tool) => {
                const Icon = tool.icon;
                const active = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setActiveTool(tool.id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider border transition-colors cursor-pointer ${
                      active
                        ? 'bg-bronze text-white border-bronze'
                        : 'bg-white dark:bg-[#242523] text-charcoal dark:text-[#F4F1EA] border-warm-grey/50 dark:border-white/15 hover:border-bronze'
                    }`}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTool === 'smart-fill' ? (
              <label className="flex items-center gap-3 text-xs font-mono text-charcoal dark:text-[#F4F1EA]">
                <span className="uppercase tracking-wider text-warm-grey-dark dark:text-[#B5B2AA]">
                  Sensitivity: {fillTolerance}
                </span>
                <input
                  type="range"
                  min={10}
                  max={55}
                  value={fillTolerance}
                  onChange={(e) => setFillTolerance(Number(e.target.value))}
                  className="w-28 accent-bronze cursor-pointer"
                />
              </label>
            ) : (
              <label className="flex items-center gap-3 text-xs font-mono text-charcoal dark:text-[#F4F1EA]">
                <span className="uppercase tracking-wider text-warm-grey-dark dark:text-[#B5B2AA]">
                  Size: {brushRadius}px
                </span>
                <input
                  type="range"
                  min={8}
                  max={48}
                  value={brushRadius}
                  onChange={(e) => setBrushRadius(Number(e.target.value))}
                  className="w-28 accent-bronze cursor-pointer"
                />
              </label>
            )}
          </div>

          {/* Concise Homeowner Guidance */}
          <p className="text-[11px] font-sans text-warm-grey-dark dark:text-[#B5B2AA]">
            Tip: Tap any wall to fill it. Use <strong className="font-medium text-charcoal dark:text-[#F4F1EA]">Brush</strong> or <strong className="font-medium text-charcoal dark:text-[#F4F1EA]">Eraser</strong> to refine around white trim, curtains, or furniture.
          </p>

          {/* Interactive Dual-Layer Comparison Canvas */}
          <div className="relative bg-charcoal border border-warm-grey/50 dark:border-white/15 overflow-hidden select-none">
            {isLoadingImage && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-charcoal/80 text-white font-mono text-xs uppercase tracking-widest">
                Preparing room canvas...
              </div>
            )}

            <div className="w-full bg-[#141513] flex items-center justify-center overflow-hidden">
              <div
                className="relative max-w-full overflow-hidden"
                style={{
                  aspectRatio: dimensions.w && dimensions.h ? `${dimensions.w} / ${dimensions.h}` : '16 / 10',
                  width: '100%',
                  maxHeight: '560px',
                }}
              >
                {/* Layer 1 (Full interactive surface): Tinted Wall Preview */}
                <canvas
                  ref={tintedCanvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{ touchAction: 'none' }}
                  className={`w-full h-full block ${
                    activeTool === 'smart-fill' ? 'cursor-crosshair' : 'cursor-cell'
                  }`}
                  aria-label="Interactive wall selection canvas. Tap or brush walls to apply selected paint finish."
                />

                {/* Layer 2 (Left of Split, non-interactive overlay): Original Unmodified Photograph */}
                <canvas
                  ref={originalCanvasRef}
                  className="absolute inset-0 w-full h-full block pointer-events-none"
                  style={{ clipPath: `inset(0 ${100 - effectiveSplit}% 0 0)` }}
                  aria-hidden="true"
                />

                {/* Split Line Indicator */}
                {!holdingOriginal && (
                  <div
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.7)] pointer-events-none z-10"
                    style={{ left: `${effectiveSplit}%` }}
                  >
                    <span className="absolute top-3 right-2 bg-charcoal/90 text-white font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 whitespace-nowrap">
                      Before (Original)
                    </span>
                    <span className="absolute top-3 left-2 bg-bronze/95 text-white font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 whitespace-nowrap">
                      After ({selectedSwatch.name})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Comparison Controls */}
            <div className="bg-white dark:bg-[#242523] border-t border-warm-grey/40 dark:border-white/15 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-3 flex-1 text-xs font-mono text-charcoal dark:text-[#F4F1EA]">
                <span className="uppercase tracking-wider shrink-0">Before / After</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={compareSplit}
                  onChange={(e) => setCompareSplit(Number(e.target.value))}
                  aria-label="Before and after comparison split"
                  className="w-full accent-bronze cursor-pointer"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCompareSplit(50);
                    loadRoomSource(SAMPLE_IMAGE_URL, false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-warm-grey/60 dark:border-white/20 bg-white dark:bg-[#242523] text-charcoal dark:text-[#F4F1EA] hover:border-bronze text-[11px] font-mono uppercase tracking-wider cursor-pointer"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onPointerDown={() => setHoldingOriginal(true)}
                  onPointerUp={() => setHoldingOriginal(false)}
                  onPointerLeave={() => setHoldingOriginal(false)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') setHoldingOriginal(true);
                  }}
                  onKeyUp={() => setHoldingOriginal(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-warm-grey/60 dark:border-white/20 bg-ivory dark:bg-[#1A1B19] text-charcoal dark:text-[#F4F1EA] text-[11px] font-mono uppercase tracking-wider cursor-pointer"
                >
                  <Eye size={13} aria-hidden="true" />
                  <span>Hold for Original</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPreview}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-warm-grey/60 dark:border-white/20 bg-white dark:bg-[#242523] text-charcoal dark:text-[#F4F1EA] hover:border-bronze text-[11px] font-mono uppercase tracking-wider cursor-pointer"
                >
                  <Download size={13} aria-hidden="true" />
                  <span>Save PNG</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Illustrative Palette, Specs & Enquiry Handoff */}
        <div className="lg:col-span-4 space-y-5 bg-white dark:bg-[#242523] border border-warm-grey/40 dark:border-white/15 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bronze dark:text-[#C9B28F] font-semibold block mb-1">
                ILLUSTRATIVE PALETTE ({ILLUSTRATIVE_PALETTE.length} COLOURS)
              </span>
              <h2 className="type-card-title text-2xl sm:text-3xl text-charcoal dark:text-white">
                {selectedSwatch.name}
              </h2>
              <p className="font-mono text-xs text-warm-grey-dark dark:text-[#B5B2AA] mt-1">
                {selectedSwatch.family} &middot; {selectedSwatch.hex} &middot; LRV {selectedSwatch.lrv}%
              </p>
            </div>
            <span
              className="w-10 h-10 shrink-0 border border-warm-grey/60 dark:border-white/25"
              style={{ backgroundColor: selectedSwatch.hex }}
              aria-hidden="true"
            />
          </div>

          {/* Finish Sheen Selector */}
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-warm-grey-dark dark:text-[#B5B2AA] block mb-2">
              Finish Sheen ({selectedFinish.sheenRange}):
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-1.5" role="radiogroup" aria-label="Paint finish sheen">
              {PAINT_FINISHES.map((fin) => {
                const active = fin.id === selectedFinish.id;
                return (
                  <button
                    key={fin.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelectedFinish(fin)}
                    className={`px-2 py-1.5 border text-[11px] font-mono uppercase tracking-wider cursor-pointer transition-colors ${
                      active
                        ? 'bg-charcoal dark:bg-[#F4F1EA] text-white dark:text-charcoal border-charcoal dark:border-[#F4F1EA] font-semibold'
                        : 'bg-ivory-light dark:bg-[#1A1B19] text-charcoal dark:text-[#F4F1EA] border-warm-grey/40 dark:border-white/15 hover:border-bronze'
                    }`}
                  >
                    {fin.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] font-sans text-warm-grey-dark dark:text-[#B5B2AA] mt-1.5 leading-snug">
              {selectedFinish.summary}
            </p>
          </div>

          {/* Search & Family Filter */}
          <div className="space-y-2.5 pt-2 border-t border-warm-grey/30 dark:border-white/10">
            <label htmlFor="visualiser-colour-search" className="sr-only">
              Search illustrative paint colours by name or hex
            </label>
            <input
              id="visualiser-colour-search"
              type="search"
              value={colourSearch}
              onChange={(e) => setColourSearch(e.target.value)}
              placeholder="Search 72 colours by name or HEX..."
              className="w-full bg-ivory-light dark:bg-[#1A1B19] border border-warm-grey/60 dark:border-white/20 px-3 py-2 text-xs font-sans text-charcoal dark:text-[#F4F1EA] placeholder:text-charcoal/50 dark:placeholder:text-[#A8A59E]"
            />

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Colour family filter">
              {(['All', ...PALETTE_FAMILIES] as const).map((fam) => {
                const active = activeFamily === fam;
                return (
                  <button
                    key={fam}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveFamily(fam)}
                    className={`px-2.5 py-1 border text-[10px] font-mono uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? 'bg-bronze text-white border-bronze'
                        : 'bg-ivory-light dark:bg-[#1A1B19] text-charcoal dark:text-[#F4F1EA] border-warm-grey/40 dark:border-white/15 hover:border-bronze'
                    }`}
                  >
                    {fam}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recently Selected Swatches */}
          {recentSwatches.length > 1 && (
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-warm-grey-dark dark:text-[#B5B2AA] block mb-1.5">
                Recently Previewed:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {recentSwatches.map((rs) => (
                  <button
                    key={rs.id}
                    type="button"
                    title={`${rs.name} (${rs.hex})`}
                    aria-label={`Select recent colour ${rs.name}`}
                    onClick={() => selectSwatch(rs)}
                    className={`w-6 h-6 border cursor-pointer ${
                      rs.id === selectedSwatch.id
                        ? 'ring-2 ring-bronze border-charcoal dark:border-white'
                        : 'border-black/25 dark:border-white/25'
                    }`}
                    style={{ backgroundColor: rs.hex }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Swatch Selector Grid */}
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-warm-grey-dark dark:text-[#B5B2AA] block mb-2">
              Select Illustrative Colour:
            </span>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {ILLUSTRATIVE_PALETTE.filter((s) => {
                const matchesFam = activeFamily === 'All' || s.family === activeFamily;
                const q = colourSearch.trim().toLowerCase();
                const matchesQuery =
                  !q ||
                  s.name.toLowerCase().includes(q) ||
                  s.hex.toLowerCase().includes(q) ||
                  s.family.toLowerCase().includes(q);
                return matchesFam && matchesQuery;
              }).map((swatch) => {
                const isSelected = swatch.id === selectedSwatch.id;
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => selectSwatch(swatch)}
                    className={`flex items-center gap-2 p-2 border text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-charcoal dark:bg-[#F4F1EA] text-white dark:text-charcoal border-charcoal dark:border-[#F4F1EA]'
                        : 'bg-ivory-light dark:bg-[#1A1B19] text-charcoal dark:text-[#F4F1EA] border-warm-grey/40 dark:border-white/15 hover:border-bronze'
                    }`}
                  >
                    <span className="w-4 h-4 shrink-0 border border-black/20 dark:border-white/20" style={{ backgroundColor: swatch.hex }} aria-hidden="true" />
                    <span className="font-sans text-[11px] font-medium leading-tight truncate">
                      {swatch.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Substrate & Lighting Notes */}
          <div className="space-y-3 pt-2 border-t border-warm-grey/30 dark:border-white/10 text-xs">
            <div className="p-3 bg-ivory dark:bg-[#1A1B19] border border-warm-grey/30 dark:border-white/10">
              <span className="font-mono text-[10px] uppercase tracking-wider text-bronze dark:text-[#C9B28F] block mb-1 font-semibold">
                Target Substrate
              </span>
              <p className="text-charcoal/85 dark:text-[#F4F1EA]/85 leading-relaxed">
                {selectedSwatch.recommendedSubstrate}
              </p>
            </div>
            <div className="p-3 bg-ivory dark:bg-[#1A1B19] border border-warm-grey/30 dark:border-white/10">
              <span className="font-mono text-[10px] uppercase tracking-wider text-bronze dark:text-[#C9B28F] block mb-1 font-semibold">
                Daylight Behaviour
              </span>
              <p className="text-charcoal/85 dark:text-[#F4F1EA]/85 leading-relaxed">
                {selectedSwatch.lightingBehavior}
              </p>
            </div>
          </div>

          {/* Enquiry Integration */}
          <div className="space-y-2.5 pt-2 border-t border-warm-grey/30 dark:border-white/10">
            <Link
              href={quoteHref}
              className="w-full py-3 px-4 bg-bronze hover:bg-bronze-hover text-white font-mono text-xs uppercase tracking-[0.16em] flex items-center justify-center gap-2 transition-colors"
            >
              <FileText size={14} aria-hidden="true" />
              <span>Request Quote With This Finish</span>
            </Link>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-[#1B7A43] hover:bg-[#156336] text-white font-mono text-xs uppercase tracking-[0.16em] flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle size={14} aria-hidden="true" />
              <span>Discuss via WhatsApp</span>
            </a>
          </div>

          {/* Accuracy Disclaimer */}
          <p className="text-[11px] text-warm-grey-dark dark:text-[#B5B2AA] leading-relaxed italic pt-1">
            * Illustrative Palette Only: Digital previews are approximate and depend on screen calibration, ambient room lighting, and substrate porosity. Actual paint products and drawdown samples are confirmed during your on-site Adelaide consultation.
          </p>
        </div>
      </div>
    </section>
  );
};

export default WallColourVisualiser;
