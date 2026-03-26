import { useMonitoringStatus } from '../context/MonitoringStatusContext';
import { useRecordingsVersion } from '../lib/recordingsVersion';
import { useIsMobile } from '../hooks/useIsMobile';
import { CameraFeed } from '../components/CameraFeed';
import { SnapshotsList } from '../components/SnapshotsList';

export function MonitorPage() {
  const {
    setCameraEnabled,
    cameraEnabled,
    detections,
    isCapturing,
    error,
    stream,
    lastDetection,
    videoRef,
  } = useMonitoringStatus();
  const recordingsVersion = useRecordingsVersion();
  const isMobile = useIsMobile();

  if (!cameraEnabled) {
    return (
      <div className="rounded-lg bg-zinc-900 p-6 ring-1 ring-zinc-700/50 text-center">
        <p className="mb-4 text-zinc-400">
          Click &quot;Start monitoring&quot; to begin. You&apos;ll be asked to
          allow camera access.
        </p>
        <button
          onClick={() => setCameraEnabled(true)}
          className="rounded-xl bg-red-600 px-6 py-4 font-medium text-white hover:bg-red-500 active:bg-red-500 touch-manipulation min-h-[48px] w-full sm:w-auto sm:min-h-0 sm:px-4 sm:py-2"
        >
          Start monitoring
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-zinc-900 p-6 ring-1 ring-zinc-700/50">
        <p className="text-red-400">{error}</p>
        <p className="mt-2 text-sm text-zinc-500">
          Grant camera access in your browser and reload.
        </p>
      </div>
    );
  }

  return (
    <>
      <CameraFeed
        videoRef={videoRef}
        stream={stream}
        detections={detections}
        isCapturing={isCapturing}
      />
      {detections.length > 0 && (
        <div className="rounded-lg bg-zinc-900/80 px-4 py-2 ring-1 ring-zinc-700/50 text-sm text-zinc-400">
          Detected:{' '}
          <span className="font-medium text-red-400">
            {detections.map(d => d.label).join(', ')}
          </span>
        </div>
      )}
      {lastDetection && detections.length === 0 && (
        <div className="rounded-lg bg-zinc-900/80 px-4 py-2 ring-1 ring-zinc-700/50 text-sm text-zinc-400">
          Last detected:{' '}
          <span className="font-medium text-red-400">{lastDetection}</span>
        </div>
      )}
      {!isMobile && (
        <SnapshotsList refreshTrigger={recordingsVersion} />
      )}
    </>
  );
}
