import { Database } from 'bun:sqlite';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { SnapshotMetadata, DetectionResult } from '@shared/types';
import { logger } from '@shared/logger';
import { PROJECT_ROOT } from '@shared/root';

const SNAPSHOTS_DIR = join(PROJECT_ROOT, 'recordings');
const DB_PATH = join(SNAPSHOTS_DIR, 'recordings.sqlite');

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
  await mkdir(SNAPSHOTS_DIR, { recursive: true });
  db = new Database(DB_PATH, { create: true });
  db.run(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      detections TEXT NOT NULL,
      object_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

export async function saveSnapshot(
  file: File | Blob,
  detections: DetectionResult[]
): Promise<SnapshotMetadata> {
  const database = getDb();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}.jpg`;
  const id = timestamp;
  const filepath = join(SNAPSHOTS_DIR, filename);

  await Bun.write(filepath, file);

  const detectionsJson = JSON.stringify(detections);

  const insert = database.prepare(
    'INSERT INTO snapshots (id, filename, timestamp, detections, object_count) VALUES (?, ?, ?, ?, ?)'
  );
  insert.run(id, filename, new Date().toISOString(), detectionsJson, detections.length);
  logger('[VisionTracker] Snapshot saved:', id, detections.length, 'objects');

  return {
    id,
    filename,
    timestamp: new Date().toISOString(),
    detections,
    objectCount: detections.length,
  };
}

export async function getSnapshots(): Promise<SnapshotMetadata[]> {
  const database = getDb();

  const rows = database
    .query(
      'SELECT id, filename, timestamp, detections, object_count FROM snapshots ORDER BY timestamp DESC'
    )
    .all() as {
    id: string;
    filename: string;
    timestamp: string;
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
      detections,
      objectCount: r.object_count,
    };
  });
}

export function getSnapshotsDir(): string {
  return SNAPSHOTS_DIR;
}
