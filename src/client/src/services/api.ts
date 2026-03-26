import type { AppConfig, SnapshotMetadata, DetectionResult } from '@shared/types';

export interface ApiService {
  getConfig(): Promise<AppConfig>;
  saveConfig(updates: Partial<AppConfig>): Promise<AppConfig>;
  getSnapshots(): Promise<SnapshotMetadata[]>;
  saveSnapshot(
    imageBlob: Blob,
    detections: DetectionResult[]
  ): Promise<SnapshotMetadata>;
  getSnapshotImageUrl(id: string): Promise<string>;
  getSnapshotImageBlob(id: string): Promise<Blob>;
}
