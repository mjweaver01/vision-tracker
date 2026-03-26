import { useCallback, useEffect, useState } from 'react';
import type { CustomObject } from '@shared/types';
import { api } from '../services';

interface CustomObjectsListProps {
  refreshTrigger: number;
  onObjectsChange?: (objects: CustomObject[]) => void;
  onTrain?: (obj: CustomObject) => void;
}

export function CustomObjectsList({
  refreshTrigger,
  onObjectsChange,
  onTrain,
}: CustomObjectsListProps) {
  const [objects, setObjects] = useState<CustomObject[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    const data = await api().getCustomObjects();
    setObjects(data);
    onObjectsChange?.(data);
  }, [onObjectsChange]);

  useEffect(() => {
    fetch();
  }, [fetch, refreshTrigger]);

  const handleDelete = async (id: string) => {
    await api().deleteCustomObject(id);
    fetch();
  };

  if (objects.length === 0) return null;

  return (
    <div className="rounded-lg bg-zinc-900 p-4 ring-1 ring-zinc-700/50">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">
        Custom Objects
      </h3>
      <div className="space-y-2">
        {objects.map(obj => (
          <div
            key={obj.id}
            className="rounded-lg border border-zinc-700 bg-zinc-800 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === obj.id ? null : obj.id)}
                className="min-w-0 text-left"
              >
                <p className="text-sm font-medium text-zinc-100">{obj.label}</p>
                <p className="text-xs text-zinc-500">
                  {obj.baseClass ? `Refines "${obj.baseClass}"` : 'New object'} ·{' '}
                  {obj.exampleCount} examples
                </p>
              </button>
              <div className="ml-2 flex shrink-0 items-center gap-1.5">
                {onTrain && (
                  <button
                    type="button"
                    onClick={() => onTrain(obj)}
                    className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
                  >
                    + Examples
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(obj.id)}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
            {expandedId === obj.id && obj.previews && obj.previews.length > 0 && (
              <div className="border-t border-zinc-700 px-3 py-2">
                <p className="mb-2 text-xs text-zinc-500">Training examples:</p>
                <div className="flex flex-wrap gap-1.5">
                  {obj.previews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Example ${i + 1}`}
                      className="h-14 w-14 rounded-md object-cover border border-zinc-700"
                    />
                  ))}
                </div>
              </div>
            )}
            {expandedId === obj.id && (!obj.previews || obj.previews.length === 0) && (
              <div className="border-t border-zinc-700 px-3 py-2">
                <p className="text-xs text-zinc-500">No preview images saved for this object.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
