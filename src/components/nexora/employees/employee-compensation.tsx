import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/hooks/use-permissions";
import {
  PAY_FREQUENCIES,
  PAY_FREQUENCY_LABEL,
  summarizeCash,
  useAddCashEntry,
  useCashEntries,
  useCompensation,
  useDeleteCashEntry,
  useSaveCompensation,
  type CashEntryType,
  type PayFrequency,
} from "@/lib/compensation";
import { money } from "@/lib/products";

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

/** Shown only to people with Finance access. Renders nothing for everyone else. */
export function EmployeeCompensation(props: { orgId: string | undefined; employeeId: string }) {
  const perms = usePermissions();
  if (!perms.can("finance", "view")) return null;
  return <Inner {...props} canManage={perms.can("finance", "manage")} />;
}

function Inner({ orgId, employeeId, canManage }: { orgId: string | undefined; employeeId: string; canManage: boolean }) {
  const comp = useCompensation(orgId, employeeId);
  const entries = useCashEntries(orgId, employeeId);
  const saveComp = useSaveCompensation(orgId, employeeId);
  const addEntry = useAddCashEntry(orgId, employeeId);
  const delEntry = useDeleteCashEntry(orgId, employeeId);

  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salary, setSalary] = useState("0");
  const [frequency, setFrequency] = useState<PayFrequency>("monthly");
  const [salaryError, setSalaryError] = useState<string | null>(null);

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<CashEntryType>("advance");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(today());
  const [reason, setReason] = useState("");
  const [entryError, setEntryError] = useState<string | null>(null);

  const rows = entries.data ?? [];
  const totals = summarizeCash(rows);

  function openSalary() {
    setSalary(String(comp.data?.base_salary ?? 0));
    setFrequency(comp.data?.pay_frequency ?? "monthly");
    setSalaryError(null);
    setSalaryOpen(true);
  }

  function submitSalary(ev: React.FormEvent) {
    ev.preventDefault();
    const value = Number(salary);
    if (!(value >= 0)) {
      setSalaryError("Enter a salary of 0 or more.");
      return;
    }
    setSalaryError(null);
    saveComp.mutate(
      { base_salary: value, pay_frequency: frequency },
      { onSuccess: () => setSalaryOpen(false), onError: (e) => setSalaryError((e as Error).message) },
    );
  }

  function openEntry(type: CashEntryType) {
    setEntryType(type);
    setAmount("");
    setEntryDate(today());
    setReason("");
    setEntryError(null);
    setEntryOpen(true);
  }

  function submitEntry(ev: React.FormEvent) {
    ev.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) {
      setEntryError("Enter an amount greater than 0.");
      return;
    }
    setEntryError(null);
    addEntry.mutate(
      { entry_type: entryType, amount: value, entry_date: entryDate, reason },
      { onSuccess: () => setEntryOpen(false), onError: (e) => setEntryError((e as Error).message) },
    );
  }

  function removeEntry(id: string) {
    if (!window.confirm("Delete this ledger entry? This cannot be undone.")) return;
    delEntry.mutate(id);
  }

  const loadError = (comp.error ?? entries.error) as Error | null;

  return (
    <div className="rounded-lg border border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Compensation</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Finance only</span>
      </div>

      {loadError && <p className="px-4 pt-4 text-sm text-destructive">{loadError.message}</p>}

      {/* Salary */}
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <div>
          <p className="text-xs text-muted-foreground">Base salary</p>
          {comp.data ? (
            <p className="text-lg font-semibold">
              {money(comp.data.base_salary)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · {PAY_FREQUENCY_LABEL[comp.data.pay_frequency]}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Not set</p>
          )}
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={openSalary}>
            {comp.data ? "Edit salary" : "Set salary"}
          </Button>
        )}
      </div>

      {/* Cash advance totals */}
      <div className="grid grid-cols-1 gap-3 border-t border-border px-4 py-4 sm:grid-cols-3">
        {[
          ["Total advanced", money(totals.advanced)],
          ["Total repaid", money(totals.repaid)],
          ["Outstanding balance", money(totals.balance)],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-base font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Ledger */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Cash advance ledger</h3>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => openEntry("advance")}>
              <Plus className="size-4" /> Advance
            </Button>
            <Button size="sm" variant="outline" onClick={() => openEntry("repayment")}>
              <Plus className="size-4" /> Repayment
            </Button>
          </div>
        )}
      </div>

      {delEntry.error && <p className="px-4 pb-2 text-sm text-destructive">{(delEntry.error as Error).message}</p>}

      {rows.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-muted-foreground">No cash advances recorded.</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <span className={r.entry_type === "advance" ? "text-amber-600" : "text-emerald-600"}>
                    {r.entry_type === "advance" ? "Advance" : "Repayment"}
                  </span>
                  {r.reason && <span className="text-muted-foreground"> · {r.reason}</span>}
                </p>
                <p className="text-xs text-muted-foreground">{fmtDate(r.entry_date)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="text-sm font-medium">
                  {r.entry_type === "advance" ? "+" : "−"}
                  {money(r.amount)}
                </p>
                {canManage && (
                  <button
                    onClick={() => removeEntry(r.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Salary dialog */}
      <Dialog open={salaryOpen} onOpenChange={(o) => !saveComp.isPending && setSalaryOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Base salary</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSalary} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="comp-salary">Amount</Label>
              <Input id="comp-salary" type="number" min={0} step="0.01" required value={salary} onChange={(e) => setSalary(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp-freq">Pay frequency</Label>
              <select id="comp-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as PayFrequency)} className={selectCls}>
                {PAY_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {PAY_FREQUENCY_LABEL[f]}
                  </option>
                ))}
              </select>
            </div>
            {salaryError && <p className="text-sm text-destructive">{salaryError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={saveComp.isPending} onClick={() => setSalaryOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveComp.isPending}>
                {saveComp.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ledger entry dialog */}
      <Dialog open={entryOpen} onOpenChange={(o) => !addEntry.isPending && setEntryOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{entryType === "advance" ? "Record cash advance" : "Record repayment"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEntry} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cash-amount">Amount</Label>
              <Input id="cash-amount" type="number" min={0.01} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cash-date">Date</Label>
              <Input id="cash-date" type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cash-reason">{entryType === "advance" ? "Reason" : "Note"} (optional)</Label>
              <Input id="cash-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {entryError && <p className="text-sm text-destructive">{entryError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={addEntry.isPending} onClick={() => setEntryOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addEntry.isPending}>
                {addEntry.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}