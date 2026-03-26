import { useCallback, useEffect, useRef, useState } from 'react';
import type { DetectionResult } from '@shared/types';
import { logger } from '@shared/logger';
import { getDetector, resetDetector } from '../lib/objectDetector';
import { api } from '../services';
import type { ObjectDetector } from '@mediapipe/tasks-vision';

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

interface UseVisionCaptureOptions {
  confidenceThreshold: number;
  enabled: boolean;
  onSnapshotUploaded?: () => void;
  objectTypes?: string[];
  detectionFps?: number;
  captureIntervalMs?: number;
  deviceId?: string;
  notificationObjects?: string[];
  notificationsEnabled?: boolean;
}

interface UseVisionCaptureResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  detections: DetectionResult[];
  isCapturing: boolean;
  error: string | null;
  stream: MediaStream | null;
  lastDetection: string | null;
  devices: MediaDeviceInfo[];
}

export function useVisionCapture(options: UseVisionCaptureOptions): UseVisionCaptureResult {
  const {
    confidenceThreshold,
    enabled,
    onSnapshotUploaded,
    objectTypes = [],
    detectionFps = 10,
    captureIntervalMs = 5000,
    deviceId,
    notificationObjects = [],
    notificationsEnabled = false,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const detectorRef = useRef<ObjectDetector | null>(null);
  const rafRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef(0);
  const lastCaptureTimeRef = useRef(0);
  const enabledRef = useRef(enabled);
  const optionsRef = useRef(options);
  enabledRef.current = enabled;
  optionsRef.current = options;

  // Enumerate camera devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devs => {
      setDevices(
        devs
          .filter(d => d.kind === 'videoinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}` }))
      );
    }).catch(() => {});
  }, [stream]);

  // Start/stop camera stream
  useEffect(() => {
    if (!enabled) {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
      setDetections([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: 'environment' },
    };

    navigator.mediaDevices.getUserMedia(constraints).then(mediaStream => {
      if (cancelled) {
        mediaStream.getTracks().forEach(t => t.stop());
        return;
      }
      setStream(mediaStream);
      setError(null);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    }).catch(err => {
      if (!cancelled) {
        logger('[VisionTracker] Camera error:', err);
        setError(err.name === 'NotAllowedError'
          ? 'Camera access denied. Allow camera access and reload.'
          : err.name === 'NotFoundError'
            ? 'No camera found.'
            : `Camera error: ${err.message}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, deviceId]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  // Send notification
  const notify = useCallback((label: string) => {
    if (!notificationsEnabled || notificationObjects.length === 0) return;
    if (!notificationObjects.includes(label)) return;
    if (Notification.permission === 'granted') {
      new Notification('Vision Tracker', { body: `Detected: ${label}` });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, [notificationsEnabled, notificationObjects]);

  // Detection loop
  useEffect(() => {
    if (!enabled || !stream) return;

    let running = true;
    const frameInterval = 1000 / detectionFps;

    async function startDetection() {
      try {
        detectorRef.current = await getDetector(confidenceThreshold);
      } catch (err) {
        logger('[VisionTracker] Failed to load detector:', err);
        setError('Failed to load object detection model.');
        return;
      }

      function detectFrame(timestamp: number) {
        if (!running || !enabledRef.current) return;

        const video = videoRef.current;
        const detector = detectorRef.current;
        if (!video || !detector || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        // Throttle detection to target FPS
        if (timestamp - lastDetectionTimeRef.current < frameInterval) {
          rafRef.current = requestAnimationFrame(detectFrame);
          return;
        }
        lastDetectionTimeRef.current = timestamp;

        try {
          const result = detector.detectForVideo(video, timestamp);
          const mapped: DetectionResult[] = (result.detections ?? []).map(d => ({
            label: d.categories?.[0]?.categoryName ?? 'unknown',
            score: d.categories?.[0]?.score ?? 0,
            boundingBox: d.boundingBox ? {
              x: d.boundingBox.originX,
              y: d.boundingBox.originY,
              width: d.boundingBox.width,
              height: d.boundingBox.height,
            } : undefined,
          }));

          // Filter by object types if specified
          const opts = optionsRef.current;
          const types = opts.objectTypes ?? [];
          const filtered = types.length > 0
            ? mapped.filter(d => types.includes(d.label))
            : mapped;

          setDetections(filtered);

          if (filtered.length > 0) {
            setLastDetection(filtered[0].label);

            // Notify
            for (const d of filtered) {
              notify(d.label);
            }

            // Snapshot capture with cooldown
            const now = performance.now();
            if (now - lastCaptureTimeRef.current >= (opts.captureIntervalMs ?? 5000)) {
              lastCaptureTimeRef.current = now;
              captureSnapshot(video, filtered);
            }
          }
        } catch (err) {
          logger('[VisionTracker] Detection error:', err);
        }

        rafRef.current = requestAnimationFrame(detectFrame);
      }

      rafRef.current = requestAnimationFrame(detectFrame);
    }

    startDetection();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, stream, detectionFps, confidenceThreshold, notify]);

  // Capture snapshot from video
  const captureSnapshot = useCallback(async (video: HTMLVideoElement, detections: DetectionResult[]) => {
    setIsCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!blob) return;

      await api().saveSnapshot(blob, detections);
      logger('[VisionTracker] Snapshot uploaded:', detections.length, 'objects');
      onSnapshotUploaded?.();
    } catch (err) {
      logger('[VisionTracker] Snapshot upload error:', err);
    } finally {
      setIsCapturing(false);
    }
  }, [onSnapshotUploaded]);

  // Reset detector when threshold changes
  useEffect(() => {
    resetDetector();
  }, [confidenceThreshold]);

  return {
    videoRef,
    detections,
    isCapturing,
    error,
    stream,
    lastDetection,
    devices,
  };
}
