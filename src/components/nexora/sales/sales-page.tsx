import { useNavigate } from "@tanstack/react-router";
import { Plus, Receipt } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type Column } from "@/components/nexora/data/data-table";
import { DataToolbar, FilterSelect, SearchInput } from "@/components/nexora/data/data-toolbar";
import { RequirePermission } from "@/components/nexora/permission-gate";
import { Button } from "@/components/ui/button";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import { money } from "@/lib/products";
import { SALE_STATUSES, SALE_STATUS_LABEL, useSales, type SaleRow } from "@/lib/sales";
import { SaleFormDialog } from "./sale-form-dialog";
import { SaleStatusBadge } from "./sale-status-badge";

export const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function SalesPage() {
  return <RequirePermission module="sales"><SalesInner /></RequirePermission>;
}

function SalesInner() {
  const navigate = useNavigate();
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const canManage = usePermissions().can("sales", "manage");
  const sales = useSales(orgId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (sales.data ?? []).filter((s) =>
      (!q || (s.reference ?? "").toLowerCase().includes(q) || (s.customer?.name ?? "").toLowerCase().includes(q)) &&
      (status === "all" || s.status === status));
  }, [sales.data, search, status]);

  const completedTotal = (sales.data ?? []).filter((s) => s.status === "completed").reduce((t, s) => t + s.total_amount, 0);
  const openSale = (id: string) => void navigate({ to: "/sales/$saleId", params: { saleId: id } });

  const columns: Column<SaleRow>[] = [
    { key: "ref", header: "Order", cell: (s) => <span className="font-mono text-xs font-medium">{s.reference ?? "—"}</span> },
    { key: "customer", header: "Customer", cell: (s) => <span className="text-sm">{s.customer?.name ?? <span className="text-muted-foreground">Walk-in</span>}</span> },
    { key: "date", header: "Date", className: "hidden md:table-cell", cell: (s) => <span className="text-sm text-muted-foreground">{formatDate(s.sold_at)}</span> },
    { key: "items", header: "Items", align: "right", className: "hidden sm:table-cell", cell: (s) => s.item_count },
    { key: "status", header: "Status", cell: (s) => <SaleStatusBadge status={s.status} /> },
    { key: "total", header: "Total", align: "right", cell: (s) => <span className="font-medium">{money(s.total_amount)}</span> },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-nx-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">01 · Sales</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sales orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sales.data?.length ?? 0} orders · {money(completedTotal)} completed revenue
          </p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> New sale</Button>}
      </div>

      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-xl">
        <DataToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search order or customer…" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...SALE_STATUSES.map((s) => ({ value: s, label: SALE_STATUS_LABEL[s] }))]} />
        </DataToolbar>
        <DataTable
          columns={columns}
          rows={rows}
          loading={sales.isLoading}
          error={sales.error ? (sales.error as Error).message : null}
          onRowClick={(s) => openSale(s.id)}
          empty={
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Receipt className="size-5" />
              <p className="text-sm">{sales.data?.length ? "No orders match your filters." : "No sales yet."}</p>
              {canManage && !sales.data?.length && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Create your first sale</Button>}
            </div>
          }
        />
      </div>
      <SaleFormDialog open={open} onOpenChange={setOpen} orgId={orgId} onCreated={openSale} />
    </div>
  );
}
