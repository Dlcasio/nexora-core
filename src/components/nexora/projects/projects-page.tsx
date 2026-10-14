import { FolderKanban, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type Column } from "@/components/nexora/data/data-table";
import { DataToolbar, FilterSelect, SearchInput } from "@/components/nexora/data/data-toolbar";
import { RequirePermission } from "@/components/nexora/permission-gate";
import { Button } from "@/components/ui/button";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import { useEmployeeList } from "@/lib/employees";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  useCustomerOptions,
  useProjectList,
  type ProjectRecord,
  type ProjectStatus,
} from "@/lib/projects";
import { money } from "@/lib/products";
import { ProjectFormDialog } from "./project-form-dialog";

const DOT: Record<ProjectStatus, string> = {
  planning: "bg-slate-400",
  active: "bg-blue-500",
  on_hold: "bg-amber-500",
  completed: "bg-emerald-500",
  cancelled: "bg-rose-400",
};

const fmt = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const todayIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function ProjectsPage() {
  return (
    <RequirePermission module="projects">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const canManage = usePermissions().can("projects", "manage");

  const list = useProjectList(orgId);
  const customers = useCustomerOptions(orgId);
  const employees = useEmployeeList(orgId);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRecord | null>(null);

  const all = list.data ?? [];
  const today = todayIso();

  const customerName = (id: string | null) => (customers.data ?? []).find((c) => c.id === id)?.name ?? null;
  const ownerName = (id: string | null) => (employees.data ?? []).find((e) => e.id === id)?.full_name ?? null;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (p) =>
        (!q || [p.name, p.description].some((v) => (v ?? "").toLowerCase().includes(q))) &&
        (status === "all" || p.status === status),
    );
  }, [all, search, status]);

  const activeCount = all.filter((p) => p.status === "active").length;

  const columns: Column<ProjectRecord>[] = [
    {
      key: "name",
      header: "Project",
      cell: (p) => (
        <div>
          <p className="text-sm font-medium">{p.name}</p>
          {customerName(p.customer_id) && <p className="text-xs text-muted-foreground">{customerName(p.customer_id)}</p>}
        </div>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      className: "hidden md:table-cell",
      cell: (p) => <span className="text-sm text-muted-foreground">{ownerName(p.owner_employee_id) ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => (
        <span className="inline-flex items-center gap-2 text-xs">
          <span className={`size-2 rounded-full ${DOT[p.status]}`} />
          {PROJECT_STATUS_LABEL[p.status]}
        </span>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      className: "hidden lg:table-cell",
      cell: (p) =>
        p.task_total === 0 ? (
          <span className="text-xs text-muted-foreground">No tasks</span>
        ) : (
          <div className="w-32">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(p.task_done / p.task_total) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {p.task_done}/{p.task_total} tasks
            </p>
          </div>
        ),
    },
    {
      key: "budget",
      header: "Budget",
      align: "right",
      className: "hidden md:table-cell",
      cell: (p) => <span className="text-sm">{p.budget === null ? "—" : money(p.budget)}</span>,
    },
    {
      key: "due",
      header: "Due",
      cell: (p) => {
        const overdue = !!p.due_date && p.due_date < today && p.status !== "completed" && p.status !== "cancelled";
        return <span className={`text-sm ${overdue ? "text-destructive" : "text-muted-foreground"}`}>{fmt(p.due_date)}</span>;
      },
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-nx-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">05 · Projects</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {all.length} {all.length === 1 ? "project" : "projects"} · {activeCount} active
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Add project
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-xl">
        <DataToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All statuses" },
              ...PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] })),
            ]}
          />
        </DataToolbar>
        <DataTable
          columns={columns}
          rows={rows}
          loading={list.isLoading}
          error={list.error ? (list.error as Error).message : null}
          onRowClick={
            canManage
              ? (p) => {
                  setEditing(p);
                  setOpen(true);
                }
              : undefined
          }
          empty={
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <FolderKanban className="size-5" />
              <p className="text-sm">{all.length ? "No projects match your filters." : "No projects yet."}</p>
            </div>
          }
        />
      </div>

      <ProjectFormDialog open={open} onOpenChange={setOpen} orgId={orgId} project={editing} />
    </div>
  );
}