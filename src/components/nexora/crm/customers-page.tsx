import { useNavigate } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type Column } from "@/components/nexora/data/data-table";
import { DataToolbar, FilterSelect, SearchInput } from "@/components/nexora/data/data-toolbar";
import { RequirePermission } from "@/components/nexora/permission-gate";
import { Button } from "@/components/ui/button";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import { useCustomerList, type CustomerRecord } from "@/lib/customers";
import { money } from "@/lib/products";
import { CustomerFormDialog } from "./customer-form-dialog";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export function CustomersPage() {
  return <RequirePermission module="crm"><Inner /></RequirePermission>;
}

function Inner() {
  const navigate = useNavigate();
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const canManage = usePermissions().can("crm", "manage");
  const list = useCustomerList(orgId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const r = (list.data ?? []).filter((c) =>
      (!q || [c.name, c.email, c.phone, c.company].some((v) => (v ?? "").toLowerCase().includes(q))) &&
      (filter === "all" || (filter === "buyers" ? c.order_count > 0 : c.order_count === 0)));
    if (sort === "spend") r.sort((a, b) => b.total_purchases - a.total_purchases);
    if (sort === "orders") r.sort((a, b) => b.order_count - a.order_count);
    if (sort === "recent") r.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return r;
  }, [list.data, search, filter, sort]);

  const total = (list.data ?? []).reduce((t, c) => t + c.total_purchases, 0);
  const columns: Column<CustomerRecord>[] = [
    { key: "name", header: "Customer", cell: (c) => <div><p className="text-sm font-medium">{c.name}</p>{c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}</div> },
    { key: "contact", header: "Contact", className: "hidden md:table-cell", cell: (c) => <div className="text-xs text-muted-foreground"><p>{c.email ?? "—"}</p><p>{c.phone ?? ""}</p></div> },
    { key: "orders", header: "Orders", align: "right", cell: (c) => c.order_count },
    { key: "spend", header: "Total purchases", align: "right", cell: (c) => <span className="font-medium">{money(c.total_purchases)}</span> },
    { key: "last", header: "Last order", className: "hidden lg:table-cell", cell: (c) => <span className="text-sm text-muted-foreground">{fmt(c.last_order_at)}</span> },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-nx-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">03 · CRM</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">{list.data?.length ?? 0} customers · {money(total)} lifetime purchases</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add customer</Button>}
      </div>
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-xl">
        <DataToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, phone…" />
          <FilterSelect label="Purchases" value={filter} onChange={setFilter} options={[{ value: "all", label: "All customers" }, { value: "buyers", label: "Has purchases" }, { value: "none", label: "No purchases" }]} />
          <FilterSelect label="Sort" value={sort} onChange={setSort} options={[{ value: "name", label: "Name A–Z" }, { value: "spend", label: "Top spend" }, { value: "orders", label: "Most orders" }, { value: "recent", label: "Newest" }]} />
        </DataToolbar>
        <DataTable
          columns={columns} rows={rows} loading={list.isLoading}
          error={list.error ? (list.error as Error).message : null}
          onRowClick={(c) => void navigate({ to: "/crm/$customerId", params: { customerId: c.id } })}
          empty={<div className="flex flex-col items-center gap-2 text-muted-foreground"><Users className="size-5" /><p className="text-sm">{list.data?.length ? "No customers match your filters." : "No customers yet."}</p></div>}
        />
      </div>
      <CustomerFormDialog open={open} onOpenChange={setOpen} orgId={orgId} />
    </div>
  );
}
