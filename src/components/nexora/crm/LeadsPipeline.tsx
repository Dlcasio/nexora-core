"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ---------- Types & constants ---------- */

export const STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"] as const;
export type LeadStatus = (typeof STATUSES)[number];

export const SOURCES = ["Website", "Referral", "Facebook", "LinkedIn", "Cold Call", "Email", "Event", "Other"] as const;
export type LeadSource = (typeof SOURCES)[number];

type Employee = { id: string; full_name: string };

type Lead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: LeadSource;
  assigned_to: string | null;
  expected_value: number;
  notes: string | null;
  created_at: string;
  employee?: Employee | null;
};

type FormState = {
  name: string;
  company: string;
  email: string;
  phone: string;
  status: LeadStatus;
  source: LeadSource;
  assigned_to: string;
  expected_value: string;
  notes: string;
};

const emptyForm: FormState = {
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

const STATUS_STYLES: Record<LeadStatus, { dot: string; badge: string }> = {
  New: { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700" },
  Contacted: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700" },
  Qualified: { dot: "bg-violet-500", badge: "bg-violet-100 text-violet-700" },
  Proposal: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
  Won: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  Lost: { dot: "bg-rose-500", badge: "bg-rose-100 text-rose-700" },
};

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

/* ---------- Component ---------- */

export default function LeadsPipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);

  /* ----- Data ----- */

  const load = useCallback(async () => {
    setError(null);
    const [leadsRes, empRes] = await Promise.all([
      supabase
        .from("leads")
        .select("*, employee:employees(id, full_name)")
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("id, full_name").order("full_name"),
    ]);
    if (leadsRes.error) setError(leadsRes.error.message);
    else setLeads((leadsRes.data ?? []) as unknown as Lead[]);
    if (empRes.error) setError(empRes.error.message);
    else setEmployees(empRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ----- Derived ----- */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filterSource && l.source !== filterSource) return false;
      if (filterAssignee === "unassigned" && l.assigned_to) return false;
      if (filterAssignee && filterAssignee !== "unassigned" && l.assigned_to !== filterAssignee) return false;
      if (!q) return true;
      return [l.name, l.company, l.email, l.phone].some((v) => v?.toLowerCase().includes(q));
    });
  }, [leads, search, filterSource, filterAssignee]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map((s) => [s, [] as Lead[]])) as Record<LeadStatus, Lead[]>;
    filtered.forEach((l) => map[l.status]?.push(l));
    return map;
  }, [filtered]);

  const openValue = filtered
    .filter((l) => l.status !== "Won" && l.status !== "Lost")
    .reduce((sum, l) => sum + Number(l.expected_value), 0);
  const wonValue = filtered.filter((l) => l.status === "Won").reduce((s, l) => s + Number(l.expected_value), 0);

  /* ----- Actions ----- */

  function openCreate(status: LeadStatus = "New") {
    setEditingId(null);
    setForm({ ...emptyForm, status });
    setModalOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditingId(lead.id);
    setForm({
      name: lead.name,
      company: lead.company ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      status: lead.status,
      source: lead.source,
      assigned_to: lead.assigned_to ?? "",
      expected_value: String(lead.expected_value ?? 0),
      notes: lead.notes ?? "",
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      status: form.status,
      source: form.source,
      assigned_to: form.assigned_to || null,
      expected_value: Math.max(0, Number(form.expected_value) || 0),
      notes: form.notes.trim() || null,
    };

    const { error } = editingId
      ? await supabase.from("leads").update(payload).eq("id", editingId)
      : await supabase.from("leads").insert(payload);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete(lead: Lead) {
    if (!window.confirm(`Delete lead "${lead.name}"? This cannot be undone.`)) return;
    const prev = leads;
    setLeads((ls) => ls.filter((l) => l.id !== lead.id));
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) {
      setLeads(prev);
      setError(error.message);
    }
  }

  async function changeStatus(id: string, status: LeadStatus) {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) {
      setLeads(prev);
      setError(error.message);
    }
  }

  /* ----- Render helpers ----- */

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const LeadCard = ({ lead }: { lead: Lead }) => (
    <div
      draggable
      onDragStart={() => setDragId(lead.id)}
      onDragEnd={() => {
        setDragId(null);
        setDragOver(null);
      }}
      className={`group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing ${
        dragId === lead.id ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{lead.name}</p>
          {lead.company && <p className="truncate text-xs text-slate-500">{lead.company}</p>}
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
          <button onClick={() => openEdit(lead)} className="rounded p-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Edit lead">
            Edit
          </button>
          <button onClick={() => handleDelete(lead)} className="rounded p-1 text-xs text-rose-500 hover:bg-rose-50" aria-label="Delete lead">
            Delete
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-slate-800">{money.format(Number(lead.expected_value))}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span className="rounded bg-slate-100 px-1.5 py-0.5">{lead.source}</span>
        <span className="truncate pl-2">{lead.employee?.full_name ?? "Unassigned"}</span>
      </div>
      {lead.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{lead.notes}</p>}
    </div>
  );

  const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  /* ----- UI ----- */

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            {filtered.length} leads · Open pipeline {money.format(openValue)} · Won {money.format(wonValue)}
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + New lead
        </button>
      </div>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, email, phone…"
          className={`${inputCls} max-w-xs`}
        />
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className={`${inputCls} max-w-[160px]`}>
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className={`${inputCls} max-w-[180px]`}>
          <option value="">All employees</option>
          <option value="unassigned">Unassigned</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name}
            </option>
          ))}
        </select>
        <div className="ml-auto inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
          {(["pipeline", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 capitalize ${view === v ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-center text-sm text-slate-500">Loading leads…</p>
      ) : view === "pipeline" ? (
        /* ---------- Pipeline ---------- */
        <div className="mt-4 flex gap-3 overflow-x-auto pb-4">
          {STATUSES.map((status) => {
            const items = byStatus[status];
            const total = items.reduce((s, l) => s + Number(l.expected_value), 0);
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
                onDrop={() => {
                  if (dragId) changeStatus(dragId, status);
                  setDragId(null);
                  setDragOver(null);
                }}
                className={`flex w-72 shrink-0 flex-col rounded-xl border bg-slate-50 p-2 transition ${
                  dragOver === status ? "border-blue-400 bg-blue-50/60" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[status].dot}`} />
                    <span className="text-sm font-semibold text-slate-800">{status}</span>
                    <span className="rounded-full bg-white px-2 text-xs text-slate-500 shadow-sm">{items.length}</span>
                  </div>
                  <button onClick={() => openCreate(status)} className="rounded px-1.5 text-lg leading-none text-slate-400 hover:bg-white hover:text-slate-700" aria-label={`Add lead to ${status}`}>
                    +
                  </button>
                </div>
                <p className="px-2 pb-2 text-xs text-slate-500">{money.format(total)}</p>
                <div className="flex min-h-[80px] flex-1 flex-col gap-2">
                  {items.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                      Drop leads here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ---------- List ---------- */
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3 text-right">Expected value</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{lead.name}</p>
                    <p className="text-xs text-slate-500">{lead.company ?? lead.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => changeStatus(lead.id, e.target.value as LeadStatus)}
                      className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[lead.status].badge}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{lead.source}</td>
                  <td className="px-4 py-3 text-slate-600">{lead.employee?.full_name ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{money.format(Number(lead.expected_value))}</td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-slate-500">{lead.notes ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button onClick={() => openEdit(lead)} className="mr-3 text-slate-600 hover:text-slate-900">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(lead)} className="text-rose-500 hover:text-rose-700">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No leads found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Create / Edit modal ---------- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !saving && setModalOpen(false)}>
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-slate-900">{editingId ? "Edit lead" : "New lead"}</h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600">Name *</span>
                <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">Company</span>
                <input value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">Phone</span>
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
                <select value={form.status} onChange={(e) => set("status", e.target.value as LeadStatus)} className={inputCls}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">Source</span>
                <select value={form.source} onChange={(e) => set("source", e.target.value as LeadSource)} className={inputCls}>
                  {SOURCES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">Assigned employee</span>
                <select value={form.assigned_to} onChange={(e) => set("assigned_to", e.target.value)} className={inputCls}>
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">Expected value (PHP)</span>
                <input type="number" min={0} step="0.01" value={form.expected_value} onChange={(e) => set("expected_value", e.target.value)} className={inputCls} />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
                <textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inputCls} />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? "Saving…" : editingId ? "Save changes" : "Create lead"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}