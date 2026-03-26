import type { AppConfig } from './types';

// Set to true to enable verbose [VisionTracker] debug logs
export const DEBUG = process.env.NODE_ENV === 'development' || false;

// API base URL
export const API_BASE = '/api';

// Default config
export const DEFAULT_CONFIG: AppConfig = {
  confidenceThreshold: 0.5,
  objectTypes: [],
  captureIntervalMs: 5000,
  detectionFps: 10,
  preBufferSeconds: 2,
  postBufferSeconds: 2,
  maxClipSeconds: 30,
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
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush',
];
