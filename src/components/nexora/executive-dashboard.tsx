import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { type DashboardMetric, useExecutiveDashboard } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

const metricIcons = {
  revenue: CircleDollarSign,
  expenses: CreditCard,
  "net-income": TrendingUp,
  orders: ShoppingCart,
  customers: Users,
  inventory: Boxes,
  tasks: Clock3,
} as const;

const revenueConfig = {
  revenue: { label: "Revenue", color: "var(--chart-2)" },
  previous: { label: "Previous period", color: "var(--chart-3)" },
} satisfies ChartConfig;

const expenseConfig = {
  value: { label: "Expenses", color: "var(--chart-1)" },
} satisfies ChartConfig;

const expenseColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const currencyCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function SectionHeader({ title, description, aside }: { title: string; description: string; aside?: React.ReactNode }) {
  return (
    <div className="flex min-h-16 items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {aside}
    </div>
  );
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metricIcons[metric.id];
  const TrendIcon = metric.direction === "up" ? ArrowUpRight : metric.direction === "down" ? ArrowDownRight : null;
  const alertMetric = metric.id === "inventory" || metric.id === "tasks";
  return (
    <article className="min-w-0 border-r border-t border-border bg-card/55 p-4 transition-colors hover:bg-card sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs font-medium text-muted-foreground">{metric.label}</p>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground", alertMetric && "text-destructive")}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold tabular-nums sm:text-[28px]">{metric.value}</p>
      <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px]">
        {TrendIcon && <TrendIcon className={cn("size-3.5 shrink-0", metric.direction === "up" ? "text-status" : "text-destructive")} aria-hidden="true" />}
        <span className={cn("shrink-0 font-mono font-medium", metric.direction === "up" && "text-status", metric.direction === "down" && "text-destructive", alertMetric && "text-destructive")}>{metric.change}</span>
        <span className="truncate text-muted-foreground">{metric.context}</span>
      </div>
    </article>
  );
}

function RevenuePanel({ data }: { data: Array<{ month: string; revenue: number; previous: number; expenses: number }> }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/60 backdrop-blur-xl xl:col-span-2">
      <SectionHeader
        title="Revenue performance"
        description="Monthly recognized revenue compared with the prior period"
        aside={<span className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex"><span className="size-2 rounded-full bg-chart-2" /> Current <span className="ml-1 size-2 rounded-full bg-chart-3" /> Previous</span>}
      />
      <div className="p-3 sm:p-5">
        <ChartContainer config={revenueConfig} className="h-[260px] w-full aspect-auto sm:h-[300px]" aria-label="Revenue trend from October through March">
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 12, bottom: 0 }} accessibilityLayer>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.28} /><stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={48} tickFormatter={(value) => `$${value / 1000}k`} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value, name) => <><span className="text-muted-foreground">{revenueConfig[name as keyof typeof revenueConfig]?.label}</span><span className="ml-auto font-mono font-medium tabular-nums">{currency.format(Number(value))}</span></>} />} />
            <Area type="monotone" dataKey="previous" stroke="var(--color-previous)" strokeWidth={1.5} strokeDasharray="5 5" fill="transparent" />
            <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2.5} fill="url(#revenueFill)" />
          </AreaChart>
        </ChartContainer>
      </div>
    </section>
  );
}

function ExpensePanel({ data }: { data: Array<{ category: string; value: number }> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/60 backdrop-blur-xl">
      <SectionHeader title="Expense profile" description="March operating spend by category" aside={<span className="font-mono text-xs font-semibold tabular-nums">{currencyCompact.format(total)}</span>} />
      <div className="p-3 sm:p-5">
        <ChartContainer config={expenseConfig} className="h-[180px] w-full aspect-auto" aria-label="Expense totals by category">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12, top: 0, bottom: 0 }} accessibilityLayer>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" hide />
            <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} width={68} tick={{ fontSize: 10 }} />
            <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideLabel formatter={(value) => <span className="font-mono font-medium tabular-nums">{currency.format(Number(value))}</span>} />} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={12}>{data.map((item, index) => <Cell key={item.category} fill={expenseColors[index % expenseColors.length]} />)}</Bar>
          </BarChart>
        </ChartContainer>
        <p className="mt-2 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">Payroll and operations account for 65% of total expenses.</p>
      </div>
    </section>
  );
}

const activityIcons = { order: PackageCheck, customer: UserPlus, inventory: AlertTriangle, payment: CircleDollarSign } as const;

function ActivityPanel({ items }: { items: ReturnType<typeof useExecutiveDashboard>["data"] extends infer T ? NonNullable<T> extends { activity: infer A } ? A : never : never }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/60 backdrop-blur-xl">
      <SectionHeader title="Recent activity" description="Latest updates across your workspace" />
      <div className="divide-y divide-border">
        {items.map((item) => { const Icon = activityIcons[item.type]; return (
          <div key={item.id} className="flex gap-3 px-5 py-3.5">
            <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground", item.type === "inventory" && "text-destructive")}><Icon className="size-3.5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{item.title}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{item.detail}</p></div>
            <time className="shrink-0 font-mono text-[10px] text-muted-foreground">{item.time}</time>
          </div>
        ); })}
      </div>
    </section>
  );
}

