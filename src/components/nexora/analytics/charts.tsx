import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartCard({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="text-sm font-semibold">{title}</h2>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div>
        {actions}
      </div>
      {children}
    </section>
  );
}

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--popover-foreground)" };
const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

type Datum = Record<string, string | number>;

/** Reusable time-series chart. */
export function TrendChart({ data, xKey, yKey, type = "area", format, loading, height = 260 }: {
  data: Datum[]; xKey: string; yKey: string; type?: "area" | "bar"; format: (n: number) => string; loading?: boolean; height?: number;
}) {
  if (loading) return <Skeleton className="w-full" style={{ height }} />;
  return (
    <div style={{ height }} role="img" aria-label={`${yKey} chart`}>
      <ResponsiveContainer width="100%" height="100%">
        {type === "area" ? (
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
            <defs><linearGradient id={`g-${yKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={xKey} {...axis} minTickGap={16} />
            <YAxis {...axis} width={56} tickFormatter={format} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => format(v)} />
            <Area type="monotone" dataKey={yKey} stroke="var(--primary)" strokeWidth={2} fill={`url(#g-${yKey})`} />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={xKey} {...axis} minTickGap={16} />
            <YAxis {...axis} width={40} tickFormatter={format} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => format(v)} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey={yKey} fill="var(--primary)" radius={[3, 3, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Reusable ranked list with proportional bars. */
export function RankList({ rows, format, sub, loading, empty }: {
  rows: { id: string; name: string; revenue: number; count: number }[]; format: (n: number) => string; sub: (r: { count: number }) => string; loading?: boolean; empty: string;
}) {
  if (loading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>;
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = rows[0].revenue || 1;
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.id}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate"><span className="mr-2 font-mono text-xs text-muted-foreground">{i + 1}</span>{r.name}</span>
            <span className="shrink-0 tabular-nums font-medium">{format(r.revenue)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.revenue / max) * 100}%` }} /></div>
            <span className="w-20 text-right text-xs text-muted-foreground">{sub(r)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
