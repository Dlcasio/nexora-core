import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_LABEL,
  useDeleteEmployee,
  useSaveEmployee,
  type EmployeeInput,
  type EmployeeRecord,
  type EmployeeStatus,
} from "@/lib/employees";

const emptyForm: EmployeeInput = {
  full_name: "",
  email: "",
  phone: "",
  department: "",
  job_title: "",
  status: "active",
  hired_on: "",
};

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EmployeeFormDialog({
  open,
  onOpenChange,
  orgId,
  employee,
  departments = [],
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | undefined;
  employee?: EmployeeRecord | null;
  departments?: string[];
  onDeleted?: () => void;
}) {
  const save = useSaveEmployee(orgId);
  const del = useDeleteEmployee(orgId);
  const [form, setForm] = useState<EmployeeInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  // Load the employee (or a blank form) each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      employee
        ? {
            full_name: employee.full_name,
            email: employee.email ?? "",
            phone: employee.phone ?? "",
            department: employee.department ?? "",
            job_title: employee.job_title ?? "",
            status: employee.status,
            hired_on: employee.hired_on ?? "",
          }
        : emptyForm,
    );
  }, [open, employee]);

  const set = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.full_name.trim()) return;
    setError(null);
    save.mutate(
      { id: employee?.id, values: form },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError((err as Error).message),
      },
    );
  }

  function remove() {
    if (!employee) return;
    if (!window.confirm(`Delete ${employee.full_name}? Leads assigned to them become unassigned.`)) return;
    del.mutate(employee.id, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
      },
      onError: (err) => setError((err as Error).message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "New employee"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="emp-name">Full name *</Label>
            <Input id="emp-name" required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-email">Email</Label>
            <Input id="emp-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-phone">Phone</Label>
            <Input id="emp-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-dept">Department</Label>
            <Input
              id="emp-dept"
              list="emp-dept-options"
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
            />
            <datalist id="emp-dept-options">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-title">Job title</Label>
            <Input id="emp-title" value={form.job_title} onChange={(e) => set("job_title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-status">Status</Label>
            <select
              id="emp-status"
              value={form.status}
              onChange={(e) => set("status", e.target.value as EmployeeStatus)}
              className={selectCls}
            >
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {EMPLOYEE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-hired">Hire date</Label>
            <Input id="emp-hired" type="date" value={form.hired_on} onChange={(e) => set("hired_on", e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}

          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            {employee ? (
              <Button type="button" variant="ghost" className="text-destructive" disabled={save.isPending || del.isPending} onClick={remove}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : employee ? "Save changes" : "Add employee"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}