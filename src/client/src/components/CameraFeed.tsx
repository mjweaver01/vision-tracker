import { useCallback, useEffect, useRef } from 'react';
import type { DetectionResult } from '@shared/types';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  detections: DetectionResult[];
  isRecording?: boolean;
  onDetectionClick?: (detection: DetectionResult) => void;
}

export function CameraFeed({
  videoRef,
  stream,
  detections,
  isRecording,
  onDetectionClick,
}: CameraFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const detectionsRef = useRef(detections);
  detectionsRef.current = detections;

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
    [onDetectionClick, videoRef]
  );

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

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

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
        isRecording ? 'ring-2 ring-red-500' : ''
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
        className={`absolute inset-0 h-full w-full ${onDetectionClick ? 'cursor-pointer' : 'pointer-events-none'}`}
        onClick={onDetectionClick ? handleCanvasClick : undefined}
      />
      {isRecording && (
        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-medium text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Recording
        </div>
      )}
    </div>
  );
}
