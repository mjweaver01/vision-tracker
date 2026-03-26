import { useEffect, useRef, useState } from 'react';

interface ObjectTypeMultiselectProps {
  options: string[];
  selected: string[];
  onToggle: (name: string) => void;
  onRemove: (name: string) => void;
  placeholder?: string;
}

export function ObjectTypeMultiselect({
  options,
  selected,
  onToggle,
  onRemove,
  placeholder = 'Search object types...',
}: ObjectTypeMultiselectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref}>
      <label className="mb-1 block text-sm text-zinc-400">
        Object types
        {selected.length > 0 && (
          <span className="ml-1 text-xs text-zinc-500">
            ({selected.length} selected)
          </span>
        )}
      </label>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selected.map(s => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs text-emerald-400"
            >
              {s}
              <button
                type="button"
                onClick={() => onRemove(s)}
                className="ml-0.5 text-emerald-400/60 hover:text-emerald-400"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-700 bg-zinc-800 shadow-lg">
            {filtered.map(o => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onToggle(o);
                  setQuery('');
                }}
                className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-700 ${
                  selected.includes(o)
                    ? 'text-emerald-400'
                    : 'text-zinc-300'
                }`}
              >
                {selected.includes(o) ? '✓ ' : ''}{o}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Leave empty to detect all objects, or select specific types to track
      </p>
    </div>
  );
}