function InventoryPanel({ items }: { items: NonNullable<ReturnType<typeof useExecutiveDashboard>["data"]>["inventoryAlerts"] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/60 backdrop-blur-xl">
      <SectionHeader title="Low inventory" description="Items at or below reorder thresholds" aside={<span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 font-mono text-[10px] font-semibold text-destructive"><AlertTriangle className="size-3" /> 3 critical</span>} />
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
            <span className={cn("size-2 shrink-0 rounded-full bg-chart-4", item.severity === "critical" && "bg-destructive")} aria-hidden="true" />
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{item.name}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.sku} · Reorder at {item.reorderAt}</p></div>
            <div className="text-right"><p className={cn("font-mono text-sm font-semibold tabular-nums", item.severity === "critical" && "text-destructive")}>{item.stock}</p><p className="text-[10px] text-muted-foreground">in stock</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TransactionsPanel({ items }: { items: NonNullable<ReturnType<typeof useExecutiveDashboard>["data"]>["transactions"] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/60 backdrop-blur-xl xl:col-span-2">
      <SectionHeader title="Recent transactions" description="Latest income and expense movements" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <caption className="sr-only">Recent business transactions</caption>
          <thead className="border-b border-border bg-secondary/45 font-mono text-[10px] uppercase text-muted-foreground"><tr><th scope="col" className="px-5 py-2.5 font-medium">Counterparty</th><th scope="col" className="px-4 py-2.5 font-medium">Reference</th><th scope="col" className="px-4 py-2.5 font-medium">Date</th><th scope="col" className="px-4 py-2.5 font-medium">Status</th><th scope="col" className="px-5 py-2.5 text-right font-medium">Amount</th></tr></thead>
          <tbody className="divide-y divide-border">{items.map((item) => <tr key={item.id} className="hover:bg-secondary/30"><td className="px-5 py-3.5"><p className="font-medium">{item.counterparty}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{item.type}</p></td><td className="px-4 py-3.5 font-mono text-[10px] text-muted-foreground">{item.id}</td><td className="px-4 py-3.5 text-muted-foreground">{item.date}</td><td className="px-4 py-3.5"><span className={cn("inline-flex items-center gap-1.5", item.status === "Completed" ? "text-status" : "text-muted-foreground")}><span className={cn("size-1.5 rounded-full", item.status === "Completed" ? "bg-status" : "bg-chart-4")} />{item.status}</span></td><td className={cn("px-5 py-3.5 text-right font-mono font-semibold tabular-nums", item.amount > 0 ? "text-status" : "text-foreground")}>{item.amount > 0 ? "+" : "−"}{currency.format(Math.abs(item.amount))}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function TasksPanel({ items }: { items: NonNullable<ReturnType<typeof useExecutiveDashboard>["data"]>["tasks"] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/60 backdrop-blur-xl">
      <SectionHeader title="Pending tasks" description="Highest-priority work requiring attention" />
      <div className="divide-y divide-border">{items.map((item) => <div key={item.id} className="flex items-start gap-3 px-5 py-3.5"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border"><CheckCircle2 className="size-3 text-muted-foreground" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium leading-5">{item.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.owner} · Due {item.due}</p></div><span className={cn("rounded px-1.5 py-1 font-mono text-[9px] font-semibold uppercase", item.priority === "High" ? "bg-destructive/10 text-destructive" : item.priority === "Medium" ? "bg-chart-4/15 text-foreground" : "bg-secondary text-muted-foreground")}>{item.priority}</span></div>)}</div>
    </section>
  );
}

function DashboardSkeleton() {
  return <div className="space-y-4" aria-label="Loading executive dashboard"><Skeleton className="h-20 w-full" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-36" />)}</div><div className="grid gap-4 xl:grid-cols-3"><Skeleton className="h-96 xl:col-span-2" /><Skeleton className="h-96" /></div></div>;
}

export function ExecutiveDashboard() {
  const { data: membership } = useCurrentOrganization();
  const { data, isLoading, isError } = useExecutiveDashboard();
  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <div className="rounded-lg border border-destructive/30 bg-card/60 p-8 text-center"><AlertTriangle className="mx-auto size-5 text-destructive" /><h2 className="mt-3 text-sm font-semibold">Dashboard data is unavailable</h2><p className="mt-1 text-xs text-muted-foreground">Refresh the page to try again.</p></div>;

  return (
    <div className="mx-auto max-w-[1480px] animate-nx-rise">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Executive overview</p><h1 className="text-2xl font-extrabold md:text-3xl">{membership?.organization.name ?? "NEXORA"}</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">A clear view of business performance, operations, and priorities.</p></div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end"><span className="inline-flex h-8 items-center rounded-md border border-border bg-card/60 px-3 font-mono text-[10px] text-muted-foreground">{data.periodLabel}</span><span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 font-mono text-[10px] text-muted-foreground"><ReceiptText className="size-3" /> Demo data</span></div>
      </header>

      <section className="mb-4 overflow-hidden rounded-lg border border-border bg-card/35" aria-label="Key business metrics">
        <div className="grid grid-cols-2 lg:grid-cols-4 [&>*:nth-child(2n)]:border-r-0 lg:[&>*:nth-child(2n)]:border-r lg:[&>*:nth-child(4n)]:border-r-0">
          {data.metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
          <div className="hidden border-t border-border bg-secondary/25 p-5 lg:flex lg:flex-col lg:justify-between"><WalletCards className="size-5 text-muted-foreground" /><div><p className="font-mono text-[10px] uppercase text-muted-foreground">Reporting status</p><p className="mt-1 text-xs font-medium">{data.updatedLabel}</p></div></div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3"><RevenuePanel data={data.financialTrend} /><ExpensePanel data={data.expenseMix} /></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2"><ActivityPanel items={data.activity} /><InventoryPanel items={data.inventoryAlerts} /></div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3"><TransactionsPanel items={data.transactions} /><TasksPanel items={data.tasks} /></div>
    </div>
  );
}