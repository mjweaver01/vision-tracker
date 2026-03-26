import { getSnapshots, saveSnapshot } from '../recorder';
import { logger } from '@shared/logger';
import type { DetectionResult } from '@shared/types';

export const recordingsApi = {
  GET: async () => Response.json(await getSnapshots()),
  POST: async (req: Request) => {
    const formData = await req.formData();
    const image = formData.get('image');

    if (!image || !(image instanceof Blob)) {
      return new Response('Missing image file', { status: 400 });
    }

    let detections: DetectionResult[] = [];
    const detectionsStr = formData.get('detections');
    if (detectionsStr && typeof detectionsStr === 'string') {
      try {
        detections = JSON.parse(detectionsStr) as DetectionResult[];
      } catch {
        // ignore invalid JSON
      }
    }
    const meta = await saveSnapshot(image, detections);
    logger('[VisionTracker] Saved:', meta.filename, meta.objectCount, 'objects');
    return Response.json(meta);
  },
};
