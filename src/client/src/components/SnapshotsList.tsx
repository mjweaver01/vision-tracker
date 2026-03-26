import { useCallback, useEffect, useState } from 'react';
import type { SnapshotMetadata } from '@shared/types';
import { api } from '../services';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

interface SnapshotsListProps {
  refreshTrigger?: number;
  snapshots?: SnapshotMetadata[];
  showCount?: boolean;
  compact?: boolean;
}

export function SnapshotsList({
  refreshTrigger = 0,
  snapshots: snapshotsProp,
  showCount = false,
  compact = false,
}: SnapshotsListProps) {
  const [localSnapshots, setLocalSnapshots] = useState<SnapshotMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const snapshots = snapshotsProp !== undefined ? snapshotsProp : localSnapshots;

  const { visibleCount, sentinelRef, hasMore } = useInfiniteScroll({
    totalCount: snapshots.length,
  });

  const fetchSnapshots = useCallback(async () => {
    api().getSnapshots()
      .then((data: SnapshotMetadata[]) => {
        setLocalSnapshots(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (snapshotsProp !== undefined) {
      setLoading(false);
      return;
    }
    fetchSnapshots();
  }, [refreshTrigger, fetchSnapshots, snapshotsProp]);

  useEffect(() => {
    if (snapshotsProp !== undefined) return;
    const interval = setInterval(fetchSnapshots, 5000);
    return () => clearInterval(interval);
  }, [fetchSnapshots, snapshotsProp]);

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!imageUrls[id]) {
      try {
        const url = await api().getSnapshotImageUrl(id);
        setImageUrls(prev => ({ ...prev, [id]: url }));
      } catch {
        // ignore
      }
    }
  };

  const handleDownload = async (s: SnapshotMetadata) => {
    const url = await api().getSnapshotImageUrl(s.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = s.filename;
    a.click();
  };

  const title =
    showCount && !loading ? `Snapshots (${snapshots.length})` : 'Snapshots';

  if (loading) {
    return (
      <div className={compact ? 'px-2' : 'rounded-lg bg-zinc-900 p-6'}>
        <h2 className={`font-semibold text-zinc-100 ${compact ? 'mb-3 text-sm' : 'mb-4 text-lg'}`}>{title}</h2>
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    );
  }

  const visibleSnapshots = snapshots.slice(0, visibleCount);

  return (
    <div className={compact ? 'px-2' : 'rounded-lg bg-zinc-900 p-6 ring-1 ring-zinc-700/50'}>
      <h2 className={`font-semibold text-zinc-100 ${compact ? 'mb-3 text-sm' : 'mb-4 text-lg'}`}>{title}</h2>
      {snapshots.length === 0 ? (
        <p className="text-zinc-500 text-sm">
          No snapshots yet. When objects are detected, snapshots will appear here.
        </p>
      ) : (
        <div className={`space-y-2 overflow-y-auto ${compact ? 'max-h-none' : 'max-h-[400px]'}`}>
          {visibleSnapshots.map(s => (
            <div key={s.id} className="rounded-lg border border-zinc-700 bg-zinc-800 overflow-hidden">
              <div
                className={`flex items-center justify-between px-3 ${compact ? 'py-2.5' : 'py-2'}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-100">
                    {formatDate(s.timestamp)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {s.objectCount} object{s.objectCount !== 1 ? 's' : ''}
                    {s.detections.length > 0 && (
                      <>
                        {' · '}
                        <span className="text-red-400/90">
                          {s.detections[0].label}
                          {s.detections.length > 1 &&
                            ` +${s.detections.length - 1}`}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className={`ml-2 flex shrink-0 items-center gap-1.5 ${compact ? 'gap-2' : 'sm:gap-2'}`}>
                  <button
                    type="button"
                    onClick={() => handleExpand(s.id)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium touch-manipulation flex items-center justify-center ${
                      compact ? 'min-h-[44px] min-w-[44px]' : 'sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-1'
                    } ${
                      expandedId === s.id
                        ? 'bg-red-600 text-white'
                        : 'text-red-400 hover:bg-red-500/20 active:bg-red-500/30'
                    }`}
                  >
                    {expandedId === s.id ? 'Hide' : 'View'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(s)}
                    className={`rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 active:bg-zinc-600 touch-manipulation flex items-center justify-center ${
                      compact ? 'min-h-[44px]' : 'sm:min-h-0 sm:px-2 sm:py-1'
                    }`}
                  >
                    Download
                  </button>
                </div>
              </div>
              {expandedId === s.id && imageUrls[s.id] && (
                <div className="border-t border-zinc-700 p-2">
                  <img
                    src={imageUrls[s.id]}
                    alt={`Snapshot ${s.id}`}
                    className="w-full rounded-md"
                  />
                </div>
              )}
            </div>
          ))}
          {hasMore && (
            <div
              ref={sentinelRef}
              className="py-2 text-center text-xs text-zinc-500"
            >
              Scroll for more...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
