import { useCallback, useEffect, useRef, useState } from 'react';
import type { CustomObject, DetectionResult } from '@shared/types';
import { COCO_LABELS } from '@shared/constants';
import { cropFromVideo, embedImage } from '../lib/imageEmbedder';
import { api } from '../services';

interface TrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** If provided, pre-fills as a refinement of this COCO detection */
  detection?: DetectionResult | null;
  /** If provided, add examples to this existing object instead of creating new */
  existingObject?: CustomObject | null;
  onObjectSaved: () => void;
}

export function TrainingModal({
  isOpen,
  onClose,
  videoRef,
  detection,
  existingObject,
  onObjectSaved,
}: TrainingModalProps) {
  const [label, setLabel] = useState('');
  const [baseClass, setBaseClass] = useState<string | null>(null);
  const [mode, setMode] = useState<'coco' | 'new'>('new');
  const [embeddings, setEmbeddings] = useState<number[][]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For custom region selection
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectingRegion, setSelectingRegion] = useState(false);
  const [regionStart, setRegionStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [regionEnd, setRegionEnd] = useState<{ x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) return;
    setEmbeddings([]);
    setPreviews([]);
    setError(null);
    setSaving(false);
    if (existingObject) {
      setLabel(existingObject.label);
      setBaseClass(existingObject.baseClass);
      setMode(existingObject.baseClass ? 'coco' : 'new');
    } else if (detection) {
      setMode('coco');
      setBaseClass(detection.label);
      setLabel('');
    } else {
      setMode('new');
      setBaseClass(null);
      setLabel('');
    }
  }, [isOpen, detection, existingObject]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const captureFromDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !detection?.boundingBox) return;
    setCapturing(true);
    setError(null);
    try {
      const { x, y, width, height } = detection.boundingBox;
      const canvas = cropFromVideo(video, x, y, width, height);
      const embedding = await embedImage(canvas);
      setEmbeddings(prev => [...prev, embedding]);
      setPreviews(prev => [...prev, canvas.toDataURL('image/jpeg', 0.7)]);
    } catch (err) {
      setError('Failed to capture embedding. Try again.');
    } finally {
      setCapturing(false);
    }
  }, [videoRef, detection]);

  const captureFullFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setCapturing(true);
    setError(null);
    try {
      const canvas = cropFromVideo(
        video,
        0,
        0,
        video.videoWidth,
        video.videoHeight
      );
      const embedding = await embedImage(canvas);
      setEmbeddings(prev => [...prev, embedding]);
      setPreviews(prev => [...prev, canvas.toDataURL('image/jpeg', 0.7)]);
    } catch (err) {
      setError('Failed to capture embedding. Try again.');
    } finally {
      setCapturing(false);
    }
  }, [videoRef]);

  const captureRegion = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !regionStart || !regionEnd) return;
    setCapturing(true);
    setError(null);
    try {
      const scaleX = video.videoWidth / video.getBoundingClientRect().width;
      const scaleY = video.videoHeight / video.getBoundingClientRect().height;
      const x = Math.min(regionStart.x, regionEnd.x) * scaleX;
      const y = Math.min(regionStart.y, regionEnd.y) * scaleY;
      const w = Math.abs(regionEnd.x - regionStart.x) * scaleX;
      const h = Math.abs(regionEnd.y - regionStart.y) * scaleY;
      if (w < 10 || h < 10) {
        setError('Region too small. Draw a larger area.');
        setCapturing(false);
        return;
      }
      const canvas = cropFromVideo(video, x, y, w, h);
      const embedding = await embedImage(canvas);
      setEmbeddings(prev => [...prev, embedding]);
      setPreviews(prev => [...prev, canvas.toDataURL('image/jpeg', 0.7)]);
    } catch (err) {
      setError('Failed to capture embedding. Try again.');
    } finally {
      setCapturing(false);
      setSelectingRegion(false);
      setRegionStart(null);
      setRegionEnd(null);
    }
  }, [videoRef, regionStart, regionEnd]);

  const removeExample = (index: number) => {
    setEmbeddings(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (embeddings.length === 0) return;
    if (!existingObject && !label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (existingObject) {
        await api().addExamples(existingObject.id, embeddings, previews);
      } else {
        await api().saveCustomObject({
          label: label.trim(),
          baseClass: mode === 'coco' ? baseClass : null,
          embeddings,
          previews,
          matchThreshold: 0.4,
        });
      }
      onObjectSaved();
      onClose();
    } catch (err) {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-h-[90vh] overflow-y-auto rounded-t-2xl bg-zinc-900 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-700/50 bg-zinc-900 px-4 py-3 sm:px-6">
          <h2 className="text-lg font-semibold text-zinc-100">
            {existingObject
              ? `Add Examples to "${existingObject.label}"`
              : detection
                ? 'Teach Custom Label'
                : 'Teach New Object'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-m-2 rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 touch-manipulation"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Mode selector */}
          {!detection && !existingObject && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('coco');
                  setBaseClass(null);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === 'coco'
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                Relabel COCO Object
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('new');
                  setBaseClass(null);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === 'new'
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                New Object
              </button>
            </div>
          )}

          {/* Base class selector for COCO relabeling */}
          {mode === 'coco' && !detection && !existingObject && (
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Base COCO class
              </label>
              <select
                value={baseClass ?? ''}
                onChange={e => setBaseClass(e.target.value || null)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 focus:border-red-500 focus:outline-none"
              >
                <option value="">Select...</option>
                {COCO_LABELS.map(l => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                When a &quot;{baseClass || '...'}&quot; is detected, it will
                check if it matches your custom label
              </p>
            </div>
          )}

          {detection && !existingObject && (
            <p className="text-sm text-zinc-400">
              When a{' '}
              <span className="font-medium text-red-400">
                {detection.label}
              </span>{' '}
              is detected, check if it matches your custom label instead.
            </p>
          )}

          {existingObject && (
            <p className="text-sm text-zinc-400">
              Adding more examples to{' '}
              <span className="font-medium text-red-400">
                {existingObject.label}
              </span>{' '}
              ({existingObject.exampleCount} existing examples)
            </p>
          )}

          {/* Label input */}
          {!existingObject && (
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Custom label name
              </label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={
                  detection
                    ? `e.g., "Michael" instead of "${detection.label}"`
                    : 'e.g., "My coffee mug"'
                }
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 focus:border-red-500 focus:outline-none"
              />
            </div>
          )}

          {/* Capture instructions */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
            <p className="text-sm font-medium text-zinc-200 mb-2">
              Capture examples ({embeddings.length}/10)
            </p>
            <p className="text-xs text-zinc-500 mb-3">
              {mode === 'coco' || detection
                ? 'Point the camera at the object and capture from different angles. The bounding box from the detector will be used.'
                : 'Point the camera at the object. You can capture the full frame or draw a region around it.'}
            </p>

            <div className="flex gap-2 flex-wrap">
              {detection?.boundingBox && (
                <button
                  type="button"
                  onClick={captureFromDetection}
                  disabled={capturing || embeddings.length >= 10}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {capturing ? 'Capturing...' : 'Capture from Detection'}
                </button>
              )}
              {(mode === 'new' || existingObject || !detection) && (
                <>
                  <button
                    type="button"
                    onClick={captureFullFrame}
                    disabled={capturing || embeddings.length >= 10}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {capturing ? 'Capturing...' : 'Capture Full Frame'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectingRegion(true)}
                    disabled={
                      capturing || embeddings.length >= 10 || selectingRegion
                    }
                    className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
                  >
                    Draw Region
                  </button>
                </>
              )}
            </div>

            {selectingRegion && (
              <div className="mt-3 rounded-lg border border-red-500/50 bg-red-500/10 p-2">
                <p className="text-xs text-red-400 mb-2">
                  Click and drag on the camera feed to select a region, then
                  click &quot;Capture Region&quot;
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={captureRegion}
                    disabled={!regionStart || !regionEnd || capturing}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    Capture Region
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectingRegion(false);
                      setRegionStart(null);
                      setRegionEnd(null);
                    }}
                    className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative group">
                  <img
                    src={src}
                    alt={`Example ${i + 1}`}
                    className="h-16 w-16 rounded-md object-cover border border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => removeExample(i)}
                    className="absolute -right-1 -top-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !label.trim() || embeddings.length === 0}
            className="w-full rounded-lg bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : existingObject
                ? `Add ${embeddings.length} example${embeddings.length !== 1 ? 's' : ''} to "${existingObject.label}"`
                : `Save "${label || '...'}" (${embeddings.length} examples)`}
          </button>
          <p className="text-xs text-zinc-500 text-center">
            More examples from different angles = better recognition. 3-5
            minimum recommended.
          </p>
        </div>
      </div>
    </div>
  );
}
