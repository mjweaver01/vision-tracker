import { ImageEmbedder, FilesetResolver } from '@mediapipe/tasks-vision';
import { VISION_WASM_PATH } from '@shared/constants';
import { logger } from '@shared/logger';

let embedderPromise: Promise<ImageEmbedder> | null = null;

export async function getEmbedder(): Promise<ImageEmbedder> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      logger('[VisionTracker] Loading image embedder model...');

      let wasmPath = VISION_WASM_PATH;
      let modelPath =
        'https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite';

      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          wasmPath = './wasm';
          modelPath = './models/mobilenet_v3_small.tflite';
        }
      } catch {
        // not on native platform
      }

      const vision = await FilesetResolver.forVisionTasks(wasmPath);
      const embedder = await ImageEmbedder.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU',
        },
        l2Normalize: true,
        quantize: false,
        runningMode: 'IMAGE',
      });

      logger('[VisionTracker] Image embedder model loaded');
      return embedder;
    })();
  }
  return embedderPromise;
}

/** Crop a region from a video element and return as an ImageData-compatible canvas */
export function cropFromVideo(
  video: HTMLVideoElement,
  x: number,
  y: number,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    video,
    Math.round(x),
    Math.round(y),
    Math.round(width),
    Math.round(height),
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas;
}

/** Extract embedding from a canvas/image */
export async function embedImage(canvas: HTMLCanvasElement): Promise<number[]> {
  const embedder = await getEmbedder();
  const result = embedder.embed(canvas);
  const embedding = result.embeddings[0]?.floatEmbedding;
  if (!embedding) throw new Error('No embedding returned');
  return Array.from(embedding);
}

/** Compare two embeddings using cosine similarity (returns -1 to 1) */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Find the best matching custom object for a given embedding */
export function findBestMatch(
  embedding: number[],
  customObjects: { label: string; embeddings: number[][] }[],
  threshold = 0.6
): { label: string; similarity: number } | null {
  let best: { label: string; similarity: number } | null = null;

  for (const obj of customObjects) {
    // Average similarity across all example embeddings
    let totalSim = 0;
    for (const ref of obj.embeddings) {
      totalSim += cosineSimilarity(embedding, ref);
    }
    const avgSim = totalSim / obj.embeddings.length;

    if (avgSim >= threshold && (!best || avgSim > best.similarity)) {
      best = { label: obj.label, similarity: avgSim };
    }
  }

  return best;
}
