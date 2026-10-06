import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Only completed sales count toward revenue analytics. */
export type AnalyticsRange = { from: string; to: string }; // YYYY-MM-DD inclusive
export type Bucket = "day" | "week" | "month";
export type SeriesPoint = { key: string; label: string; revenue: number; orders: number };
export type RankRow = { id: string; name: string; revenue: number; count: number };

export type SalesAnalytics = {
  revenue: number; orders: number; aov: number;
  prev: { revenue: number; orders: number; aov: number };
  sales: { sold_at: string; total: number }[];
  topProducts: RankRow[]; topCustomers: RankRow[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
export function presetRange(days: number): AnalyticsRange {
  const to = new Date(); const from = new Date(); from.setDate(to.getDate() - (days - 1));
  return { from: iso(from), to: iso(to) };
}

type Row = { id: string; total_amount: number; sold_at: string; customer: { id: string; name: string } | null; sale_items: { quantity: number; line_total: number | null; description: string | null; product: { id: string; name: string } | null }[] };

async function load(orgId: string, from: Date, to: Date): Promise<Row[]> {
  const { data, error } = await supabase.from("sales")
    .select("id, total_amount, sold_at, customer:customers(id, name), sale_items(quantity, line_total, description, product:products(id, name))")
    .eq("organization_id", orgId).eq("status", "completed")
    .gte("sold_at", from.toISOString()).lt("sold_at", to.toISOString())
    .order("sold_at").limit(10000);
  if (error) throw error;
  return (data ?? []) as unknown as Row[];
}

function rank(map: Map<string, RankRow>, id: string, name: string, revenue: number, count: number) {
  const r = map.get(id) ?? { id, name, revenue: 0, count: 0 };
  r.revenue += revenue; r.count += count; map.set(id, r);
}

export function useSalesAnalytics(orgId: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: ["sales-analytics", orgId, range.from, range.to],
    enabled: !!orgId,
    queryFn: async (): Promise<SalesAnalytics> => {
      const start = new Date(`${range.from}T00:00:00`);
      const end = new Date(`${range.to}T00:00:00`); end.setDate(end.getDate() + 1);
      const span = end.getTime() - start.getTime();
      const [cur, prev] = await Promise.all([load(orgId!, start, end), load(orgId!, new Date(start.getTime() - span), start)]);
      const sum = (rs: Row[]) => rs.reduce((a, r) => a + Number(r.total_amount), 0);
      const revenue = sum(cur), pRevenue = sum(prev);
      const products = new Map<string, RankRow>(), customers = new Map<string, RankRow>();
      for (const s of cur) {
        if (s.customer) rank(customers, s.customer.id, s.customer.name, Number(s.total_amount), 1);
        for (const i of s.sale_items) if (i.product) rank(products, i.product.id, i.product.name, Number(i.line_total ?? 0), Number(i.quantity));
      }
      const top = (m: Map<string, RankRow>) => [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      return {
        revenue, orders: cur.length, aov: cur.length ? revenue / cur.length : 0,
        prev: { revenue: pRevenue, orders: prev.length, aov: prev.length ? pRevenue / prev.length : 0 },
        sales: cur.map((s) => ({ sold_at: s.sold_at, total: Number(s.total_amount) })),
        topProducts: top(products), topCustomers: top(customers),
      };
    },
  });
}

function bucketStart(d: Date, b: Bucket) {
  const x = new Date(d.getFullYear(), d.getMonth(), b === "month" ? 1 : d.getDate());
  if (b === "week") x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Groups sales into contiguous day/week/month buckets, filling gaps with zeros. */
export function buildSeries(sales: SalesAnalytics["sales"], range: AnalyticsRange, b: Bucket): SeriesPoint[] {
  const pts = new Map<string, SeriesPoint>();
  const cur = bucketStart(new Date(`${range.from}T00:00:00`), b);
  const end = new Date(`${range.to}T00:00:00`);
  while (cur <= end && pts.size < 400) {
    const label = b === "month" ? cur.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
      : cur.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    pts.set(keyOf(cur), { key: keyOf(cur), label, revenue: 0, orders: 0 });
    if (b === "day") cur.setDate(cur.getDate() + 1); else if (b === "week") cur.setDate(cur.getDate() + 7); else cur.setMonth(cur.getMonth() + 1);
  }
  for (const s of sales) {
    const p = pts.get(keyOf(bucketStart(new Date(s.sold_at), b)));
    if (p) { p.revenue += s.total; p.orders += 1; }
  }
  return [...pts.values()];
}

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}
