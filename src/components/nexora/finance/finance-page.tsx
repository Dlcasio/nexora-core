import { Plus, Receipt } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DataTable, type Column } from "@/components/nexora/data/data-table";
import { DataToolbar, FilterSelect, SearchInput } from "@/components/nexora/data/data-toolbar";
import { RequirePermission } from "@/components/nexora/permission-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  useDeleteExpense,
  useExpenseList,
  useFinanceSummary,
  useSaveExpense,
  type ExpenseInput,
  type ExpenseRecord,
} from "@/lib/finance";
import { money } from "@/lib/products";

type Preset = "this_month" | "last_month" | "last_30" | "this_year" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_30", label: "Last 30 days" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

const iso = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};

function rangeFor(preset: Exclude<Preset, "custom">) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "last_month":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "last_30":
      return { from: iso(new Date(y, m, now.getDate() - 29)), to: iso(now) };
    case "this_year":
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
    default:
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  }
}

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function FinancePage() {
  return (
    <RequirePermission module="finance">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const canManage = usePermissions().can("finance", "manage");

  const [preset, setPreset] = useState<Preset>("this_month");
  const initial = rangeFor("this_month");
  const [customFrom, setCustomFrom] = useState(initial.from);
  const [customTo, setCustomTo] = useState(initial.to);
  const range = preset === "custom" ? { from: customFrom, to: customTo } : rangeFor(preset);
  const validRange = !!range.from && !!range.to && range.from <= range.to;

  const expenses = useExpenseList(orgId, range.from, range.to, validRange);
  const summary = useFinanceSummary(orgId, range.from, range.to, validRange);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);

  const all = expenses.data ?? [];

  const categories = useMemo(
    () => Array.from(new Set([...DEFAULT_EXPENSE_CATEGORIES, ...all.map((e) => e.category)])).sort(),
    [all],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (e) =>
        (!q || [e.category, e.description].some((v) => (v ?? "").toLowerCase().includes(q))) &&
        (category === "all" || e.category === category),
    );
  }, [all, search, category]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    all.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [all]);
  const expenseTotal = all.reduce((t, e) => t + e.amount, 0);

  const s = summary.data;
  const cards: { label: string; value: string; tone?: string }[] = [
    { label: "Revenue", value: s ? money(s.revenue) : "—" },
    { label: "Expenses", value: s ? money(s.expenses) : "—" },
    { label: "Purchases", value: s ? money(s.purchases) : "—" },
    { label: "Profit", value: s ? money(s.profit) : "—", tone: s && s.profit < 0 ? "text-destructive" : "" },
    { label: "Cash advances owed", value: s ? money(s.advancesOutstanding) : "—" },
  ];

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(e: ExpenseRecord) {
    setEditing(e);
    setDialogOpen(true);
  }

  const columns: Column<ExpenseRecord>[] = [
    {
      key: "date",
      header: "Date",
      cell: (e) => <span className="text-sm text-muted-foreground">{fmtDate(e.incurred_on)}</span>,
    },
    { key: "category", header: "Category", cell: (e) => <span className="text-sm font-medium">{e.category}</span> },
    {
      key: "description",
      header: "Description",
      className: "hidden md:table-cell",
      cell: (e) => <span className="text-sm text-muted-foreground">{e.description ?? "—"}</span>,
    },
    { key: "amount", header: "Amount", align: "right", cell: (e) => <span className="font-medium">{money(e.amount)}</span> },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-nx-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">06 · Finance</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {validRange ? `${fmtDate(range.from)} – ${fmtDate(range.to)}` : "Choose a valid date range."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {preset === "custom" && (
            <>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
            </>
          )}
          {canManage && (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Add expense
            </Button>
          )}
        </div>
      </div>

      {summary.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(summary.error as Error).message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card/60 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-xl font-semibold ${c.tone ?? ""}`}>{c.value}</p>
          </div>
        ))}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Revenue is completed sales. Purchases are received purchase orders. Profit = revenue − expenses − purchases.
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card/60 lg:col-span-2">
          <DataToolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search category or description…" />
            <FilterSelect
              label="Category"
              value={category}
              onChange={setCategory}
              options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
          </DataToolbar>
          <DataTable
            columns={columns}
            rows={rows}
            loading={expenses.isLoading}
            error={expenses.error ? (expenses.error as Error).message : null}
            onRowClick={canManage ? openEdit : undefined}
            empty={
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Receipt className="size-5" />
                <p className="text-sm">{all.length ? "No expenses match your filters." : "No expenses in this period."}</p>
              </div>
            }
          />
        </div>

        <div className="h-fit rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-semibold">Expenses by category</h2>
          {byCategory.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing to show yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {byCategory.map(([name, total]) => (
                <li key={name}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{name}</span>
                    <span className="font-medium">{money(total)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${expenseTotal > 0 ? Math.max(2, (total / expenseTotal) * 100) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={orgId}
        expense={editing}
        categories={categories}
      />
    </div>
  );
}

const today = () => iso(new Date());

function ExpenseDialog({
  open,
  onOpenChange,
  orgId,
  expense,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | undefined;
  expense: ExpenseRecord | null;
  categories: string[];
}) {
  const save = useSaveExpense(orgId);
  const del = useDeleteExpense(orgId);
  const [form, setForm] = useState<ExpenseInput>({ category: "", description: "", amount: "", incurred_on: today() });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      expense
        ? {
            category: expense.category,
            description: expense.description ?? "",
            amount: String(expense.amount),
            incurred_on: expense.incurred_on,
          }
        : { category: "", description: "", amount: "", incurred_on: today() },
    );
  }, [open, expense]);

  const set = <K extends keyof ExpenseInput>(k: K, v: ExpenseInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.category.trim()) {
      setError("Enter a category.");
      return;
    }
    if (!(Number(form.amount) > 0)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setError(null);
    save.mutate(
      { id: expense?.id, values: form },
      { onSuccess: () => onOpenChange(false), onError: (e) => setError((e as Error).message) },
    );
  }

  function remove() {
    if (!expense) return;
    if (!window.confirm("Delete this expense? This cannot be undone.")) return;
    del.mutate(expense.id, {
      onSuccess: () => onOpenChange(false),
      onError: (e) => setError((e as Error).message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "New expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="exp-date">Date</Label>
            <Input id="exp-date" type="date" required value={form.incurred_on} onChange={(e) => set("incurred_on", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">Amount</Label>
            <Input id="exp-amount" type="number" min={0.01} step="0.01" required value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="exp-category">Category</Label>
            <Input id="exp-category" list="exp-category-options" required value={form.category} onChange={(e) => set("category", e.target.value)} />
            <datalist id="exp-category-options">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="exp-desc">Description (optional)</Label>
            <Input id="exp-desc" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}

          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            {expense ? (
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
                {save.isPending ? "Saving…" : expense ? "Save changes" : "Add expense"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}