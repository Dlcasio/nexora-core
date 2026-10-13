import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil } from "lucide-react";
import { useState } from "react";

import { RequirePermission } from "@/components/nexora/permission-gate";
import { Button } from "@/components/ui/button";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import {
  EMPLOYEE_STATUS_LABEL,
  useEmployee,
  useEmployeeActivity,
  useEmployeeLeads,
  type EmployeeStatus,
} from "@/lib/employees";
import { money } from "@/lib/products";
import { EmployeeCompensation } from "./employee-compensation";
import { EmployeeFormDialog } from "./employee-form-dialog";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const DOT: Record<EmployeeStatus, string> = {
  active: "bg-emerald-500",
  on_leave: "bg-amber-500",
  terminated: "bg-slate-400",
};

export function EmployeeDetailPage({ employeeId }: { employeeId: string }) {
  return (
    <RequirePermission module="employees">
      <Inner employeeId={employeeId} />
    </RequirePermission>
  );
}

function Inner({ employeeId }: { employeeId: string }) {
  const navigate = useNavigate();
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const canManage = usePermissions().can("employees", "manage");

  const employee = useEmployee(orgId, employeeId);
  const leads = useEmployeeLeads(orgId, employeeId);
  const activity = useEmployeeActivity(orgId, employeeId);
  const [open, setOpen] = useState(false);

  const back = (
    <Link to="/employees" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Employees
    </Link>
  );

  if (employee.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading employee…</p>;
  }

  if (employee.error || !employee.data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {back}
        <p className="text-sm text-muted-foreground">
          {employee.error ? (employee.error as Error).message : "Employee not found."}
        </p>
      </div>
    );
  }

  const e = employee.data;
  const leadRows = leads.data ?? [];
  const openLeads = leadRows.filter((l) => l.status !== "Won" && l.status !== "Lost");
  const openValue = openLeads.reduce((t, l) => t + l.expected_value, 0);
  const wonValue = leadRows.filter((l) => l.status === "Won").reduce((t, l) => t + l.expected_value, 0);

  const details: [string, string][] = [
    ["Email", e.email ?? "—"],
    ["Phone", e.phone ?? "—"],
    ["Department", e.department ?? "—"],
    ["Job title", e.job_title ?? "—"],
    ["Hired", fmtDate(e.hired_on)],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-nx-rise">
      {back}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{e.full_name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`size-2 rounded-full ${DOT[e.status]}`} />
            {EMPLOYEE_STATUS_LABEL[e.status]}
            {e.job_title && <span>· {e.job_title}</span>}
          </p>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Open leads", String(openLeads.length)],
          ["Open pipeline", money(openValue)],
          ["Won value", money(wonValue)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card/60 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card/60 p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold">Details</h2>
          <dl className="mt-3 space-y-3">
            {details.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="text-sm">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <EmployeeCompensation orgId={orgId} employeeId={employeeId} />

          <div className="rounded-lg border border-border bg-card/60">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Assigned leads</h2>
              <Link to="/crm/leads" className="text-xs text-muted-foreground hover:text-foreground">
                Open pipeline
              </Link>
            </div>
            {leads.error ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{(leads.error as Error).message}</p>
            ) : leadRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No leads assigned.</p>
            ) : (
              <ul className="divide-y divide-border">
                {leadRows.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      {l.company && <p className="truncate text-xs text-muted-foreground">{l.company}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium">{money(l.expected_value)}</p>
                      <p className="text-xs text-muted-foreground">{l.status}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card/60">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Recent activity</h2>
            </div>
            {activity.error ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{(activity.error as Error).message}</p>
            ) : (activity.data ?? []).length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No activity recorded.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(activity.data ?? []).map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    <p className="text-sm">{a.description ?? a.action}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <EmployeeFormDialog
        open={open}
        onOpenChange={setOpen}
        orgId={orgId}
        employee={e}
        onDeleted={() => void navigate({ to: "/employees" })}
      />
    </div>
  );
}