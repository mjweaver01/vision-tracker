import { useState } from 'react';
import { useMonitoringStatus } from '../context/MonitoringStatusContext';
import { useRecordingsVersion } from '../lib/recordingsVersion';
import { useIsMobile } from '../hooks/useIsMobile';
import { CameraFeed } from '../components/CameraFeed';
import { ClipsList } from '../components/SnapshotsList';
import { TrainingModal } from '../components/TrainingModal';
import { CustomObjectsList } from '../components/CustomObjectsList';
import type { CustomObject, DetectionResult } from '@shared/types';

export function MonitorPage() {
  const {
    setCameraEnabled,
    cameraEnabled,
    detections,
    isRecording,
    error,
    stream,
    lastDetection,
    videoRef,
    customObjects,
    refreshCustomObjects,
  } = useMonitoringStatus();
  const recordingsVersion = useRecordingsVersion();
  const isMobile = useIsMobile();

  const [trainingOpen, setTrainingOpen] = useState(false);
  const [trainingDetection, setTrainingDetection] = useState<DetectionResult | null>(null);
  const [trainingExisting, setTrainingExisting] = useState<CustomObject | null>(null);
  const [customObjectsVersion, setCustomObjectsVersion] = useState(0);

  const handleTrainDetection = (det: DetectionResult) => {
    setTrainingDetection(det);
    setTrainingExisting(null);
    setTrainingOpen(true);
  };

  const handleTrainNew = () => {
    setTrainingDetection(null);
    setTrainingExisting(null);
    setTrainingOpen(true);
  };

  const handleTrainExisting = (obj: CustomObject) => {
    setTrainingDetection(null);
    setTrainingExisting(obj);
    setTrainingOpen(true);
  };

  const handleObjectSaved = () => {
    refreshCustomObjects();
    setCustomObjectsVersion(v => v + 1);
  };

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
        isRecording={isRecording}
      />

      {/* Detection info + training buttons */}
      {detections.length > 0 && (
        <div className="rounded-lg bg-zinc-900/80 px-4 py-2 ring-1 ring-zinc-700/50 text-sm text-zinc-400">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              Detected:{' '}
              {detections.map((d, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  <button
                    type="button"
                    onClick={() => handleTrainDetection(d)}
                    className="font-medium text-red-400 underline decoration-red-400/30 hover:decoration-red-400"
                    title={`Teach custom label for "${d.label}"`}
                  >
                    {d.label}
                  </button>
                </span>
              ))}
              {isRecording && (
                <span className="ml-2 inline-flex items-center gap-1 text-red-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  Recording
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleTrainNew}
              className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            >
              + Teach New Object
            </button>
          </div>
        </div>
      )}
      {lastDetection && detections.length === 0 && (
        <div className="rounded-lg bg-zinc-900/80 px-4 py-2 ring-1 ring-zinc-700/50 text-sm text-zinc-400 flex items-center justify-between">
          <span>
            Last detected:{' '}
            <span className="font-medium text-red-400">{lastDetection}</span>
          </span>
          <button
            type="button"
            onClick={handleTrainNew}
            className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            + Teach New Object
          </button>
        </div>
      )}
      {detections.length === 0 && !lastDetection && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleTrainNew}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            + Teach New Object
          </button>
        </div>
      )}

      {!isMobile && (
        <>
          <CustomObjectsList
            refreshTrigger={customObjectsVersion}
            onObjectsChange={() => refreshCustomObjects()}
            onTrain={handleTrainExisting}
          />
          <ClipsList refreshTrigger={recordingsVersion} />
        </>
      )}

      <TrainingModal
        isOpen={trainingOpen}
        onClose={() => setTrainingOpen(false)}
        videoRef={videoRef}
        detection={trainingDetection}
        existingObject={trainingExisting}
        onObjectSaved={handleObjectSaved}
      />
    </>
  );
}
