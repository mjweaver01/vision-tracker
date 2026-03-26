import { join } from 'path';
import { getSnapshotsDir } from '../recorder';

export const recordingsIdApi = {
  GET: async (req: Request) => {
    const params = (req as Request & { params: { id: string } }).params;
    const id = decodeURIComponent(params.id).replace(
      /\.(jpg|jpeg|png)$/,
      ''
    );
    const dir = getSnapshotsDir();
    for (const ext of ['jpg', 'jpeg', 'png']) {
      const filepath = join(dir, `${id}.${ext}`);
      try {
        const file = Bun.file(filepath);
        const exists = await file.exists();
        if (exists) {
          const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
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
