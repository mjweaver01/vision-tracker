import { useEffect, useState } from 'react';
import type { AppConfig } from '@shared/types';
import { COCO_LABELS } from '@shared/constants';
import type { MediaDeviceInfo } from '../hooks/useVisionCapture';
import { ObjectTypeMultiselect } from './ObjectTypeMultiselect';

interface ConfigurationProps {
  config: AppConfig;
  onSave: (config: Partial<AppConfig>) => Promise<void>;
  devices: MediaDeviceInfo[];
  embedded?: boolean;
}

export function Configuration({
  config,
  onSave,
  devices,
  embedded,
}: ConfigurationProps) {
  const [confidenceThreshold, setConfidenceThreshold] = useState(
    config.confidenceThreshold
  );
  const [objectTypes, setObjectTypes] = useState<string[]>(config.objectTypes);
  const [detectionFps, setDetectionFps] = useState(config.detectionFps);
  const [preBufferSeconds, setPreBufferSeconds] = useState(
    config.preBufferSeconds
  );
  const [postBufferSeconds, setPostBufferSeconds] = useState(
    config.postBufferSeconds
  );
  const [maxClipSeconds, setMaxClipSeconds] = useState(config.maxClipSeconds);
  const [captureIntervalMs, setCaptureIntervalMs] = useState(
    config.captureIntervalMs
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    config.notificationsEnabled
  );
  const [notificationObjects, setNotificationObjects] = useState<string[]>(
    config.notificationObjects
  );
  const [notificationError, setNotificationError] = useState<string | null>(
    null
  );
  const [deviceId, setDeviceId] = useState(config.deviceId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfidenceThreshold(config.confidenceThreshold);
    setObjectTypes(config.objectTypes);
    setDetectionFps(config.detectionFps);
    setPreBufferSeconds(config.preBufferSeconds);
    setPostBufferSeconds(config.postBufferSeconds);
    setMaxClipSeconds(config.maxClipSeconds);
    setCaptureIntervalMs(config.captureIntervalMs);
    setDeviceId(config.deviceId ?? '');
    setNotificationsEnabled(config.notificationsEnabled);
    setNotificationObjects(config.notificationObjects);
    setNotificationError(null);
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        confidenceThreshold,
        objectTypes,
        detectionFps,
        preBufferSeconds,
        postBufferSeconds,
        maxClipSeconds,
        captureIntervalMs,
        deviceId: deviceId || undefined,
        notificationsEnabled,
        notificationObjects,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeviceChange = async (newDeviceId: string) => {
    setDeviceId(newDeviceId);
    await onSave({ deviceId: newDeviceId || undefined });
  };

  const toggleObjectType = (name: string) => {
    setObjectTypes(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const removeObjectType = (name: string) => {
    setObjectTypes(prev => prev.filter(s => s !== name));
  };

  const toggleNotificationObject = (name: string) => {
    setNotificationObjects(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const removeNotificationObject = (name: string) => {
    setNotificationObjects(prev => prev.filter(s => s !== name));
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    setNotificationError(null);
    if (enabled && typeof Notification !== 'undefined') {
      if (Notification.permission === 'denied') {
        setNotificationError(
          'Notifications were previously blocked. Enable them in your browser settings.'
        );
        return;
      }
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          setNotificationError(
            perm === 'denied'
              ? 'Notifications blocked. Enable them in browser settings to use this feature.'
              : 'Could not request notification permission.'
          );
          return;
        }
      }
    }
    if (enabled && typeof Notification === 'undefined') {
      setNotificationError('Notifications are not supported in this browser.');
      return;
    }
    setNotificationsEnabled(enabled);
  };

  const selectClass =
    'w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';

  return (
    <form
      onSubmit={handleSubmit}
      className={
        embedded ? '' : 'rounded-lg bg-zinc-900 p-6 ring-1 ring-zinc-700/50'
      }
    >
      {!embedded && (
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">
          Configuration
        </h2>
      )}
      <div className="space-y-4">
        {devices.length > 0 && (
          <div>
            <label
              htmlFor="camera"
              className="mb-1 block text-sm text-zinc-400"
            >
              Camera
            </label>
            <select
              id="camera"
              value={deviceId}
              onChange={e => handleDeviceChange(e.target.value)}
              className={selectClass}
            >
              <option value="">Default</option>
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              Select a different camera if the default fails or is wrong
            </p>
          </div>
        )}
        <div>
          <label
            htmlFor="confidence"
            className="mb-1 block text-sm text-zinc-400"
          >
            Confidence threshold ({Math.round(confidenceThreshold * 100)}%)
          </label>
          <input
            id="confidence"
            type="range"
            min={0.01}
            max={0.99}
            step={0.01}
            value={confidenceThreshold}
            onChange={e => setConfidenceThreshold(Number(e.target.value))}
            className="w-full"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Minimum confidence for object detection to trigger recording
          </p>
        </div>
        <ObjectTypeMultiselect
          options={COCO_LABELS}
          selected={objectTypes}
          onToggle={toggleObjectType}
          onRemove={removeObjectType}
          placeholder="Search object types..."
        />
        <div>
          <label htmlFor="fps" className="mb-1 block text-sm text-zinc-400">
            Detection FPS
          </label>
          <select
            id="fps"
            value={detectionFps}
            onChange={e => setDetectionFps(Number(e.target.value))}
            className={selectClass}
          >
            <option value={1}>1 FPS</option>
            <option value={5}>5 FPS</option>
            <option value={10}>10 FPS</option>
            <option value={15}>15 FPS</option>
            <option value={30}>30 FPS</option>
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            How many times per second to run object detection
          </p>
        </div>
        <div>
          <label
            htmlFor="preBuffer"
            className="mb-1 block text-sm text-zinc-400"
          >
            Pre-buffer (seconds)
          </label>
          <select
            id="preBuffer"
            value={preBufferSeconds}
            onChange={e => setPreBufferSeconds(Number(e.target.value))}
            className={selectClass}
          >
            <option value={0.5}>0.5 seconds</option>
            <option value={1}>1 second</option>
            <option value={2}>2 seconds</option>
            <option value={3}>3 seconds</option>
            <option value={5}>5 seconds</option>
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Video captured before the detection trigger so you see what led up
            to the event
          </p>
        </div>
        <div>
          <label
            htmlFor="postBuffer"
            className="mb-1 block text-sm text-zinc-400"
          >
            Post-buffer (seconds)
          </label>
          <select
            id="postBuffer"
            value={postBufferSeconds}
            onChange={e => setPostBufferSeconds(Number(e.target.value))}
            className={selectClass}
          >
            <option value={0.5}>0.5 seconds</option>
            <option value={1}>1 second</option>
            <option value={2}>2 seconds</option>
            <option value={3}>3 seconds</option>
            <option value={5}>5 seconds</option>
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Recording stops after objects disappear for this long
          </p>
        </div>
        <div>
          <label htmlFor="maxClip" className="mb-1 block text-sm text-zinc-400">
            Max clip duration
          </label>
          <select
            id="maxClip"
            value={maxClipSeconds}
            onChange={e => setMaxClipSeconds(Number(e.target.value))}
            className={selectClass}
          >
            <option value={10}>10 seconds</option>
            <option value={15}>15 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Safety cap to prevent very long recordings
          </p>
        </div>
        <div>
          <label
            htmlFor="cooldown"
            className="mb-1 block text-sm text-zinc-400"
          >
            Cooldown between clips
          </label>
          <select
            id="cooldown"
            value={captureIntervalMs}
            onChange={e => setCaptureIntervalMs(Number(e.target.value))}
            className={selectClass}
          >
            <option value={1000}>1 second</option>
            <option value={2000}>2 seconds</option>
            <option value={5000}>5 seconds</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
            <option value={60000}>1 minute</option>
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Minimum wait time after a clip finishes before starting a new one
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-2">
          <button
            type="button"
            onClick={() => handleNotificationsToggle(!notificationsEnabled)}
            className="flex w-full cursor-pointer items-center justify-between rounded-md py-1 px-2 text-left transition-colors hover:bg-zinc-700/50"
          >
            <span className="text-sm font-medium text-zinc-100">
              Push notifications
            </span>
            <span
              className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                notificationsEnabled ? 'bg-red-600' : 'bg-zinc-600'
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  notificationsEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
          {notificationError && (
            <p className="text-xs text-amber-400">{notificationError}</p>
          )}
          {notificationsEnabled && (
            <>
              <p className="text-xs text-zinc-500">
                Get a browser notification when these objects are detected
              </p>
              <ObjectTypeMultiselect
                options={COCO_LABELS}
                selected={notificationObjects}
                onToggle={toggleNotificationObject}
                onRemove={removeNotificationObject}
                placeholder="Search objects to notify on..."
              />
            </>
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
