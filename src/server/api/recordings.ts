import { getClips, saveClip } from '../recorder';
import { logger } from '@shared/logger';
import type { DetectionResult } from '@shared/types';

export const recordingsApi = {
  GET: async () => Response.json(await getClips()),
  POST: async (req: Request) => {
    const formData = await req.formData();
    const video = formData.get('video');

    if (!video || !(video instanceof Blob)) {
      return new Response('Missing video file', { status: 400 });
    }

    const durationSeconds = parseFloat(
      String(formData.get('durationSeconds') || '0')
    );

    let detections: DetectionResult[] = [];
    const detectionsStr = formData.get('detections');
    if (detectionsStr && typeof detectionsStr === 'string') {
      try {
        detections = JSON.parse(detectionsStr) as DetectionResult[];
      } catch {
        // ignore invalid JSON
      }
    }
    const meta = await saveClip(video, durationSeconds, detections);
    logger(
      '[VisionTracker] Saved:',
      meta.filename,
      meta.durationSeconds.toFixed(1) + 's,',
      meta.objectCount,
      'objects'
    );
    return Response.json(meta);
  },
};
