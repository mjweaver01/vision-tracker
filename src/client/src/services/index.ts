import type { ApiService } from './api';

let service: ApiService | null = null;

function isNativePlatform(): boolean {
  try {
    // Capacitor injects this on native platforms
    return (
      (
        window as unknown as {
          Capacitor?: { isNativePlatform?: () => boolean };
        }
      ).Capacitor?.isNativePlatform?.() ?? false
    );
  } catch {
    return false;
  }
}

export async function getApi(): Promise<ApiService> {
  if (service) return service;

  if (isNativePlatform()) {
    const { LocalApiService } = await import('./localApi');
    service = new LocalApiService();
  } else {
    const { RemoteApiService } = await import('./remoteApi');
    service = new RemoteApiService();
  }
  return service;
}

// Eagerly initialize so callers can use the sync getter after first await
let initPromise: Promise<void> | null = null;

export function initApi(): Promise<void> {
  if (!initPromise) {
    initPromise = getApi().then(() => {});
  }
  return initPromise;
}

/** Only use after initApi() has resolved */
export function api(): ApiService {
  if (!service) throw new Error('API not initialized. Call initApi() first.');
  return service;
}
