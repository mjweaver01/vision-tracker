import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipMetadata } from '@shared/types';
import { api } from '../services';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

interface ClipsListProps {
  refreshTrigger?: number;
  clips?: ClipMetadata[];
  showCount?: boolean;
  compact?: boolean;
}

export function ClipsList({
  refreshTrigger = 0,
  clips: clipsProp,
  showCount = false,
  compact = false,
}: ClipsListProps) {
  const [localClips, setLocalClips] = useState<ClipMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [clipUrls, setClipUrls] = useState<Record<string, string>>({});
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  const clips = clipsProp !== undefined ? clipsProp : localClips;

  const { visibleCount, sentinelRef, hasMore } = useInfiniteScroll({
    totalCount: clips.length,
  });

  const fetchClips = useCallback(async () => {
    api()
      .getClips()
      .then((data: ClipMetadata[]) => {
        setLocalClips(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (clipsProp !== undefined) {
      setLoading(false);
      return;
    }
    fetchClips();
  }, [refreshTrigger, fetchClips, clipsProp]);

  useEffect(() => {
    if (clipsProp !== undefined) return;
    const interval = setInterval(fetchClips, 5000);
    return () => clearInterval(interval);
  }, [fetchClips, clipsProp]);

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const handlePlay = async (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    if (!clipUrls[id]) {
      try {
        const url = await api().getClipUrl(id);
        setClipUrls(prev => ({ ...prev, [id]: url }));
      } catch {
        // ignore
      }
    }
  };

  const handleDownload = async (c: ClipMetadata) => {
    const url = await api().getClipUrl(c.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = c.filename;
    a.click();
  };

  const title = showCount && !loading ? `Clips (${clips.length})` : 'Clips';

  if (loading) {
    return (
      <div className={compact ? 'px-2' : 'rounded-lg bg-zinc-900 p-6'}>
        <h2
          className={`font-semibold text-zinc-100 ${compact ? 'mb-3 text-sm' : 'mb-4 text-lg'}`}
        >
          {title}
        </h2>
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    );
  }

  const visibleClips = clips.slice(0, visibleCount);

  return (
    <div
      className={
        compact ? 'px-2' : 'rounded-lg bg-zinc-900 p-6 ring-1 ring-zinc-700/50'
      }
    >
      <h2
        className={`font-semibold text-zinc-100 ${compact ? 'mb-3 text-sm' : 'mb-4 text-lg'}`}
      >
        {title}
      </h2>
      {clips.length === 0 ? (
        <p className="text-zinc-500 text-sm">
          No clips yet. When objects are detected, video clips will appear here.
        </p>
      ) : (
        <div
          className={`space-y-2 overflow-y-auto ${compact ? 'max-h-none' : 'max-h-[400px]'}`}
        >
          {visibleClips.map(c => (
            <div
              key={c.id}
              className="rounded-lg border border-zinc-700 bg-zinc-800 overflow-hidden"
            >
              <div
                className={`flex items-center justify-between px-3 ${compact ? 'py-2.5' : 'py-2'}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-100">
                    {formatDate(c.timestamp)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {c.durationSeconds.toFixed(1)}s · {c.objectCount} object
                    {c.objectCount !== 1 ? 's' : ''}
                    {c.detections.length > 0 && (
                      <>
                        {' · '}
                        <span className="text-red-400/90">
                          {c.detections[0].label}
                          {c.detections.length > 1 &&
                            ` +${c.detections.length - 1}`}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div
                  className={`ml-2 flex shrink-0 items-center gap-1.5 ${compact ? 'gap-2' : 'sm:gap-2'}`}
                >
                  <button
                    type="button"
                    onClick={() => handlePlay(c.id)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium touch-manipulation flex items-center justify-center ${
                      compact
                        ? 'min-h-[44px] min-w-[44px]'
                        : 'sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-1'
                    } ${
                      playingId === c.id
                        ? 'bg-red-600 text-white'
                        : 'text-red-400 hover:bg-red-500/20 active:bg-red-500/30'
                    }`}
                  >
                    {playingId === c.id ? 'Hide' : 'Play'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(c)}
                    className={`rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 active:bg-zinc-600 touch-manipulation flex items-center justify-center ${
                      compact ? 'min-h-[44px]' : 'sm:min-h-0 sm:px-2 sm:py-1'
                    }`}
                  >
                    Download
                  </button>
                </div>
              </div>
              {playingId === c.id && clipUrls[c.id] && (
                <div className="border-t border-zinc-700 p-2">
                  <video
                    ref={videoPlayerRef}
                    src={clipUrls[c.id]}
                    controls
                    autoPlay
                    className="w-full rounded-md"
                    onEnded={() => setPlayingId(null)}
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
