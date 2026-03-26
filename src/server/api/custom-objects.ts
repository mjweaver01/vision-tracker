import {
  getCustomObjects,
  saveCustomObject,
  addExamplesToObject,
  deleteCustomObject,
} from '../customObjects';

export const customObjectsApi = {
  GET: async () => Response.json(await getCustomObjects()),
  POST: async (req: Request) => {
    const body = await req.json() as {
      label: string;
      baseClass: string | null;
      embeddings: number[][];
      matchThreshold?: number;
    };
    if (!body.label || !Array.isArray(body.embeddings) || body.embeddings.length === 0) {
      return new Response('Missing label or embeddings', { status: 400 });
    }
    const obj = saveCustomObject(body);
    return Response.json(obj);
  },
};

export const customObjectIdApi = {
  POST: async (req: Request) => {
    const params = (req as Request & { params: { id: string } }).params;
    const body = await req.json() as { embeddings: number[][] };
    if (!Array.isArray(body.embeddings) || body.embeddings.length === 0) {
      return new Response('Missing embeddings', { status: 400 });
    }
    const obj = addExamplesToObject(params.id, body.embeddings);
    if (!obj) return new Response('Not found', { status: 404 });
    return Response.json(obj);
  },
  DELETE: async (req: Request) => {
    const params = (req as Request & { params: { id: string } }).params;
    const ok = deleteCustomObject(params.id);
    if (!ok) return new Response('Not found', { status: 404 });
    return Response.json({ ok: true });
  },
};
