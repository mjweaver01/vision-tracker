import type { AppConfig, ClipMetadata, CustomObject, DetectionResult } from '@shared/types';
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

  async getClips(): Promise<ClipMetadata[]> {
    const res = await fetch(`${API_BASE}/recordings`);
    return res.json();
  }

  async saveClip(
    videoBlob: Blob,
    durationSeconds: number,
    detections: DetectionResult[]
  ): Promise<ClipMetadata> {
    const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const formData = new FormData();
    formData.append('video', videoBlob, `clip.${ext}`);
    formData.append('durationSeconds', String(durationSeconds));
    formData.append('detections', JSON.stringify(detections));

    const res = await fetch(`${API_BASE}/recordings`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  }

  async getClipUrl(id: string): Promise<string> {
    return `${API_BASE}/recordings/${encodeURIComponent(id)}`;
  }

  async getClipBlob(id: string): Promise<Blob> {
    const res = await fetch(`${API_BASE}/recordings/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Failed to fetch clip ${id}`);
    return res.blob();
  }

  async getCustomObjects(): Promise<CustomObject[]> {
    const res = await fetch(`${API_BASE}/custom-objects`);
    return res.json();
  }

  async saveCustomObject(obj: { label: string; baseClass: string | null; embeddings: number[][]; matchThreshold?: number }): Promise<CustomObject> {
    const res = await fetch(`${API_BASE}/custom-objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    });
    if (!res.ok) throw new Error('Failed to save custom object');
    return res.json();
  }

  async addExamples(id: string, embeddings: number[][]): Promise<CustomObject> {
    const res = await fetch(`${API_BASE}/custom-objects/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeddings }),
    });
    if (!res.ok) throw new Error('Failed to add examples');
    return res.json();
  }

  async deleteCustomObject(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/custom-objects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete');
  }
}
