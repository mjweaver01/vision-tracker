import { useCallback, useEffect, useRef, useState } from 'react';
import type { DetectionResult } from '@shared/types';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  detections: DetectionResult[];
  isRecording?: boolean;
  onDetectionClick?: (detection: DetectionResult) => void;
  drawingRegion?: boolean;
  onRegionDrawn?: (region: { x: number; y: number; width: number; height: number }) => void;
  onRegionCancelled?: () => void;
}

export function CameraFeed({
  videoRef,
  stream,
  detections,
  isRecording,
  onDetectionClick,
  drawingRegion,
  onRegionDrawn,
  onRegionCancelled,
}: CameraFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const detectionsRef = useRef(detections);
  detectionsRef.current = detections;

  // All region drawing coordinates stored in refs — no state, no re-renders during drag
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragEndRef = useRef<{ x: number; y: number } | null>(null);
  const [regionReady, setRegionReady] = useState(false);

  // Reset when drawingRegion changes
  useEffect(() => {
    if (!drawingRegion) {
      dragStartRef.current = null;
      dragEndRef.current = null;
      setRegionReady(false);
    }
  }, [drawingRegion]);

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
    }
  }, [stream, videoRef]);

  // Handle clicks on bounding boxes
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (drawingRegion) return;
      if (!onDetectionClick) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;

      for (const det of detectionsRef.current) {
        if (!det.boundingBox) continue;
        const bx = det.boundingBox.x * scaleX;
        const by = det.boundingBox.y * scaleY;
        const bw = det.boundingBox.width * scaleX;
        const bh = det.boundingBox.height * scaleY;

        if (clickX >= bx && clickX <= bx + bw && clickY >= by && clickY <= by + bh) {
          onDetectionClick(det);
          return;
        }
      }
    },
    [onDetectionClick, videoRef, drawingRegion]
  );

  // Region drawing: mousedown on canvas starts drag, mousemove+mouseup on document during drag only
  useEffect(() => {
    if (!drawingRegion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let moveHandler: ((e: MouseEvent) => void) | null = null;
    let upHandler: (() => void) | null = null;

    const downHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      dragStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      dragEndRef.current = null;
      setRegionReady(false);

      moveHandler = (me: MouseEvent) => {
        const r = canvas.getBoundingClientRect();
        dragEndRef.current = { x: me.clientX - r.left, y: me.clientY - r.top };
      };

      upHandler = () => {
        if (moveHandler) document.removeEventListener('mousemove', moveHandler);
        if (upHandler) document.removeEventListener('mouseup', upHandler);
        moveHandler = null;
        upHandler = null;
        setRegionReady(true);
      };

      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
    };

    canvas.addEventListener('mousedown', downHandler);
    return () => {
      canvas.removeEventListener('mousedown', downHandler);
      if (moveHandler) document.removeEventListener('mousemove', moveHandler);
      if (upHandler) document.removeEventListener('mouseup', upHandler);
    };
  }, [drawingRegion, regionReady]);

  const handleConfirmRegion = useCallback(() => {
    const start = dragStartRef.current;
    const end = dragEndRef.current;
    if (!start || !end || !onRegionDrawn) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    const scaleX = video.videoWidth / canvas.width;
    const scaleY = video.videoHeight / canvas.height;
    const x = Math.min(start.x, end.x) * scaleX;
    const y = Math.min(start.y, end.y) * scaleY;
    const width = Math.abs(end.x - start.x) * scaleX;
    const height = Math.abs(end.y - start.y) * scaleY;

    onRegionDrawn({ x, y, width, height });
    dragStartRef.current = null;
    dragEndRef.current = null;
    setRegionReady(false);
  }, [onRegionDrawn, videoRef]);

  // Single rAF draw loop — reads refs directly, no deps on drag state
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    function draw() {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c) return;

      const ctx = c.getContext('2d');
      if (!ctx) return;

      const rect = v.getBoundingClientRect();
      if (c.width !== rect.width || c.height !== rect.height) {
        c.width = rect.width;
        c.height = rect.height;
      }

      ctx.clearRect(0, 0, c.width, c.height);

      if (v.videoWidth === 0 || v.videoHeight === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const scaleX = c.width / v.videoWidth;
      const scaleY = c.height / v.videoHeight;

      // Draw detection bounding boxes
      for (const det of detectionsRef.current) {
        if (!det.boundingBox) continue;
        const { x, y, width, height } = det.boundingBox;
        const bx = x * scaleX;
        const by = y * scaleY;
        const bw = width * scaleX;
        const bh = height * scaleY;

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        const label = `${det.label} ${Math.round(det.score * 100)}%`;
        ctx.font = '14px system-ui, sans-serif';
        const textMetrics = ctx.measureText(label);
        const textHeight = 18;
        const padding = 4;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.fillRect(bx, by - textHeight - padding, textMetrics.width + padding * 2, textHeight + padding);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, bx + padding, by - padding - 2);
      }

      // Draw region selection rectangle — reads refs directly
      const start = dragStartRef.current;
      const end = dragEndRef.current;
      if (drawingRegion && start && end) {
        const rx = Math.min(start.x, end.x);
        const ry = Math.min(start.y, end.y);
        const rw = Math.abs(end.x - start.x);
        const rh = Math.abs(end.y - start.y);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, c.width, ry);
        ctx.fillRect(0, ry, rx, rh);
        ctx.fillRect(rx + rw, ry, c.width - rx - rw, rh);
        ctx.fillRect(0, ry + rh, c.width, c.height - ry - rh);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef, drawingRegion]);

  const canInteract = drawingRegion || onDetectionClick;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl bg-zinc-900 ${
        isRecording ? 'ring-2 ring-red-500' : ''
      } ${drawingRegion ? 'ring-2 ring-red-500/50' : ''}`}
    >
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        autoPlay
        playsInline
        muted
        className="block w-full"
        style={{ transform: 'scaleX(1)' }}
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${
          drawingRegion ? 'cursor-crosshair' : canInteract ? 'cursor-pointer' : 'pointer-events-none'
        }`}
        onClick={!drawingRegion ? handleCanvasClick : undefined}
      />
      {isRecording && !drawingRegion && (
        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-medium text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Recording
        </div>
      )}
      {drawingRegion && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-zinc-900/90 px-4 py-2 ring-1 ring-zinc-700 backdrop-blur-sm">
          <span className="text-xs text-zinc-400">
            {regionReady ? 'Region selected' : 'Click and drag to select region'}
          </span>
          {regionReady && (
            <button
              type="button"
              onClick={handleConfirmRegion}
              className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
            >
              Capture
            </button>
          )}
          <button
            type="button"
            onClick={onRegionCancelled}
            className="rounded-full bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
