import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { RequirePermission } from "@/components/nexora/permission-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import { useEmployeeList } from "@/lib/employees";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  useDeleteLead,
  useLeadList,
  useMoveLead,
  useSaveLead,
  type LeadInput,
  type LeadRecord,
  type LeadSource,
  type LeadStatus,
} from "@/lib/leads";
import { money } from "@/lib/products";

const DOT: Record<LeadStatus, string> = {
  New: "bg-slate-400",
  Contacted: "bg-blue-500",
  Qualified: "bg-violet-500",
  Proposal: "bg-amber-500",
  Won: "bg-emerald-500",
  Lost: "bg-rose-500",
};

const emptyForm: LeadInput = {
  name: "",
  company: "",
  email: "",
  phone: "",
  status: "New",
  source: "Website",
  assigned_to: "",
  expected_value: "0",
  notes: "",
};

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LeadsPage() {
  return (
    <RequirePermission module="crm">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const canManage = usePermissions().can("crm", "manage");

  const list = useLeadList(orgId);
  const employees = useEmployeeList(orgId);
  const save = useSaveLead(orgId);
  const move = useMoveLead(orgId);
  const del = useDeleteLead(orgId);

  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState<LeadInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);

  const people = useMemo(
    () =>
      (employees.data ?? []).map((e) => ({
        id: e.id,
        name: e.status === "terminated" ? `${e.full_name} (former)` : e.full_name,
      })),
    [employees.data],
  );
  const nameOf = (id: string | null) => (id ? (people.find((p) => p.id === id)?.name ?? "Unknown") : "Unassigned");

  const leads = list.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filterSource && l.source !== filterSource) return false;
      if (filterAssignee === "unassigned" && l.assigned_to) return false;
      if (filterAssignee && filterAssignee !== "unassigned" && l.assigned_to !== filterAssignee) return false;
      if (!q) return true;
      return [l.name, l.company, l.email, l.phone].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [leads, search, filterSource, filterAssignee]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(LEAD_STATUSES.map((s) => [s, [] as LeadRecord[]])) as Record<LeadStatus, LeadRecord[]>;
    filtered.forEach((l) => map[l.status]?.push(l));
    return map;
  }, [filtered]);

  const openValue = filtered
    .filter((l) => l.status !== "Won" && l.status !== "Lost")
    .reduce((t, l) => t + l.expected_value, 0);
  const wonValue = filtered.filter((l) => l.status === "Won").reduce((t, l) => t + l.expected_value, 0);

  function openCreate(status: LeadStatus = "New") {
    setEditingId(undefined);
    setForm({ ...emptyForm, status });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(l: LeadRecord) {
    setEditingId(l.id);
    setForm({
      name: l.name,
      company: l.company ?? "",
      email: l.email ?? "",
      phone: l.phone ?? "",
      status: l.status,
      source: l.source,
      assigned_to: l.assigned_to ?? "",
      expected_value: String(l.expected_value),
      notes: l.notes ?? "",
    });
    setFormError(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setFormError(null);
    save.mutate(
      { id: editingId, values: form },
      {
        onSuccess: () => setOpen(false),
        onError: (err) => setFormError((err as Error).message),
      },
    );
  }

  function remove(l: LeadRecord) {
    if (!window.confirm(`Delete lead "${l.name}"? This cannot be undone.`)) return;
    del.mutate(l.id);
  }

  const set = <K extends keyof LeadInput>(k: K, v: LeadInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const actionError = (move.error ?? del.error) as Error | null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 animate-nx-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">03 · CRM</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} leads · {money(openValue)} open pipeline · {money(wonValue)} won
          </p>
        </div>
        {canManage && (
          <Button onClick={() => openCreate()}>
            <Plus className="size-4" /> Add lead
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, email, phone…"
          className="max-w-xs"
        />
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className={`${selectCls} max-w-[160px]`}>
          <option value="">All sources</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className={`${selectCls} max-w-[200px]`}>
          <option value="">All employees</option>
          <option value="unassigned">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="ml-auto inline-flex overflow-hidden rounded-md border border-border text-sm">
          {(["pipeline", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 capitalize ${view === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {(list.error || actionError) && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {((list.error ?? actionError) as Error).message}
        </div>
      )}

      {list.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading leads…</p>
      ) : view === "pipeline" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {LEAD_STATUSES.map((status) => {
            const items = byStatus[status];
            const total = items.reduce((t, l) => t + l.expected_value, 0);
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  if (!canManage) return;
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
                onDrop={() => {
                  if (canManage && dragId) move.mutate({ id: dragId, status });
                  setDragId(null);
                  setDragOver(null);
                }}
                className={`flex w-72 shrink-0 flex-col rounded-lg border bg-card/60 p-2 transition ${
                  dragOver === status ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${DOT[status]}`} />
                    <span className="text-sm font-semibold">{status}</span>
                    <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => openCreate(status)}
                      className="rounded px-1.5 text-lg leading-none text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`Add lead to ${status}`}
                    >
                      +
                    </button>
                  )}
                </div>
                <p className="px-2 pb-2 font-mono text-xs text-muted-foreground">{money(total)}</p>
                <div className="flex min-h-[80px] flex-1 flex-col gap-2">
                  {items.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      assignee={nameOf(l.assigned_to)}
                      canManage={canManage}
                      dragging={dragId === l.id}
                      onDragStart={() => setDragId(l.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOver(null);
                      }}
                      onEdit={() => openEdit(l)}
                      onDelete={() => remove(l)}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      {canManage ? "Drop leads here" : "No leads"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card/60">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Assigned</th>
                <th className="px-4 py-3 text-right font-medium">Expected value</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.company ?? l.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        value={l.status}
                        onChange={(e) => move.mutate({ id: l.id, status: e.target.value as LeadStatus })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-xs">
                        <span className={`size-2 rounded-full ${DOT[l.status]}`} />
                        {l.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.source}</td>
                  <td className="px-4 py-3 text-muted-foreground">{nameOf(l.assigned_to)}</td>
                  <td className="px-4 py-3 text-right font-medium">{money(l.expected_value)}</td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-muted-foreground">{l.notes ?? "—"}</td>
                  {canManage && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => openEdit(l)} className="mr-3 text-muted-foreground hover:text-foreground">
                        Edit
                      </button>
                      <button onClick={() => remove(l)} className="text-destructive hover:underline">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {leads.length ? "No leads match your filters." : "No leads yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => !save.isPending && setOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit lead" : "New lead"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lead-name">Name *</Label>
              <Input id="lead-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-company">Company</Label>
              <Input id="lead-company" value={form.company} onChange={(e) => set("company", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input id="lead-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-status">Status</Label>
              <select id="lead-status" value={form.status} onChange={(e) => set("status", e.target.value as LeadStatus)} className={selectCls}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-source">Source</Label>
              <select id="lead-source" value={form.source} onChange={(e) => set("source", e.target.value as LeadSource)} className={selectCls}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-assignee">Assigned employee</Label>
              <select id="lead-assignee" value={form.assigned_to} onChange={(e) => set("assigned_to", e.target.value)} className={selectCls}>
                <option value="">Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-value">Expected value</Label>
              <Input
                id="lead-value"
                type="number"
                min={0}
                step="0.01"
                value={form.expected_value}
                onChange={(e) => set("expected_value", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea id="lead-notes" rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>

            {formError && <p className="text-sm text-destructive sm:col-span-2">{formError}</p>}

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : editingId ? "Save changes" : "Create lead"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadCard(props: {
  lead: LeadRecord;
  assignee: string;
  canManage: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { lead, assignee, canManage, dragging } = props;
  return (
    <div
      draggable={canManage}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      className={`group rounded-md border border-border bg-card p-3 shadow-sm transition hover:shadow-md ${
        canManage ? "cursor-grab active:cursor-grabbing" : ""
      } ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{lead.name}</p>
          {lead.company && <p className="truncate text-xs text-muted-foreground">{lead.company}</p>}
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2 text-xs opacity-0 transition group-hover:opacity-100">
            <button onClick={props.onEdit} className="text-muted-foreground hover:text-foreground">
              Edit
            </button>
            <button onClick={props.onDelete} className="text-destructive hover:underline">
              Delete
            </button>
          </div>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold">{money(lead.expected_value)}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5">{lead.source}</span>
        <span className="truncate pl-2">{assignee}</span>
      </div>
      {lead.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{lead.notes}</p>}
    </div>
  );
}