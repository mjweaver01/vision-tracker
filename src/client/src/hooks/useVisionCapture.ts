import { useCallback, useEffect, useRef, useState } from 'react';
import type { CustomObject, DetectionResult } from '@shared/types';
import { logger } from '@shared/logger';
import { getDetector, resetDetector } from '../lib/objectDetector';
import { cropFromVideo, embedImage, findBestMatch } from '../lib/imageEmbedder';
import { api } from '../services';
import type { ObjectDetector } from '@mediapipe/tasks-vision';

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

interface UseVisionCaptureOptions {
  confidenceThreshold: number;
  enabled: boolean;
  onClipUploaded?: () => void;
  objectTypes?: string[];
  detectionFps?: number;
  captureIntervalMs?: number;
  preBufferSeconds?: number;
  postBufferSeconds?: number;
  maxClipSeconds?: number;
  deviceId?: string;
  notificationObjects?: string[];
  notificationsEnabled?: boolean;
  customObjects?: CustomObject[];
}

interface UseVisionCaptureResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  detections: DetectionResult[];
  isRecording: boolean;
  error: string | null;
  stream: MediaStream | null;
  lastDetection: string | null;
  devices: MediaDeviceInfo[];
}

export function useVisionCapture(options: UseVisionCaptureOptions): UseVisionCaptureResult {
  const {
    confidenceThreshold,
    enabled,
    onClipUploaded,
    objectTypes = [],
    detectionFps = 10,
    captureIntervalMs = 5000,
    preBufferSeconds = 2,
    postBufferSeconds = 2,
    maxClipSeconds = 30,
    deviceId,
    notificationObjects = [],
    notificationsEnabled = false,
    customObjects = [],
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const detectorRef = useRef<ObjectDetector | null>(null);
  const rafRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef(0);
  const enabledRef = useRef(enabled);
  const optionsRef = useRef(options);
  enabledRef.current = enabled;
  optionsRef.current = options;

  // Embedding lock to prevent overlapping async embedding calls
  const embeddingInFlightRef = useRef(false);

  // Pre-buffer: a continuously running recorder that we stop to grab recent video
  const preRecorderRef = useRef<MediaRecorder | null>(null);
  const preChunksRef = useRef<Blob[]>([]);

  // Active recording state
  const activeRecorderRef = useRef<MediaRecorder | null>(null);
  const activeChunksRef = useRef<Blob[]>([]);
  const recordingStateRef = useRef<'idle' | 'recording' | 'cooldown'>('idle');
  const lastObjectSeenRef = useRef(0);
  const recordingStartRef = useRef(0);
  const allDetectionsRef = useRef<DetectionResult[]>([]);
  const cooldownUntilRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = stream;

  const getMimeType = useCallback(() => {
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))
      return 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/webm'))
      return 'video/webm';
    return 'video/mp4';
  }, []);

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

  // Start the pre-buffer recorder (continuously records so we can grab recent video)
  const startPreRecorder = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    try {
      const recorder = new MediaRecorder(s, {
        mimeType: getMimeType(),
        videoBitsPerSecond: 2_500_000,
      });
      preChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          preChunksRef.current.push(e.data);
        }
      };
      recorder.start();
      preRecorderRef.current = recorder;
    } catch {
      // ignore — MediaRecorder may not be supported
    }
  }, [getMimeType]);

  // Manage pre-buffer recorder lifecycle
  useEffect(() => {
    if (!stream || !enabled) {
      if (preRecorderRef.current && preRecorderRef.current.state !== 'inactive') {
        try { preRecorderRef.current.stop(); } catch { /* ignore */ }
      }
      preRecorderRef.current = null;
      preChunksRef.current = [];
      return;
    }

    startPreRecorder();

    // Periodically restart pre-recorder to limit memory (keep last preBufferSeconds)
    const restartInterval = setInterval(() => {
      if (recordingStateRef.current !== 'idle') return; // don't restart during recording
      const old = preRecorderRef.current;
      if (old && old.state !== 'inactive') {
        try { old.stop(); } catch { /* ignore */ }
      }
      // Old chunks are discarded, start fresh
      startPreRecorder();
    }, Math.max(preBufferSeconds * 1000, 3000));

    return () => {
      clearInterval(restartInterval);
      if (preRecorderRef.current && preRecorderRef.current.state !== 'inactive') {
        try { preRecorderRef.current.stop(); } catch { /* ignore */ }
      }
      preRecorderRef.current = null;
      preChunksRef.current = [];
    };
  }, [stream, enabled, preBufferSeconds, startPreRecorder]);

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

  // Upload the recorded clip
  const uploadClip = useCallback(async (preBlob: Blob | null, activeBlob: Blob, allDetections: DetectionResult[], durationSeconds: number) => {
    try {
      // Combine pre-buffer + active recording into one playable file
      // Both are complete WebM files; we upload the active recording which has proper headers
      // Pre-buffer is a separate complete file; for simplicity we combine as the active recording
      // which started when detection began
      const blob = activeBlob;

      // Deduplicate detections by label, keeping highest score
      const deduped = new Map<string, DetectionResult>();
      for (const d of allDetections) {
        const existing = deduped.get(d.label);
        if (!existing || d.score > existing.score) {
          deduped.set(d.label, d);
        }
      }
      const detections = Array.from(deduped.values());
      await api().saveClip(blob, durationSeconds, detections);
      logger('[VisionTracker] Clip uploaded:', durationSeconds.toFixed(1) + 's,', detections.length, 'object types');
      onClipUploaded?.();
    } catch (err) {
      logger('[VisionTracker] Clip upload error:', err);
    }
  }, [onClipUploaded]);

  // Start active recording
  const startActiveRecording = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;

    // Stop pre-buffer recorder — its data becomes the pre-buffer blob
    // (We don't use the pre-buffer blob in the final upload for now since
    //  combining two separate WebM files requires remuxing. The active
    //  recording starts right when detection triggers which is close enough.)
    if (preRecorderRef.current && preRecorderRef.current.state !== 'inactive') {
      try { preRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    preRecorderRef.current = null;

    const recorder = new MediaRecorder(s, {
      mimeType: getMimeType(),
      videoBitsPerSecond: 2_500_000,
    });
    activeChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        activeChunksRef.current.push(e.data);
      }
    };
    recorder.start(500); // timeslice for progress, but all from same session so headers are valid
    activeRecorderRef.current = recorder;
    recordingStartRef.current = Date.now();
    setIsRecording(true);
    logger('[VisionTracker] Recording started');
  }, [getMimeType]);

  // Stop active recording and upload
  const stopActiveRecording = useCallback(() => {
    const recorder = activeRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    const dets = [...allDetectionsRef.current];
    const startTime = recordingStartRef.current;

    recorder.onstop = () => {
      const chunks = activeChunksRef.current;
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: chunks[0].type });
        const durationSeconds = (Date.now() - startTime) / 1000;
        uploadClip(null, blob, dets, durationSeconds);
      }
      activeChunksRef.current = [];
      activeRecorderRef.current = null;

      // Restart pre-buffer recorder
      startPreRecorder();
    };

    try { recorder.stop(); } catch { /* ignore */ }
    setIsRecording(false);
    allDetectionsRef.current = [];
    logger('[VisionTracker] Recording stopped');
  }, [uploadClip, startPreRecorder]);

  // Async custom object matching (runs outside rAF to avoid blocking)
  const matchCustomObjects = useCallback(async (
    detections: DetectionResult[],
    customObjs: CustomObject[],
    video: HTMLVideoElement
  ): Promise<DetectionResult[]> => {
    const enhanced = [...detections];

    // Relabel COCO detections that match custom objects
    const cocoRefines = customObjs.filter(o => o.baseClass);
    if (cocoRefines.length > 0) {
      for (let i = 0; i < enhanced.length; i++) {
        const det = enhanced[i];
        const relevant = cocoRefines.filter(o => o.baseClass === det.label);
        if (relevant.length === 0 || !det.boundingBox) continue;
        try {
          const crop = cropFromVideo(video, det.boundingBox.x, det.boundingBox.y, det.boundingBox.width, det.boundingBox.height);
          const embedding = await embedImage(crop);
          const match = findBestMatch(embedding, relevant);
          if (match) {
            enhanced[i] = { ...det, label: match.label, score: match.similarity };
          }
        } catch {
          // embedding failed, keep original label
        }
      }
    }

    // Scan for entirely new objects (no baseClass) using full frame
    const newObjs = customObjs.filter(o => !o.baseClass);
    if (newObjs.length > 0) {
      try {
        const frameCrop = cropFromVideo(video, 0, 0, video.videoWidth, video.videoHeight);
        const frameEmb = await embedImage(frameCrop);
        const match = findBestMatch(frameEmb, newObjs, 0.5);
        if (match) {
          const alreadyPresent = enhanced.some(d => d.label === match.label);
          if (!alreadyPresent) {
            enhanced.push({ label: match.label, score: match.similarity });
          }
        }
      } catch {
        // embedding failed
      }
    }

    return enhanced;
  }, []);

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

        const opts = optionsRef.current;
        const now = Date.now();

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
          const types = opts.objectTypes ?? [];
          const filtered = types.length > 0
            ? mapped.filter(d => types.includes(d.label))
            : mapped;

          // Set COCO detections immediately (custom matching runs async below)
          setDetections(filtered);

          // Custom object matching runs async, updates detections when done
          const customObjs = opts.customObjects ?? [];
          if (customObjs.length > 0 && video && !embeddingInFlightRef.current) {
            embeddingInFlightRef.current = true;
            matchCustomObjects(filtered, customObjs, video).then(enhanced => {
              embeddingInFlightRef.current = false;
              if (enhanced !== filtered) {
                setDetections(enhanced);
              }
            }).catch(() => { embeddingInFlightRef.current = false; });
          }

          const enhanced = filtered;

          const hasObjects = enhanced.length > 0;

          if (hasObjects) {
            setLastDetection(enhanced[0].label);
            lastObjectSeenRef.current = now;

            // Notify
            for (const d of enhanced) {
              notify(d.label);
            }
          }

          // Recording state machine
          const state = recordingStateRef.current;
          const postMs = (opts.postBufferSeconds ?? 2) * 1000;
          const maxMs = (opts.maxClipSeconds ?? 30) * 1000;

          if (state === 'idle' && hasObjects && now >= cooldownUntilRef.current) {
            // Start recording
            recordingStateRef.current = 'recording';
            allDetectionsRef.current = [...enhanced];
            startActiveRecording();
          } else if (state === 'recording') {
            // Accumulate detections
            if (hasObjects) {
              allDetectionsRef.current.push(...filtered);
            }

            // Check stop conditions
            const elapsed = now - recordingStartRef.current;
            const timeSinceLastObject = now - lastObjectSeenRef.current;
            const shouldStop = timeSinceLastObject >= postMs || elapsed >= maxMs;

            if (shouldStop) {
              recordingStateRef.current = 'cooldown';
              cooldownUntilRef.current = now + (opts.captureIntervalMs ?? 5000);
              stopActiveRecording();

              // After cooldown, return to idle
              setTimeout(() => {
                if (recordingStateRef.current === 'cooldown') {
                  recordingStateRef.current = 'idle';
                }
              }, opts.captureIntervalMs ?? 5000);
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
      // If we were recording, finalize
      if (recordingStateRef.current === 'recording') {
        recordingStateRef.current = 'idle';
        stopActiveRecording();
      }
    };
  }, [enabled, stream, detectionFps, confidenceThreshold, notify, startActiveRecording, stopActiveRecording]);

  // Reset detector when threshold changes
  useEffect(() => {
    resetDetector();
  }, [confidenceThreshold]);

  return {
    videoRef,
    detections,
    isRecording,
    error,
    stream,
    lastDetection,
    devices,
  };
}
