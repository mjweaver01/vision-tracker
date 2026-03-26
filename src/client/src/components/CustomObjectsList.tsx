import { useCallback, useEffect, useState } from 'react';
import type { CustomObject } from '@shared/types';
import { api } from '../services';

interface CustomObjectsListProps {
  refreshTrigger: number;
  onObjectsChange?: (objects: CustomObject[]) => void;
}

export function CustomObjectsList({ refreshTrigger, onObjectsChange }: CustomObjectsListProps) {
  const [objects, setObjects] = useState<CustomObject[]>([]);

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
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">Custom Objects</h3>
      <div className="space-y-2">
        {objects.map(obj => (
          <div
            key={obj.id}
            className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-100">{obj.label}</p>
              <p className="text-xs text-zinc-500">
                {obj.baseClass ? `Refines "${obj.baseClass}"` : 'New object'} · {obj.exampleCount} examples
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(obj.id)}
              className="ml-2 shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-red-400"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
