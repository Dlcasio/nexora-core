import { useNavigate } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type Column } from "@/components/nexora/data/data-table";
import { DataToolbar, FilterSelect, SearchInput } from "@/components/nexora/data/data-toolbar";
import { RequirePermission } from "@/components/nexora/permission-gate";
import { Button } from "@/components/ui/button";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_LABEL,
  useEmployeeList,
  type EmployeeRecord,
  type EmployeeStatus,
} from "@/lib/employees";
import { EmployeeFormDialog } from "./employee-form-dialog";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const DOT: Record<EmployeeStatus, string> = {
  active: "bg-emerald-500",
  on_leave: "bg-amber-500",
  terminated: "bg-slate-400",
};

export function EmployeesPage() {
  return (
    <RequirePermission module="employees">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const navigate = useNavigate();
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const canManage = usePermissions().can("employees", "manage");

  const list = useEmployeeList(orgId);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [open, setOpen] = useState(false);

  const all = list.data ?? [];

  const departments = useMemo(
    () => Array.from(new Set(all.map((e) => e.department).filter((d): d is string => !!d))).sort(),
    [all],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (e) =>
        (!q || [e.full_name, e.email, e.phone, e.job_title, e.department].some((v) => (v ?? "").toLowerCase().includes(q))) &&
        (status === "all" || e.status === status) &&
        (department === "all" || e.department === department),
    );
  }, [all, search, status, department]);

  const activeCount = all.filter((e) => e.status === "active").length;

  const columns: Column<EmployeeRecord>[] = [
    {
      key: "name",
      header: "Employee",
      cell: (e) => (
        <div>
          <p className="text-sm font-medium">{e.full_name}</p>
          {e.job_title && <p className="text-xs text-muted-foreground">{e.job_title}</p>}
        </div>
      ),
    },
    {
      key: "department",
      header: "Department",
      className: "hidden md:table-cell",
      cell: (e) => <span className="text-sm text-muted-foreground">{e.department ?? "—"}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      className: "hidden lg:table-cell",
      cell: (e) => (
        <div className="text-xs text-muted-foreground">
          <p>{e.email ?? "—"}</p>
          <p>{e.phone ?? ""}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (e) => (
        <span className="inline-flex items-center gap-2 text-xs">
          <span className={`size-2 rounded-full ${DOT[e.status]}`} />
          {EMPLOYEE_STATUS_LABEL[e.status]}
        </span>
      ),
    },
    {
      key: "hired",
      header: "Hired",
      className: "hidden lg:table-cell",
      cell: (e) => <span className="text-sm text-muted-foreground">{fmt(e.hired_on)}</span>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-nx-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">04 · Employees</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {all.length} employees · {activeCount} active
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add employee
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-xl">
        <DataToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, job title…" />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All statuses" },
              ...EMPLOYEE_STATUSES.map((s) => ({ value: s, label: EMPLOYEE_STATUS_LABEL[s] })),
            ]}
          />
          <FilterSelect
            label="Department"
            value={department}
            onChange={setDepartment}
            options={[{ value: "all", label: "All departments" }, ...departments.map((d) => ({ value: d, label: d }))]}
          />
        </DataToolbar>
        <DataTable
          columns={columns}
          rows={rows}
          loading={list.isLoading}
          error={list.error ? (list.error as Error).message : null}
          onRowClick={(e) => void navigate({ to: "/employees/$employeeId", params: { employeeId: e.id } })}
          empty={
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Users className="size-5" />
              <p className="text-sm">{all.length ? "No employees match your filters." : "No employees yet."}</p>
            </div>
          }
        />
      </div>

      <EmployeeFormDialog open={open} onOpenChange={setOpen} orgId={orgId} departments={departments} />
    </div>
  );
}