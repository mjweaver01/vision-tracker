import type { AppConfig } from './types';

// Set to true to enable verbose [VisionTracker] debug logs
export const DEBUG = process.env.NODE_ENV === 'development' || false;

// API base URL
export const API_BASE = '/api';

// Detection thresholds
export const DEFAULT_CUSTOM_MATCH_THRESHOLD = 0.3;
export const DEFAULT_MATCH_THRESHOLD = 0.6;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;
export const DEFAULT_CAPTURE_INTERVAL_MS = 5000;
export const DEFAULT_PRE_BUFFER_SECONDS = 2;
export const DEFAULT_POST_BUFFER_SECONDS = 2;
export const DEFAULT_MAX_CLIP_SECONDS = 30;
export const DEFAULT_DETECTION_FPS = 30;

// Default config
export const DEFAULT_CONFIG: AppConfig = {
  confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  objectTypes: [],
  captureIntervalMs: DEFAULT_CAPTURE_INTERVAL_MS,
  detectionFps: DEFAULT_DETECTION_FPS,
  preBufferSeconds: DEFAULT_PRE_BUFFER_SECONDS,
  postBufferSeconds: DEFAULT_POST_BUFFER_SECONDS,
  maxClipSeconds: DEFAULT_MAX_CLIP_SECONDS,
  customMatchThreshold: DEFAULT_CUSTOM_MATCH_THRESHOLD,
  notificationObjects: [],
  notificationsEnabled: false,
};

// EfficientDet-Lite0 object detection model
export const EFFICIENTDET_MODEL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite';
export const VISION_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';

// COCO 80-class labels
export const COCO_LABELS = [
  'person',
  'bicycle',
  'car',
  'motorcycle',
  'airplane',
  'bus',
  'train',
  'truck',
  'boat',
  'traffic light',
  'fire hydrant',
  'stop sign',
  'parking meter',
  'bench',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
  'backpack',
  'umbrella',
  'handbag',
  'tie',
  'suitcase',
  'frisbee',
  'skis',
  'snowboard',
  'sports ball',
  'kite',
  'baseball bat',
  'baseball glove',
  'skateboard',
  'surfboard',
  'tennis racket',
  'bottle',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',
  'chair',
  'couch',
  'potted plant',
  'bed',
  'dining table',
  'toilet',
  'tv',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
  'microwave',
  'oven',
  'toaster',
  'sink',
  'refrigerator',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddy bear',
  'hair drier',
  'toothbrush',
];
