import { Pencil, Plus, Trash2 } from "lucide-react";
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
  useDeletePayItem,
  usePayItems,
  useSaveCompensation,
  useSavePayItem,
  type CashEntryType,
  type PayFrequency,
  type PayItem,
  type PayItemKind,
} from "@/lib/compensation";
import { RATES, estimatePay } from "@/lib/payroll";
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

type Flags = { apply_sss: boolean; apply_philhealth: boolean; apply_pagibig: boolean; apply_tax: boolean };
const defaultFlags: Flags = { apply_sss: true, apply_philhealth: true, apply_pagibig: true, apply_tax: true };
const FLAG_LABELS: [keyof Flags, string][] = [
  ["apply_sss", "SSS"],
  ["apply_philhealth", "PhilHealth"],
  ["apply_pagibig", "Pag-IBIG"],
  ["apply_tax", "Withholding tax"],
];

/** Shown only to people with Finance access. Renders nothing for everyone else. */
export function EmployeeCompensation(props: { orgId: string | undefined; employeeId: string }) {
  const perms = usePermissions();
  if (!perms.can("finance", "view")) return null;
  return <Inner {...props} canManage={perms.can("finance", "manage")} />;
}

function Inner({ orgId, employeeId, canManage }: { orgId: string | undefined; employeeId: string; canManage: boolean }) {
  const comp = useCompensation(orgId, employeeId);
  const items = usePayItems(orgId, employeeId);
  const entries = useCashEntries(orgId, employeeId);
  const saveComp = useSaveCompensation(orgId, employeeId);
  const savePayItem = useSavePayItem(orgId, employeeId);
  const delPayItem = useDeletePayItem(orgId, employeeId);
  const addEntry = useAddCashEntry(orgId, employeeId);
  const delEntry = useDeleteCashEntry(orgId, employeeId);

  // Salary and payroll settings dialog
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salary, setSalary] = useState("0");
  const [frequency, setFrequency] = useState<PayFrequency>("monthly");
  const [flags, setFlags] = useState<Flags>(defaultFlags);
  const [caDeduction, setCaDeduction] = useState("0");
  const [salaryError, setSalaryError] = useState<string | null>(null);

  // Benefit / deduction dialog
  const [itemOpen, setItemOpen] = useState(false);
  const [itemId, setItemId] = useState<string | undefined>();
  const [itemKind, setItemKind] = useState<PayItemKind>("benefit");
  const [itemName, setItemName] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [itemTaxable, setItemTaxable] = useState(true);
  const [itemActive, setItemActive] = useState(true);
  const [itemError, setItemError] = useState<string | null>(null);

  // Cash advance dialog
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<CashEntryType>("advance");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(today());
  const [reason, setReason] = useState("");
  const [entryError, setEntryError] = useState<string | null>(null);

  const rows = entries.data ?? [];
  const totals = summarizeCash(rows);
  const payItems = items.data ?? [];

  const estimate = comp.data
    ? estimatePay({
        payPerPeriod: comp.data.base_salary,
        frequency: comp.data.pay_frequency,
        items: payItems,
        statutory: {
          sss: comp.data.apply_sss,
          philhealth: comp.data.apply_philhealth,
          pagibig: comp.data.apply_pagibig,
          tax: comp.data.apply_tax,
        },
        cashAdvancePerPeriod: comp.data.cash_advance_deduction,
        cashAdvanceOutstanding: totals.balance,
      })
    : null;

  /* ── salary ── */

  function openSalary() {
    setSalary(String(comp.data?.base_salary ?? 0));
    setFrequency(comp.data?.pay_frequency ?? "monthly");
    setFlags(
      comp.data
        ? {
            apply_sss: comp.data.apply_sss,
            apply_philhealth: comp.data.apply_philhealth,
            apply_pagibig: comp.data.apply_pagibig,
            apply_tax: comp.data.apply_tax,
          }
        : defaultFlags,
    );
    setCaDeduction(String(comp.data?.cash_advance_deduction ?? 0));
    setSalaryError(null);
    setSalaryOpen(true);
  }

  function submitSalary(ev: React.FormEvent) {
    ev.preventDefault();
    const value = Number(salary);
    const ca = Number(caDeduction || 0);
    if (!(value >= 0)) {
      setSalaryError("Enter a salary of 0 or more.");
      return;
    }
    if (!(ca >= 0)) {
      setSalaryError("The cash advance deduction can't be negative.");
      return;
    }
    setSalaryError(null);
    saveComp.mutate(
      { base_salary: value, pay_frequency: frequency, ...flags, cash_advance_deduction: ca },
      { onSuccess: () => setSalaryOpen(false), onError: (e) => setSalaryError((e as Error).message) },
    );
  }

  /* ── benefits and deductions ── */

  function openItem(kind: PayItemKind, item?: PayItem) {
    setItemId(item?.id);
    setItemKind(item?.kind ?? kind);
    setItemName(item?.name ?? "");
    setItemAmount(item ? String(item.amount) : "");
    setItemTaxable(item?.taxable ?? true);
    setItemActive(item?.active ?? true);
    setItemError(null);
    setItemOpen(true);
  }

  function submitItem(ev: React.FormEvent) {
    ev.preventDefault();
    if (!itemName.trim()) {
      setItemError("Enter a name.");
      return;
    }
    if (!(Number(itemAmount) >= 0) || itemAmount === "") {
      setItemError("Enter an amount of 0 or more.");
      return;
    }
    setItemError(null);
    savePayItem.mutate(
      {
        id: itemId,
        values: { kind: itemKind, name: itemName, amount: itemAmount, taxable: itemTaxable, active: itemActive },
      },
      { onSuccess: () => setItemOpen(false), onError: (e) => setItemError((e as Error).message) },
    );
  }

  function removeItem(item: PayItem) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    delPayItem.mutate(item.id);
  }

  /* ── cash advances ── */

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

  const loadError = (comp.error ?? items.error ?? entries.error) as Error | null;
  const actionError = (delPayItem.error ?? delEntry.error) as Error | null;

  const flagState = (on: boolean) => (on ? "On" : "Off");

  return (
    <div className="rounded-lg border border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Compensation</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Finance only</span>
      </div>

      {loadError && <p className="px-4 pt-4 text-sm text-destructive">{loadError.message}</p>}
      {actionError && <p className="px-4 pt-4 text-sm text-destructive">{actionError.message}</p>}

      {/* Pay and settings */}
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <div>
          <p className="text-xs text-muted-foreground">Pay per period</p>
          {comp.data ? (
            <>
              <p className="text-lg font-semibold">
                {money(comp.data.base_salary)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  · {PAY_FREQUENCY_LABEL[comp.data.pay_frequency]}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                SSS {flagState(comp.data.apply_sss)} · PhilHealth {flagState(comp.data.apply_philhealth)} · Pag-IBIG{" "}
                {flagState(comp.data.apply_pagibig)} · Tax {flagState(comp.data.apply_tax)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not set</p>
          )}
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={openSalary}>
            {comp.data ? "Edit pay" : "Set pay"}
          </Button>
        )}
      </div>

      {/* Estimated pay */}
      {estimate && (
        <div className="border-t border-border px-4 py-4">
          <h3 className="text-sm font-semibold">Estimated pay per period</h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            <EstimateRow label="Basic pay" value={money(estimate.basic)} />
            <EstimateRow label="Benefits" value={`+${money(estimate.benefits)}`} />
            <EstimateRow label="Gross pay" value={money(estimate.gross)} bold />
            <EstimateRow
              label={`SSS (credit ${money(estimate.sssMsc)})`}
              value={comp.data?.apply_sss ? `−${money(estimate.sss)}` : "Off"}
              muted={!comp.data?.apply_sss}
            />
            <EstimateRow
              label="PhilHealth"
              value={comp.data?.apply_philhealth ? `−${money(estimate.philhealth)}` : "Off"}
              muted={!comp.data?.apply_philhealth}
            />
            <EstimateRow
              label="Pag-IBIG"
              value={comp.data?.apply_pagibig ? `−${money(estimate.pagibig)}` : "Off"}
              muted={!comp.data?.apply_pagibig}
            />
            <EstimateRow
              label="Withholding tax"
              value={comp.data?.apply_tax ? `−${money(estimate.tax)}` : "Off"}
              muted={!comp.data?.apply_tax}
            />
            <EstimateRow label="Other deductions" value={`−${money(estimate.otherDeductions)}`} />
            <EstimateRow label="Cash advance repayment" value={`−${money(estimate.cashAdvance)}`} />
            <div className="border-t border-border pt-2">
              <EstimateRow label="Estimated net pay" value={money(estimate.net)} bold />
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Estimate only, using {RATES.asOf} employee rates. It excludes overtime, absences, 13th month pay and
            employer shares. Check against the official SSS, PhilHealth, Pag-IBIG and BIR tables before paying.
          </p>
        </div>
      )}

      {/* Benefits and deductions */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Benefits and other deductions</h3>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => openItem("benefit")}>
              <Plus className="size-4" /> Benefit
            </Button>
            <Button size="sm" variant="outline" onClick={() => openItem("deduction")}>
              <Plus className="size-4" /> Deduction
            </Button>
          </div>
        )}
      </div>
      {payItems.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-muted-foreground">
          None yet. Add things like a rice allowance or a loan deduction. SSS, PhilHealth, Pag-IBIG and tax are
          computed for you.
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {payItems.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className={`text-sm ${i.active ? "" : "text-muted-foreground line-through"}`}>{i.name}</p>
                <p className="text-xs text-muted-foreground">
                  {i.kind === "benefit" ? (i.taxable ? "Benefit · taxable" : "Benefit · not taxable") : "Deduction"}
                  {!i.active && " · inactive"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="text-sm font-medium">
                  {i.kind === "benefit" ? "+" : "−"}
                  {money(i.amount)}
                </p>
                {canManage && (
                  <>
                    <button
                      onClick={() => openItem(i.kind, i)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Edit item"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => removeItem(i)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete item"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

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

      {/* Pay and settings dialog */}
      <Dialog open={salaryOpen} onOpenChange={(o) => !saveComp.isPending && setSalaryOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay and deductions</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSalary} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="comp-salary">Pay per period</Label>
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
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Deduct from pay</legend>
              {FLAG_LABELS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={flags[key]}
                    onChange={(e) => setFlags((f) => ({ ...f, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="comp-ca">Cash advance repayment per period</Label>
              <Input id="comp-ca" type="number" min={0} step="0.01" value={caDeduction} onChange={(e) => setCaDeduction(e.target.value)} />
              <p className="text-xs text-muted-foreground">Taken from pay until the balance owed reaches 0.</p>
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

      {/* Benefit / deduction dialog */}
      <Dialog open={itemOpen} onOpenChange={(o) => !savePayItem.isPending && setItemOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {itemId ? "Edit" : "Add"} {itemKind === "benefit" ? "benefit" : "deduction"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitItem} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                required
                placeholder={itemKind === "benefit" ? "Rice allowance" : "Company loan"}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-amount">Amount per pay period</Label>
              <Input id="item-amount" type="number" min={0} step="0.01" required value={itemAmount} onChange={(e) => setItemAmount(e.target.value)} />
            </div>
            {itemKind === "benefit" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={itemTaxable} onChange={(e) => setItemTaxable(e.target.checked)} />
                Taxable (untick for tax-exempt de minimis benefits)
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={itemActive} onChange={(e) => setItemActive(e.target.checked)} />
              Active (inactive items are ignored in the estimate)
            </label>
            {itemError && <p className="text-sm text-destructive">{itemError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={savePayItem.isPending} onClick={() => setItemOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savePayItem.isPending}>
                {savePayItem.isPending ? "Saving…" : "Save"}
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

function EstimateRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}