export interface AppConfig {
  confidenceThreshold: number;
  objectTypes: string[];
  captureIntervalMs: number;
  detectionFps: number;
  deviceId?: string;
  notificationObjects: string[];
  notificationsEnabled: boolean;
}

export interface DetectionResult {
  label: string;
  score: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface SnapshotMetadata {
  id: string;
  filename: string;
  timestamp: string;
  detections: DetectionResult[];
  objectCount: number;
}
