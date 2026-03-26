import type { AppConfig, SnapshotMetadata, DetectionResult } from '@shared/types';
import { DEFAULT_CONFIG } from '@shared/constants';
import type { ApiService } from './api';
import { putSnapshot, getSnapshot, getAllSnapshots } from './db';

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

  async getSnapshots(): Promise<SnapshotMetadata[]> {
    const records = await getAllSnapshots();
    return records.map(({ id, filename, timestamp, detections, objectCount }) => ({
      id,
      filename,
      timestamp,
      detections,
      objectCount,
    }));
  }

  async saveSnapshot(
    imageBlob: Blob,
    detections: DetectionResult[]
  ): Promise<SnapshotMetadata> {
    const timestamp = new Date().toISOString();
    const id = timestamp.replace(/[:.]/g, '-');
    const filename = `${id}.jpg`;

    await putSnapshot({
      id,
      filename,
      timestamp,
      detections,
      objectCount: detections.length,
      imageBlob,
    });

    return { id, filename, timestamp, detections, objectCount: detections.length };
  }

  async getSnapshotImageUrl(id: string): Promise<string> {
    const record = await getSnapshot(id);
    if (!record) throw new Error(`Snapshot ${id} not found`);
    return URL.createObjectURL(record.imageBlob);
  }

  async getSnapshotImageBlob(id: string): Promise<Blob> {
    const record = await getSnapshot(id);
    if (!record) throw new Error(`Snapshot ${id} not found`);
    return record.imageBlob;
  }
}
