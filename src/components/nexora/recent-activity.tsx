import { Activity, CheckCircle2, CircleDollarSign, Package, ReceiptText, ShoppingCart, UserPlus, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { relativeTime, useRecentActivity } from "@/lib/activity";
import { cn } from "@/lib/utils";

const icons: Record<string, typeof Activity> = {
  user: UserPlus, product: Package, sale: ShoppingCart, expense: ReceiptText,
  task: CheckCircle2, customer: Users, employee: Users, payment: CircleDollarSign,
};

export function RecentActivity({ limit = 8, className }: { limit?: number; className?: string }) {
  const { data: membership } = useCurrentOrganization();
  const { data, isLoading, isError } = useRecentActivity(membership?.organization.id, limit);

  return (
    <section className={cn("overflow-hidden rounded-lg border border-border bg-card/60 backdrop-blur-xl", className)}>
      <div className="flex min-h-16 items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">Latest events across your organization</p>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"><span className="size-1.5 rounded-full bg-status" /> Live</span>
      </div>
      {isLoading ? (
        <div className="space-y-3 p-5" aria-label="Loading activity">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : isError ? (
        <p className="p-6 text-center text-xs text-destructive">Activity couldn't be loaded. Refresh to try again.</p>
      ) : !data?.length ? (
        <div className="p-8 text-center">
          <Activity className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-xs font-medium">No activity yet</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Events like new members, products, sales and completed tasks will appear here.</p>
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {data.map((item) => {
            const Icon = icons[item.entity_type] ?? Activity;
            return (
              <li key={item.id} className="flex gap-3 px-5 py-3.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground"><Icon className="size-3.5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{item.description ?? item.action}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.actor_name ?? "System"} · <span className="font-mono">{item.action}</span></p>
                </div>
                <time dateTime={item.created_at} className="shrink-0 font-mono text-[10px] text-muted-foreground">{relativeTime(item.created_at)}</time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
