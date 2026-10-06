import { BarChart3, DollarSign, Receipt, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartCard, RankList, TrendChart } from "@/components/nexora/analytics/charts";
import { KpiCard } from "@/components/nexora/analytics/kpi-card";
import { RequirePermission } from "@/components/nexora/permission-gate";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { money } from "@/lib/products";
import { buildSeries, pctChange, presetRange, useSalesAnalytics, type AnalyticsRange, type Bucket } from "@/lib/sales-analytics";

const PRESETS = [{ v: "7", label: "7D" }, { v: "30", label: "30D" }, { v: "90", label: "90D" }, { v: "365", label: "12M" }];
const compact = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)));

export function SalesAnalyticsPage() {
  return <RequirePermission module="analytics"><Inner /></RequirePermission>;
}

function Inner() {
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const [preset, setPreset] = useState("30");
  const [range, setRange] = useState<AnalyticsRange>(() => presetRange(30));
  const [bucket, setBucket] = useState<Bucket>("day");
  const q = useSalesAnalytics(orgId, range);
  const loading = q.isLoading || !orgId;
  const series = useMemo(() => (q.data ? buildSeries(q.data.sales, range, bucket) : []), [q.data, range, bucket]);
  const d = q.data;

  const choosePreset = (v: string) => { if (!v) return; setPreset(v); setRange(presetRange(Number(v))); if (Number(v) >= 365) setBucket("month"); else if (Number(v) >= 90 && bucket === "day") setBucket("week"); };
  const setDate = (k: keyof AnalyticsRange, v: string) => { if (!v) return; setPreset(""); setRange((r) => { const n = { ...r, [k]: v }; return n.from > n.to ? r : n; }); };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">07 · Analytics</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sales analytics</h1>
          <p className="text-sm text-muted-foreground">Completed sales only. Comparisons use the period of equal length just before.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ToggleGroup type="single" variant="outline" size="sm" value={preset} onValueChange={choosePreset} aria-label="Date range preset">
            {PRESETS.map((p) => <ToggleGroupItem key={p.v} value={p.v}>{p.label}</ToggleGroupItem>)}
          </ToggleGroup>
          <div className="grid gap-1"><Label htmlFor="an-from" className="text-xs">From</Label><Input id="an-from" type="date" className="h-8 w-36" value={range.from} max={range.to} onChange={(e) => setDate("from", e.target.value)} /></div>
          <div className="grid gap-1"><Label htmlFor="an-to" className="text-xs">To</Label><Input id="an-to" type="date" className="h-8 w-36" value={range.to} min={range.from} onChange={(e) => setDate("to", e.target.value)} /></div>
        </div>
      </header>

      {q.error && <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">Couldn't load analytics: {(q.error as Error).message}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Revenue" icon={DollarSign} loading={loading} value={money(d?.revenue ?? 0)} change={d ? pctChange(d.revenue, d.prev.revenue) : null} />
        <KpiCard label="Orders" icon={ShoppingCart} loading={loading} value={(d?.orders ?? 0).toLocaleString()} change={d ? pctChange(d.orders, d.prev.orders) : null} />
        <KpiCard label="Average order value" icon={Receipt} loading={loading} value={money(d?.aov ?? 0)} change={d ? pctChange(d.aov, d.prev.aov) : null} />
      </div>

      {!loading && d && d.orders === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <BarChart3 className="size-5" /> No completed sales in this period. Complete a sale on the Sales page or widen the date range.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Revenue" subtitle={`${bucket === "day" ? "Daily" : bucket === "week" ? "Weekly" : "Monthly"} sales revenue`}
            actions={<ToggleGroup type="single" variant="outline" size="sm" value={bucket} onValueChange={(v) => v && setBucket(v as Bucket)} aria-label="Grouping">
              <ToggleGroupItem value="day">Daily</ToggleGroupItem><ToggleGroupItem value="week">Weekly</ToggleGroupItem><ToggleGroupItem value="month">Monthly</ToggleGroupItem>
            </ToggleGroup>}>
            <TrendChart data={series} xKey="label" yKey="revenue" format={(n) => `$${compact(n)}`} loading={loading} />
          </ChartCard>
        </div>
        <ChartCard title="Orders" subtitle="Completed orders per period">
          <TrendChart data={series} xKey="label" yKey="orders" type="bar" format={(n) => String(n)} loading={loading} />
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Top products" subtitle="By revenue in this period">
          <RankList rows={d?.topProducts ?? []} loading={loading} format={money} sub={(r) => `${r.count.toLocaleString()} sold`} empty="No products sold in this period." />
        </ChartCard>
        <ChartCard title="Top customers" subtitle="By revenue in this period">
          <RankList rows={d?.topCustomers ?? []} loading={loading} format={money} sub={(r) => `${r.count} order${r.count === 1 ? "" : "s"}`} empty="No customer sales in this period." />
        </ChartCard>
      </div>
    </div>
  );
}
