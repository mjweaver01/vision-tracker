import { Database } from 'bun:sqlite';
import { join } from 'path';
import type { CustomObject } from '@shared/types';
import { logger } from '@shared/logger';
import { PROJECT_ROOT } from '@shared/root';

const DB_PATH = join(PROJECT_ROOT, 'recordings', 'recordings.sqlite');

let db: Database | null = null;

function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH, { create: true });
  }
  return db;
}

export function initCustomObjects(): void {
  const database = getDb();
  database.run(`
    CREATE TABLE IF NOT EXISTS custom_objects (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      base_class TEXT,
      embeddings TEXT NOT NULL,
      previews TEXT NOT NULL DEFAULT '[]',
      example_count INTEGER NOT NULL DEFAULT 0,
      match_threshold REAL NOT NULL DEFAULT 0.4,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  try {
    database.run(
      "ALTER TABLE custom_objects ADD COLUMN previews TEXT NOT NULL DEFAULT '[]'"
    );
  } catch {
    // column already exists
  }
}

export function getCustomObjects(): CustomObject[] {
  const database = getDb();
  const rows = database
    .query(
      'SELECT id, label, base_class, embeddings, previews, example_count, match_threshold, created_at FROM custom_objects ORDER BY label'
    )
    .all() as {
    id: string;
    label: string;
    base_class: string | null;
    embeddings: string;
    previews: string;
    example_count: number;
    match_threshold: number;
    created_at: string;
  }[];

  return rows.map(r => ({
    id: r.id,
    label: r.label,
    baseClass: r.base_class,
    embeddings: JSON.parse(r.embeddings) as number[][],
    previews: JSON.parse(r.previews ?? '[]') as string[],
    exampleCount: r.example_count,
    matchThreshold: r.match_threshold,
    createdAt: r.created_at,
  }));
}

export function saveCustomObject(obj: {
  label: string;
  baseClass: string | null;
  embeddings: number[][];
  previews: string[];
  matchThreshold?: number;
}): CustomObject {
  const database = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  database
    .prepare(
      'INSERT INTO custom_objects (id, label, base_class, embeddings, previews, example_count, match_threshold, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      id,
      obj.label,
      obj.baseClass,
      JSON.stringify(obj.embeddings),
      JSON.stringify(obj.previews),
      obj.embeddings.length,
      obj.matchThreshold ?? 0.4,
      now
    );

  logger(
    '[VisionTracker] Custom object saved:',
    obj.label,
    obj.embeddings.length,
    'examples'
  );

  return {
    id,
    label: obj.label,
    baseClass: obj.baseClass,
    embeddings: obj.embeddings,
    previews: obj.previews,
    exampleCount: obj.embeddings.length,
    matchThreshold: obj.matchThreshold ?? 0.4,
    createdAt: now,
  };
}

export function addExamplesToObject(
  id: string,
  newEmbeddings: number[][],
  newPreviews: string[] = []
): CustomObject | null {
  const database = getDb();
  const row = database
    .query('SELECT embeddings, previews FROM custom_objects WHERE id = ?')
    .get(id) as { embeddings: string; previews: string } | null;
  if (!row) return null;

  const existingEmb = JSON.parse(row.embeddings) as number[][];
  const existingPrev = JSON.parse(row.previews ?? '[]') as string[];
  const combinedEmb = [...existingEmb, ...newEmbeddings];
  const combinedPrev = [...existingPrev, ...newPreviews];

  database
    .prepare(
      'UPDATE custom_objects SET embeddings = ?, previews = ?, example_count = ? WHERE id = ?'
    )
    .run(JSON.stringify(combinedEmb), JSON.stringify(combinedPrev), combinedEmb.length, id);

  const objs = getCustomObjects();
  return objs.find(o => o.id === id) ?? null;
}

export function deleteCustomObject(id: string): boolean {
  const database = getDb();
  const result = database
    .prepare('DELETE FROM custom_objects WHERE id = ?')
    .run(id);
  return result.changes > 0;
}
