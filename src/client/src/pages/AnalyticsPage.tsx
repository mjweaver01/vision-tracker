import {
  useCallback,
  useEffect,
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SnapshotMetadata } from '@shared/types';
import { api } from '../services';
import { useRecordingsVersion } from '../lib/recordingsVersion';
import { SnapshotsList } from '../components/SnapshotsList';
import { useAnalyticsFilters } from '../hooks/useAnalyticsFilters';
import type {
  ChartView,
  TimeGrouping,
} from '../hooks/useAnalyticsFilters';

const MAX_CHART_POINTS = 300;

const COLORS = [
  '#ef4444',
  '#f87171',
  '#fca5a5',
  '#fecaca',
  '#fb923c',
  '#f97316',
  '#dc2626',
];

function formatBucketLabel(key: string, grouping: TimeGrouping): string {
  const d = new Date(key);
  if (grouping === 'minute') {
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (grouping === 'hour') {
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
    });
  }
  if (grouping === 'day') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

function getBucketKey(timestamp: string, grouping: TimeGrouping): string {
  const d = new Date(timestamp);
  if (grouping === 'minute') {
    d.setSeconds(0, 0);
    return d.toISOString();
  }
  if (grouping === 'hour') {
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  }
  if (grouping === 'day') {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

interface ChartDataPoint {
  bucket: string;
  label: string;
  count: number;
  detections: Record<string, number>;
}

export function AnalyticsPage() {
  const recordingsVersion = useRecordingsVersion();
  const {
    dateRange,
    setDateRange,
    grouping,
    setGrouping,
    classificationFilter,
    setClassificationFilter,
    chartView,
    setChartView,
    chartType,
    setChartType,
    stacked,
    setStacked,
    visibleClassifications,
    setVisibleClassifications,
    toggleVisibleClassification,
  } = useAnalyticsFilters();

  const [snapshots, setSnapshots] = useState<SnapshotMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const deferredSnapshots = useDeferredValue(snapshots);

  const fetchSnapshots = useCallback(async () => {
    try {
      const data = await api().getSnapshots();
      startTransition(() => {
        setSnapshots(data);
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots, recordingsVersion]);

  const filteredSnapshots = useMemo(() => {
    let list = deferredSnapshots.filter(r => r.detections.length > 0);

    const now = Date.now();
    const ms = {
      '7': 7 * 24 * 60 * 60 * 1000,
      '30': 30 * 24 * 60 * 60 * 1000,
      '90': 90 * 24 * 60 * 60 * 1000,
    };
    if (dateRange !== 'all') {
      const cutoff = now - ms[dateRange];
      list = list.filter(r => new Date(r.timestamp).getTime() >= cutoff);
    }

    if (classificationFilter !== 'all') {
      list = list.filter(r =>
        r.detections.some(c => c.label === classificationFilter)
      );
    }

    return list;
  }, [deferredSnapshots, dateRange, classificationFilter]);

  const listSnapshots = useMemo(() => {
    if (
      visibleClassifications.size > 0 &&
      classificationFilter === 'all'
    ) {
      return filteredSnapshots.filter(r =>
        r.detections.some(c => visibleClassifications.has(c.label))
      );
    }
    return filteredSnapshots;
  }, [filteredSnapshots, visibleClassifications, classificationFilter]);

  const sortedFilteredSnapshots = useMemo(
    () =>
      [...listSnapshots].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [listSnapshots]
  );

  const chartData = useMemo(() => {
    const buckets = new Map<
      string,
      { count: number; detections: Record<string, number> }
    >();

    for (const r of filteredSnapshots) {
      const key = getBucketKey(r.timestamp, grouping);
      if (!buckets.has(key)) {
        buckets.set(key, { count: 0, detections: {} });
      }
      const b = buckets.get(key)!;
      b.count += 1;
      const labels = r.detections.map(c => c.label);
      for (const cls of labels) {
        b.detections[cls] = (b.detections[cls] ?? 0) + 1;
      }
    }

    const allClasses = new Set<string>();
    for (const [, data] of buckets) {
      for (const k of Object.keys(data.detections)) allClasses.add(k);
    }
    const sorted = Array.from(buckets.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    const result = sorted.map(([bucket, data]) => {
      const flat: Record<string, number> = {};
      for (const c of allClasses) {
        flat[c] = data.detections[c] ?? 0;
      }
      return {
        bucket,
        label: formatBucketLabel(bucket, grouping),
        count: data.count,
        detections: data.detections,
        ...flat,
      };
    });

    if (result.length <= MAX_CHART_POINTS) return result;
    const chunkSize = Math.ceil(result.length / MAX_CHART_POINTS);
    const combined: typeof result = [];
    for (let i = 0; i < result.length; i += chunkSize) {
      const chunk = result.slice(i, i + chunkSize);
      const first = chunk[0];
      const merged: typeof first = {
        bucket: first.bucket,
        label:
          chunk.length > 1
            ? `${first.label} – ${chunk[chunk.length - 1].label}`
            : first.label,
        count: 0,
        detections: {},
      };
      for (const row of chunk) {
        merged.count += row.count;
        for (const [cls, n] of Object.entries(row.detections)) {
          merged.detections[cls] = (merged.detections[cls] ?? 0) + n;
        }
      }
      const flat: Record<string, number> = {};
      for (const c of allClasses) {
        flat[c] = merged.detections[c] ?? 0;
      }
      combined.push({ ...merged, ...flat });
    }
    return combined;
  }, [filteredSnapshots, grouping]);

  const objectTypes = useMemo(() => {
    const set = new Set<string>();
    for (const r of deferredSnapshots) {
      for (const c of r.detections) set.add(c.label);
    }
    return Array.from(set).sort();
  }, [deferredSnapshots]);

  const chartObjectTypes = useMemo(() => {
    const set = new Set<string>();
    for (const d of chartData) {
      for (const k of Object.keys(d)) {
        if (
          k !== 'bucket' &&
          k !== 'label' &&
          k !== 'count' &&
          k !== 'detections'
        ) {
          set.add(k);
        }
      }
    }
    return Array.from(set).sort();
  }, [chartData]);

  const displayedChartTypes = useMemo(() => {
    if (visibleClassifications.size === 0) return chartObjectTypes;
    return chartObjectTypes.filter(c => visibleClassifications.has(c));
  }, [chartObjectTypes, visibleClassifications]);

  const pieData = useMemo(() => {
    const byClass: Record<string, number> = {};
    for (const r of filteredSnapshots) {
      for (const c of r.detections) {
        byClass[c.label] = (byClass[c.label] ?? 0) + 1;
      }
    }
    return Object.entries(byClass)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        fill: COLORS[i % COLORS.length],
      }));
  }, [filteredSnapshots]);

  const summary = useMemo(() => {
    const total = filteredSnapshots.length;
    const byClass: Record<string, number> = {};
    for (const r of filteredSnapshots) {
      for (const c of r.detections) {
        byClass[c.label] = (byClass[c.label] ?? 0) + 1;
      }
    }
    const days = dateRange === 'all' ? 0 : parseInt(dateRange, 10);
    const avgPerDay = days > 0 && total > 0 ? (total / days).toFixed(1) : '-';
    return { total, byClass, avgPerDay };
  }, [filteredSnapshots, dateRange]);

  if (loading) {
    return (
      <div className="rounded-lg bg-zinc-900 p-6 ring-1 ring-zinc-700/50">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Analytics</h2>
        <p className="text-zinc-500">Loading snapshots...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-zinc-900 p-6 ring-1 ring-zinc-700/50">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-zinc-100">Analytics</h2>
        <div className="flex items-center gap-2">
          {(isPending || deferredSnapshots !== snapshots) && (
            <span className="text-xs text-zinc-500">Processing…</span>
          )}
          <button
            type="button"
            onClick={fetchSnapshots}
            disabled={loading}
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">View</label>
          <select
            value={chartView}
            onChange={e => setChartView(e.target.value as ChartView)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="time">Time series</option>
            <option value="distribution">Distribution (pie)</option>
          </select>
        </div>
        {chartView === 'time' && (
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Time grouping
            </label>
            <select
              value={grouping}
              onChange={e => setGrouping(e.target.value as TimeGrouping)}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="minute">By minute</option>
              <option value="hour">By hour</option>
              <option value="day">By day</option>
              <option value="week">By week</option>
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Date range</label>
          <select
            value={dateRange}
            onChange={e =>
              setDateRange(e.target.value as '7' | '30' | '90' | 'all')
            }
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Object type
          </label>
          <select
            value={classificationFilter}
            onChange={e => setClassificationFilter(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="all">All</option>
            {objectTypes.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {chartView === 'time' && (
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Chart type
            </label>
            <select
              value={chartType}
              onChange={e => setChartType(e.target.value as 'bar' | 'line')}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
            </select>
          </div>
        )}
        {chartView === 'time' &&
          classificationFilter === 'all' &&
          chartType === 'bar' && (
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={stacked}
                  onChange={e => setStacked(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-zinc-400">
                  Stack by object type
                </span>
              </label>
            </div>
          )}
        {chartView === 'time' &&
          classificationFilter === 'all' &&
          chartObjectTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">
                Show in chart (click to toggle):
              </span>
              {chartObjectTypes.map(cls => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => toggleVisibleClassification(cls)}
                  className={`rounded px-2 py-1 text-xs ${
                    visibleClassifications.size === 0 ||
                    visibleClassifications.has(cls)
                      ? 'bg-red-600/30 text-red-400'
                      : 'bg-zinc-700/50 text-zinc-500 line-through'
                  }`}
                >
                  {cls}
                </button>
              ))}
              {visibleClassifications.size > 0 && (
                <button
                  type="button"
                  onClick={() => setVisibleClassifications(new Set())}
                  className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-700"
                >
                  Reset
                </button>
              )}
            </div>
          )}
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-md border border-zinc-700 bg-zinc-800/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Total snapshots</p>
          <p className="text-xl font-semibold text-red-400">
            {summary.total}
          </p>
        </div>
        <div className="rounded-md border border-zinc-700 bg-zinc-800/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Avg per day</p>
          <p className="text-xl font-semibold text-zinc-200">
            {summary.avgPerDay}
          </p>
        </div>
        {Object.entries(summary.byClass)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([cls, count], i) => (
            <div
              key={cls}
              className="rounded-md border border-zinc-700 bg-zinc-800/50 px-4 py-3"
            >
              <p className="text-xs text-zinc-500">{cls}</p>
              <p
                className="text-xl font-semibold"
                style={{ color: COLORS[i % COLORS.length] }}
              >
                {count}
              </p>
            </div>
          ))}
      </div>

      {/* Chart */}
      {chartView === 'distribution' ? (
        pieData.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/30 text-zinc-500">
            No data to display for the selected filters
          </div>
        ) : (
          <div className="mx-auto h-80 max-w-md">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={{ stroke: '#71717a' }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={pieData[i].fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                  }}
                  formatter={(value: number | undefined) => [
                    value ?? 0,
                    'Count',
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )
      ) : chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/30 text-zinc-500">
          No data to display for the selected filters
        </div>
      ) : chartType === 'line' ? (
        <div className="h-72 min-h-[288px] w-full">
          <ResponsiveContainer width="100%" height={288} minHeight={288}>
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="label"
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                tickFormatter={v => (v.length > 12 ? v.slice(0, 10) + '…' : v)}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: '#a1a1aa' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as ChartDataPoint;
                  return (
                    <div className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm">
                      <p className="font-medium text-zinc-100">{d.label}</p>
                      <p className="mt-1 text-red-400">Total: {d.count}</p>
                      {Object.entries(d.detections)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cls, cnt]) => (
                          <p key={cls} className="text-xs text-zinc-400">
                            {cls}: {cnt}
                          </p>
                        ))}
                    </div>
                  );
                }}
              />
              {classificationFilter === 'all' &&
              (displayedChartTypes.length > 0 ||
                visibleClassifications.size === 0) ? (
                displayedChartTypes.length > 0 ? (
                  <>
                    {displayedChartTypes.map((cls, i) => (
                      <Line
                        key={cls}
                        type="monotone"
                        dataKey={cls}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        name={cls}
                      />
                    ))}
                    <Legend
                      wrapperStyle={{ fontSize: '12px' }}
                      formatter={value => (
                        <span className="text-zinc-400">{value}</span>
                      )}
                    />
                  </>
                ) : (
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                )
              ) : (
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-72 min-h-[288px] w-full">
          <ResponsiveContainer width="100%" height={288} minHeight={288}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="label"
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                tickFormatter={v => (v.length > 12 ? v.slice(0, 10) + '…' : v)}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: '#a1a1aa' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as ChartDataPoint;
                  return (
                    <div className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm">
                      <p className="font-medium text-zinc-100">{d.label}</p>
                      <p className="mt-1 text-red-400">Total: {d.count}</p>
                      {Object.entries(d.detections)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cls, cnt]) => (
                          <p key={cls} className="text-xs text-zinc-400">
                            {cls}: {cnt}
                          </p>
                        ))}
                    </div>
                  );
                }}
              />
              {stacked &&
              classificationFilter === 'all' &&
              (displayedChartTypes.length > 0 ||
                visibleClassifications.size === 0) ? (
                displayedChartTypes.length > 0 ? (
                  <>
                    {displayedChartTypes.map((cls, i) => (
                      <Bar
                        key={cls}
                        dataKey={cls}
                        stackId="a"
                        fill={COLORS[i % COLORS.length]}
                        radius={
                          i === displayedChartTypes.length - 1
                            ? [4, 4, 0, 0]
                            : 0
                        }
                        name={cls}
                      />
                    ))}
                    <Legend
                      wrapperStyle={{ fontSize: '12px' }}
                      formatter={value => (
                        <span className="text-zinc-400">{value}</span>
                      )}
                    />
                  </>
                ) : (
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                )
              ) : (
                <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filtered snapshots list */}
      <div className="mt-6">
        <SnapshotsList
          snapshots={sortedFilteredSnapshots}
          refreshTrigger={recordingsVersion}
          showCount
        />
      </div>
    </div>
  );
}
