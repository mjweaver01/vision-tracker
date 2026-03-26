import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { EFFICIENTDET_MODEL, VISION_WASM_PATH } from '@shared/constants';
import { logger } from '@shared/logger';

let detectorPromise: Promise<ObjectDetector> | null = null;

export async function getDetector(
  scoreThreshold = 0.5
): Promise<ObjectDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      logger('[VisionTracker] Loading object detection model...');

      let wasmPath = VISION_WASM_PATH;
      let modelPath = EFFICIENTDET_MODEL;

      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          wasmPath = './wasm';
          modelPath = './models/efficientdet_lite0.tflite';
        }
      } catch {
        // not on native platform
      }

      const vision = await FilesetResolver.forVisionTasks(wasmPath);
      const detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU',
        },
        scoreThreshold,
        maxResults: 10,
        runningMode: 'VIDEO',
      });

      logger('[VisionTracker] Object detection model loaded');
      return detector;
    })();
  }
  return detectorPromise;
}

export function resetDetector(): void {
  detectorPromise = null;
}
