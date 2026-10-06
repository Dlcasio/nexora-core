import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Reusable KPI tile: value, optional change vs. previous period. */
export function KpiCard({ label, value, change, icon: Icon, loading, hint }: {
  label: string; value: string; change?: number | null; icon: LucideIcon; loading?: boolean; hint?: string;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-28" /> : <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>}
      <div className="mt-1 h-5 text-xs">
        {!loading && change != null ? (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-primary" : "text-destructive")}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(change).toFixed(1)}% <span className="ml-1 font-normal text-muted-foreground">vs previous period</span>
          </span>
        ) : !loading ? <span className="text-muted-foreground">{hint ?? "No previous period data"}</span> : null}
      </div>
    </div>
  );
}
