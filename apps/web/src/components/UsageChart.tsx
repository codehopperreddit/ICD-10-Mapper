"use client";

interface Point {
  date: string;
  count: number;
}

/** Lightweight inline-SVG bar chart so we don't ship a charting library. */
export function UsageChart({ data }: { data: Point[] }) {
  if (!data || data.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500">No usage in the last 30 days.</p>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 600;
  const H = 160;
  const pad = 24;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  const barW = innerW / data.length - 4;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-4 w-full text-brand-600"
      role="img"
      aria-label="Daily usage chart"
    >
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#e2e8f0" />
      {data.map((d, i) => {
        const h = (d.count / max) * innerH;
        const x = pad + i * (barW + 4);
        const y = H - pad - h;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={h} rx={2} fill="currentColor" />
            <title>{`${d.date}: ${d.count}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
