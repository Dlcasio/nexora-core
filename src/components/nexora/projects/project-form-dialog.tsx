import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEmployeeList } from "@/lib/employees";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  useCustomerOptions,
  useDeleteProject,
  useSaveProject,
  type ProjectInput,
  type ProjectRecord,
  type ProjectStatus,
} from "@/lib/projects";

const emptyForm: ProjectInput = {
  name: "",
  description: "",
  status: "planning",
  budget: "",
  start_date: "",
  due_date: "",
  customer_id: "",
  owner_employee_id: "",
};

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ProjectFormDialog({
  open,
  onOpenChange,
  orgId,
  project,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | undefined;
  project?: ProjectRecord | null;
  onDeleted?: () => void;
}) {
  const save = useSaveProject(orgId);
  const del = useDeleteProject(orgId);
  const customers = useCustomerOptions(orgId);
  const employees = useEmployeeList(orgId);

  const [form, setForm] = useState<ProjectInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      project
        ? {
            name: project.name,
            description: project.description ?? "",
            status: project.status,
            budget: project.budget === null ? "" : String(project.budget),
            start_date: project.start_date ?? "",
            due_date: project.due_date ?? "",
            customer_id: project.customer_id ?? "",
            owner_employee_id: project.owner_employee_id ?? "",
          }
        : emptyForm,
    );
  }, [open, project]);

  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Owners: active staff, plus whoever is already the owner
  const owners = (employees.data ?? []).filter(
    (e) => e.status !== "terminated" || e.id === form.owner_employee_id,
  );

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.name.trim()) return;
    if (form.start_date && form.due_date && form.due_date < form.start_date) {
      setError("The due date can't be before the start date.");
      return;
    }
    setError(null);
    save.mutate(
      { id: project?.id, values: form },
      { onSuccess: () => onOpenChange(false), onError: (e) => setError((e as Error).message) },
    );
  }

  function remove() {
    if (!project) return;
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    del.mutate(project.id, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
      },
      onError: (e) => setError((e as Error).message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="prj-name">Name *</Label>
            <Input id="prj-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="prj-desc">Description</Label>
            <Textarea id="prj-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prj-status">Status</Label>
            <select id="prj-status" value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)} className={selectCls}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prj-budget">Budget</Label>
            <Input id="prj-budget" type="number" min={0} step="0.01" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prj-customer">Customer</Label>
            <select id="prj-customer" value={form.customer_id} onChange={(e) => set("customer_id", e.target.value)} className={selectCls}>
              <option value="">No customer</option>
              {(customers.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prj-owner">Owner</Label>
            <select id="prj-owner" value={form.owner_employee_id} onChange={(e) => set("owner_employee_id", e.target.value)} className={selectCls}>
              <option value="">No owner</option>
              {owners.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prj-start">Start date</Label>
            <Input id="prj-start" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prj-due">Due date</Label>
            <Input id="prj-due" type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}

          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            {project ? (
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
                {save.isPending ? "Saving…" : project ? "Save changes" : "Create project"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}