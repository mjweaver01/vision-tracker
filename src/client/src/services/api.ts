import type {
  AppConfig,
  ClipMetadata,
  CustomObject,
  DetectionResult,
} from '@shared/types';

export interface ApiService {
  getConfig(): Promise<AppConfig>;
  saveConfig(updates: Partial<AppConfig>): Promise<AppConfig>;
  getClips(): Promise<ClipMetadata[]>;
  saveClip(
    videoBlob: Blob,
    durationSeconds: number,
    detections: DetectionResult[]
  ): Promise<ClipMetadata>;
  getClipUrl(id: string): Promise<string>;
  getClipBlob(id: string): Promise<Blob>;
  getCustomObjects(): Promise<CustomObject[]>;
  saveCustomObject(obj: {
    label: string;
    baseClass: string | null;
    embeddings: number[][];
    previews: string[];
    matchThreshold?: number;
  }): Promise<CustomObject>;
  addExamples(id: string, embeddings: number[][], previews: string[]): Promise<CustomObject>;
  deleteCustomObject(id: string): Promise<void>;
}
