import { join } from 'path';
import { getClipsDir } from '../recorder';

export const recordingsIdApi = {
  GET: async (req: Request) => {
    const params = (req as Request & { params: { id: string } }).params;
    const id = decodeURIComponent(params.id).replace(
      /\.(webm|mp4)$/,
      ''
    );
    const dir = getClipsDir();
    for (const ext of ['webm', 'mp4']) {
      const filepath = join(dir, `${id}.${ext}`);
      try {
        const file = Bun.file(filepath);
        const exists = await file.exists();
        if (exists) {
          const contentType = ext === 'mp4' ? 'video/mp4' : 'video/webm';
          return new Response(file, {
            headers: {
              'Content-Type': contentType,
              'Content-Disposition': `attachment; filename="${id}.${ext}"`,
            },
          });
        }
      } catch {
        // try next
      }
    }
    return new Response('Not found', { status: 404 });
  },
};
