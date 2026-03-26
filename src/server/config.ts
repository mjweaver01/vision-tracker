import { join } from 'path';
import type { AppConfig } from '@shared/types';
import { DEFAULT_CONFIG } from '@shared/constants';
import { PROJECT_ROOT } from '@shared/root';

const CONFIG_FILE = join(PROJECT_ROOT, 'config.json');

type ConfigStore = Record<string, Partial<AppConfig>>;

function parseConfig(data: unknown): AppConfig {
  const d = data as Partial<AppConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...d,
    confidenceThreshold:
      typeof d?.confidenceThreshold === 'number'
        ? d.confidenceThreshold
        : DEFAULT_CONFIG.confidenceThreshold,
    objectTypes: Array.isArray(d?.objectTypes)
      ? d.objectTypes
      : DEFAULT_CONFIG.objectTypes,
    captureIntervalMs:
      typeof d?.captureIntervalMs === 'number'
        ? d.captureIntervalMs
        : DEFAULT_CONFIG.captureIntervalMs,
    detectionFps:
      typeof d?.detectionFps === 'number'
        ? d.detectionFps
        : DEFAULT_CONFIG.detectionFps,
    preBufferSeconds:
      typeof d?.preBufferSeconds === 'number'
        ? d.preBufferSeconds
        : DEFAULT_CONFIG.preBufferSeconds,
    postBufferSeconds:
      typeof d?.postBufferSeconds === 'number'
        ? d.postBufferSeconds
        : DEFAULT_CONFIG.postBufferSeconds,
    maxClipSeconds:
      typeof d?.maxClipSeconds === 'number'
        ? d.maxClipSeconds
        : DEFAULT_CONFIG.maxClipSeconds,
    notificationObjects: Array.isArray(d?.notificationObjects)
      ? d.notificationObjects
      : DEFAULT_CONFIG.notificationObjects,
    notificationsEnabled:
      typeof d?.notificationsEnabled === 'boolean'
        ? d.notificationsEnabled
        : DEFAULT_CONFIG.notificationsEnabled,
  };
}

const APP_CONFIG_KEYS = [
  'confidenceThreshold',
  'objectTypes',
  'captureIntervalMs',
  'detectionFps',
  'preBufferSeconds',
  'postBufferSeconds',
  'maxClipSeconds',
  'deviceId',
] as const;

function isLegacyConfig(data: unknown): data is Partial<AppConfig> {
  if (!data || typeof data !== 'object') return false;
  return APP_CONFIG_KEYS.some(k => k in (data as object));
}

let store: ConfigStore = {};

export async function loadConfig(): Promise<void> {
  try {
    const data = (await Bun.file(CONFIG_FILE).json()) as unknown;
    if (data && typeof data === 'object') {
      if (isLegacyConfig(data)) {
        store = { default: data };
      } else {
        store = data as ConfigStore;
      }
    }
  } catch {
    store = {};
  }
}

export function getConfig(browserId: string | null): AppConfig {
  const key = browserId || 'default';
  const data = store[key];
  if (!data) return { ...DEFAULT_CONFIG };
  return parseConfig(data);
}

export async function saveConfig(
  browserId: string | null,
  updates: Partial<AppConfig>
): Promise<AppConfig> {
  const key = browserId || 'default';
  const current = getConfig(browserId);
  const merged = parseConfig({ ...current, ...updates });
  store[key] = merged;
  await Bun.write(CONFIG_FILE, JSON.stringify(store, null, 2));
  return merged;
}
