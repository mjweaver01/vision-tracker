import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AppConfig, CustomObject, DetectionResult } from '@shared/types';
import { DEFAULT_CONFIG } from '@shared/constants';
import { api } from '../services';
import {
  useVisionCapture,
  type MediaDeviceInfo,
} from '../hooks/useVisionCapture';
import { incrementRecordingsVersion } from '../lib/recordingsVersion';

const CAMERA_ENABLED_KEY = 'vision-tracker:cameraEnabled';

function getStoredCameraEnabled(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(CAMERA_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function setStoredCameraEnabled(v: boolean) {
  try {
    if (v) sessionStorage.setItem(CAMERA_ENABLED_KEY, '1');
    else sessionStorage.removeItem(CAMERA_ENABLED_KEY);
  } catch {
    // ignore
  }
}

interface MonitoringStatus {
  connected: boolean;
  isRecording: boolean;
  error: string | null;
}

const defaultStatus: MonitoringStatus = {
  connected: false,
  isRecording: false,
  error: null,
};

interface MonitoringContextValue {
  status: MonitoringStatus;
  setStatus: (s: MonitoringStatus) => void;
  cameraEnabled: boolean;
  setCameraEnabled: (v: boolean) => void;
  detections: DetectionResult[];
  isRecording: boolean;
  error: string | null;
  stream: MediaStream | null;
  lastDetection: string | null;
  devices: MediaDeviceInfo[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
  handleSaveConfig: (updates: Partial<AppConfig>) => Promise<void>;
  customObjects: CustomObject[];
  refreshCustomObjects: () => void;
}

const MonitoringStatusContext = createContext<MonitoringContextValue | null>(
  null
);

export function MonitoringStatusProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [status, setStatus] = useState<MonitoringStatus>(defaultStatus);
  const [cameraEnabled, setCameraEnabledState] = useState(
    getStoredCameraEnabled
  );
  const [config, setConfig] = useState<AppConfig>(() => ({
    ...DEFAULT_CONFIG,
  }));
  const [customObjects, setCustomObjects] = useState<CustomObject[]>([]);
  const [customObjectsVersion, setCustomObjectsVersion] = useState(0);

  const refreshCustomObjects = useCallback(() => {
    setCustomObjectsVersion(v => v + 1);
  }, []);

  useEffect(() => {
    api()
      .getCustomObjects()
      .then(setCustomObjects)
      .catch(() => {});
  }, [customObjectsVersion]);

  const setCameraEnabled = useCallback((v: boolean) => {
    setCameraEnabledState(v);
    setStoredCameraEnabled(v);
  }, []);

  const {
    detections,
    isRecording,
    error,
    stream,
    lastDetection,
    devices,
    videoRef,
  } = useVisionCapture({
    confidenceThreshold: config.confidenceThreshold,
    enabled: cameraEnabled,
    onClipUploaded: incrementRecordingsVersion,
    objectTypes: config.objectTypes ?? [],
    detectionFps: config.detectionFps ?? 10,
    captureIntervalMs: config.captureIntervalMs ?? 5000,
    preBufferSeconds: config.preBufferSeconds ?? 2,
    postBufferSeconds: config.postBufferSeconds ?? 2,
    maxClipSeconds: config.maxClipSeconds ?? 30,
    deviceId: config.deviceId || undefined,
    notificationObjects: config.notificationObjects ?? [],
    notificationsEnabled: config.notificationsEnabled ?? false,
    customObjects,
  });

  useEffect(() => {
    setStatus({
      connected: cameraEnabled && !error,
      isRecording,
      error: error ?? null,
    });
  }, [cameraEnabled, isRecording, error, setStatus]);

  useEffect(() => {
    api()
      .getConfig()
      .then(setConfig)
      .catch(() => {});
  }, []);

  const restartMonitoring = useCallback(() => {
    setCameraEnabledState(false);
    setTimeout(() => setCameraEnabledState(true), 100);
  }, []);

  const handleSaveConfig = useCallback(
    async (updates: Partial<AppConfig>) => {
      const data = await api().saveConfig(updates);
      setConfig(data);
      if (updates.deviceId !== undefined && cameraEnabled) restartMonitoring();
    },
    [cameraEnabled, restartMonitoring]
  );

  const value: MonitoringContextValue = {
    status,
    setStatus,
    cameraEnabled,
    setCameraEnabled,
    detections,
    isRecording,
    error,
    stream,
    lastDetection,
    devices,
    videoRef,
    config,
    setConfig,
    handleSaveConfig,
    customObjects,
    refreshCustomObjects,
  };

  return (
    <MonitoringStatusContext.Provider value={value}>
      {children}
    </MonitoringStatusContext.Provider>
  );
}

export function useMonitoringStatus() {
  const ctx = useContext(MonitoringStatusContext);
  if (!ctx) {
    throw new Error(
      'useMonitoringStatus must be used within MonitoringStatusProvider'
    );
  }
  return ctx;
}
