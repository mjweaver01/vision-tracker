import { Database } from 'bun:sqlite';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { ClipMetadata, DetectionResult } from '@shared/types';
import { logger } from '@shared/logger';
import { PROJECT_ROOT } from '@shared/root';

const CLIPS_DIR = join(PROJECT_ROOT, 'recordings');
const DB_PATH = join(CLIPS_DIR, 'recordings.sqlite');

let db: Database | null = null;

function getDb(): Database {
  if (!db) {
    throw new Error(
      'Recorder not initialized. Call initRecorder() at startup.'
    );
  }
  return db;
}

export async function initRecorder(): Promise<void> {
  if (db) return;
  await mkdir(CLIPS_DIR, { recursive: true });
  db = new Database(DB_PATH, { create: true });
  db.run(`
    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      duration_seconds REAL NOT NULL DEFAULT 0,
      detections TEXT NOT NULL,
      object_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

export async function saveClip(
  file: File | Blob,
  durationSeconds: number,
  detections: DetectionResult[]
): Promise<ClipMetadata> {
  const database = getDb();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = file.type.includes('mp4') ? 'mp4' : 'webm';
  const filename = `${timestamp}.${ext}`;
  const id = timestamp;
  const filepath = join(CLIPS_DIR, filename);

  await Bun.write(filepath, file);

  const detectionsJson = JSON.stringify(detections);

  const insert = database.prepare(
    'INSERT INTO clips (id, filename, timestamp, duration_seconds, detections, object_count) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insert.run(
    id,
    filename,
    new Date().toISOString(),
    durationSeconds,
    detectionsJson,
    detections.length
  );
  logger(
    '[VisionTracker] Clip saved:',
    id,
    durationSeconds.toFixed(1) + 's,',
    detections.length,
    'objects'
  );

  return {
    id,
    filename,
    timestamp: new Date().toISOString(),
    durationSeconds,
    detections,
    objectCount: detections.length,
  };
}

export async function getClips(): Promise<ClipMetadata[]> {
  const database = getDb();

  const rows = database
    .query(
      'SELECT id, filename, timestamp, duration_seconds, detections, object_count FROM clips ORDER BY timestamp DESC'
    )
    .all() as {
    id: string;
    filename: string;
    timestamp: string;
    duration_seconds: number;
    detections: string | null;
    object_count: number;
  }[];

  return rows.map(r => {
    let detections: DetectionResult[] = [];
    if (r.detections) {
      try {
        detections = JSON.parse(r.detections) as DetectionResult[];
      } catch {
        // ignore invalid JSON
      }
    }
    return {
      id: r.id,
      filename: r.filename,
      timestamp: r.timestamp,
      durationSeconds: r.duration_seconds,
      detections,
      objectCount: r.object_count,
    };
  });
}

export function getClipsDir(): string {
  return CLIPS_DIR;
}
