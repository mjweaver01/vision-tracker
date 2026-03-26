export interface AppConfig {
  confidenceThreshold: number;
  objectTypes: string[];
  /** Minimum cooldown between clip recordings (ms) */
  captureIntervalMs: number;
  detectionFps: number;
  /** Seconds of video to keep before the detection trigger */
  preBufferSeconds: number;
  /** Seconds to keep recording after objects disappear */
  postBufferSeconds: number;
  /** Max clip duration in seconds (safety cap) */
  maxClipSeconds: number;
  deviceId?: string;
  notificationObjects: string[];
  notificationsEnabled: boolean;
}

export interface DetectionResult {
  label: string;
  score: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface CustomObject {
  id: string;
  label: string;
  /** Base COCO class this refines, or null for entirely new objects */
  baseClass: string | null;
  /** Stored embedding vectors from training examples */
  embeddings: number[][];
  /** Number of training examples captured */
  exampleCount: number;
  /** Similarity threshold for matching (0-1) */
  matchThreshold: number;
  createdAt: string;
}

export interface ClipMetadata {
  id: string;
  filename: string;
  timestamp: string;
  durationSeconds: number;
  detections: DetectionResult[];
  objectCount: number;
}
