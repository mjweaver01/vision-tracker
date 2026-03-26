import { useEffect, useRef } from 'react';
import type { DetectionResult } from '@shared/types';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  detections: DetectionResult[];
  isCapturing?: boolean;
}

export function CameraFeed({ videoRef, stream, detections, isCapturing }: CameraFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
    }
  }, [stream, videoRef]);

  // Draw bounding boxes on canvas overlay
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

      // Match canvas size to video display size
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

      for (const det of detections) {
        if (!det.boundingBox) continue;
        const { x, y, width, height } = det.boundingBox;
        const bx = x * scaleX;
        const by = y * scaleY;
        const bw = width * scaleX;
        const bh = height * scaleY;

        // Bounding box
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        // Label background
        const label = `${det.label} ${Math.round(det.score * 100)}%`;
        ctx.font = '14px system-ui, sans-serif';
        const textMetrics = ctx.measureText(label);
        const textHeight = 18;
        const padding = 4;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.fillRect(
          bx,
          by - textHeight - padding,
          textMetrics.width + padding * 2,
          textHeight + padding
        );

        // Label text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, bx + padding, by - padding - 2);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [detections, videoRef]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl bg-zinc-900 ${
        isCapturing ? 'ring-2 ring-red-500' : ''
      }`}
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
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {isCapturing && (
        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-medium text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Capturing
        </div>
      )}
    </div>
  );
}
