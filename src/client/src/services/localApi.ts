import type {
  AppConfig,
  ClipMetadata,
  CustomObject,
  DetectionResult,
} from '@shared/types';
import { DEFAULT_CONFIG, DEFAULT_CUSTOM_MATCH_THRESHOLD } from '@shared/constants';
import type { ApiService } from './api';
import { putClip, getClip, getAllClips } from './db';

const CONFIG_KEY = 'vision-tracker:config';

export class LocalApiService implements ApiService {
  async getConfig(): Promise<AppConfig> {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_CONFIG };
  }

  async saveConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
    const current = await this.getConfig();
    const merged = { ...current, ...updates };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
    return merged;
  }

  async getClips(): Promise<ClipMetadata[]> {
    const records = await getAllClips();
    return records.map(
      ({
        id,
        filename,
        timestamp,
        durationSeconds,
        detections,
        objectCount,
      }) => ({
        id,
        filename,
        timestamp,
        durationSeconds,
        detections,
        objectCount,
      })
    );
  }

  async saveClip(
    videoBlob: Blob,
    durationSeconds: number,
    detections: DetectionResult[]
  ): Promise<ClipMetadata> {
    const timestamp = new Date().toISOString();
    const id = timestamp.replace(/[:.]/g, '-');
    const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const filename = `${id}.${ext}`;

    await putClip({
      id,
      filename,
      timestamp,
      durationSeconds,
      detections,
      objectCount: detections.length,
      videoBlob,
    });

    return {
      id,
      filename,
      timestamp,
      durationSeconds,
      detections,
      objectCount: detections.length,
    };
  }

  async getClipUrl(id: string): Promise<string> {
    const record = await getClip(id);
    if (!record) throw new Error(`Clip ${id} not found`);
    return URL.createObjectURL(record.videoBlob);
  }

  async getClipBlob(id: string): Promise<Blob> {
    const record = await getClip(id);
    if (!record) throw new Error(`Clip ${id} not found`);
    return record.videoBlob;
  }

  private customObjectsKey = 'vision-tracker:customObjects';

  async getCustomObjects(): Promise<CustomObject[]> {
    try {
      const stored = localStorage.getItem(this.customObjectsKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async saveCustomObject(obj: {
    label: string;
    baseClass: string | null;
    embeddings: number[][];
    previews: string[];
    matchThreshold?: number;
  }): Promise<CustomObject> {
    const objects = await this.getCustomObjects();
    const newObj: CustomObject = {
      id: crypto.randomUUID(),
      label: obj.label,
      baseClass: obj.baseClass,
      embeddings: obj.embeddings,
      previews: obj.previews,
      exampleCount: obj.embeddings.length,
      matchThreshold: obj.matchThreshold ?? DEFAULT_CUSTOM_MATCH_THRESHOLD,
      createdAt: new Date().toISOString(),
    };
    objects.push(newObj);
    localStorage.setItem(this.customObjectsKey, JSON.stringify(objects));
    return newObj;
  }

  async addExamples(id: string, embeddings: number[][], previews: string[]): Promise<CustomObject> {
    const objects = await this.getCustomObjects();
    const obj = objects.find(o => o.id === id);
    if (!obj) throw new Error('Not found');
    obj.embeddings.push(...embeddings);
    obj.previews.push(...previews);
    obj.exampleCount = obj.embeddings.length;
    localStorage.setItem(this.customObjectsKey, JSON.stringify(objects));
    return obj;
  }

  async deleteCustomObject(id: string): Promise<void> {
    const objects = await this.getCustomObjects();
    const filtered = objects.filter(o => o.id !== id);
    localStorage.setItem(this.customObjectsKey, JSON.stringify(filtered));
  }
}
