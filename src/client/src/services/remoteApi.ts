import type { AppConfig, SnapshotMetadata, DetectionResult } from '@shared/types';
import { API_BASE } from '@shared/constants';
import type { ApiService } from './api';
import { getBrowserId } from '../lib/browserId';

export class RemoteApiService implements ApiService {
  async getConfig(): Promise<AppConfig> {
    const res = await fetch(`${API_BASE}/config`, {
      headers: { 'X-Browser-Id': getBrowserId() },
    });
    return res.json();
  }

  async saveConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Browser-Id': getBrowserId(),
      },
      body: JSON.stringify(updates),
    });
    return res.json();
  }

  async getSnapshots(): Promise<SnapshotMetadata[]> {
    const res = await fetch(`${API_BASE}/recordings`);
    return res.json();
  }

  async saveSnapshot(
    imageBlob: Blob,
    detections: DetectionResult[]
  ): Promise<SnapshotMetadata> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'snapshot.jpg');
    formData.append('detections', JSON.stringify(detections));

    const res = await fetch(`${API_BASE}/recordings`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  }

  async getSnapshotImageUrl(id: string): Promise<string> {
    return `${API_BASE}/recordings/${encodeURIComponent(id)}`;
  }

  async getSnapshotImageBlob(id: string): Promise<Blob> {
    const res = await fetch(`${API_BASE}/recordings/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Failed to fetch snapshot ${id}`);
    return res.blob();
  }
}
