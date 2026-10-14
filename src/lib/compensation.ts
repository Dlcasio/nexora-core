import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PAY_FREQUENCIES = ["monthly", "semi_monthly", "weekly"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];
export const PAY_FREQUENCY_LABEL: Record<PayFrequency, string> = {
  monthly: "Monthly",
  semi_monthly: "Twice a month",
  weekly: "Weekly",
};

export type CompensationRecord = {
  id: string;
  base_salary: number; // pay per pay period
  pay_frequency: PayFrequency;
  apply_sss: boolean;
  apply_philhealth: boolean;
  apply_pagibig: boolean;
  apply_tax: boolean;
  cash_advance_deduction: number; // repayment taken each pay period
};

export type CompensationInput = Omit<CompensationRecord, "id">;

export type PayItemKind = "benefit" | "deduction";
export type PayItem = {
  id: string;
  kind: PayItemKind;
  name: string;
  amount: number; // per pay period
  taxable: boolean;
  active: boolean;
};
export type PayItemInput = {
  kind: PayItemKind;
  name: string;
  amount: string;
  taxable: boolean;
  active: boolean;
};

export type CashEntryType = "advance" | "repayment";
export type CashEntry = {
  id: string;
  entry_type: CashEntryType;
  amount: number;
  entry_date: string;
  reason: string | null;
  created_at: string;
};

export type CashEntryInput = {
  entry_type: CashEntryType;
  amount: number;
  entry_date: string;
  reason: string;
};

// These tables are new, so the generated Supabase types may not include them yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (name: string) => (supabase as any).from(name);

function friendly(e: { code?: string; message: string }) {
  if (e.code === "42501") return new Error("You need Finance manage access to change this.");
  return new Error(e.message);
}

export function summarizeCash(entries: CashEntry[]) {
  const advanced = entries.filter((e) => e.entry_type === "advance").reduce((t, e) => t + e.amount, 0);
  const repaid = entries.filter((e) => e.entry_type === "repayment").reduce((t, e) => t + e.amount, 0);
  return { advanced, repaid, balance: advanced - repaid };
}

/* ───────────── Salary and payroll settings ───────────── */

const COMP_COLS =
  "id, base_salary, pay_frequency, apply_sss, apply_philhealth, apply_pagibig, apply_tax, cash_advance_deduction";

export function useCompensation(orgId: string | undefined, employeeId: string) {
  return useQuery({
    queryKey: ["compensation", orgId, employeeId],
    enabled: !!orgId,
    queryFn: async (): Promise<CompensationRecord | null> => {
      const { data, error } = await from("employee_compensation")
        .select(COMP_COLS)
        .eq("organization_id", orgId!)
        .eq("employee_id", employeeId)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            ...data,
            base_salary: Number(data.base_salary),
            cash_advance_deduction: Number(data.cash_advance_deduction),
          }
        : null;
    },
  });
}

export function useSaveCompensation(orgId: string | undefined, employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: CompensationInput) => {
      const { error } = await from("employee_compensation").upsert(
        { organization_id: orgId!, employee_id: employeeId, ...v },
        { onConflict: "employee_id" },
      );
      if (error) throw friendly(error);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["compensation"] }),
  });
}

/* ───────────── Benefits and other deductions ───────────── */

export function usePayItems(orgId: string | undefined, employeeId: string) {
  return useQuery({
    queryKey: ["pay-items", orgId, employeeId],
    enabled: !!orgId,
    queryFn: async (): Promise<PayItem[]> => {
      const { data, error } = await from("employee_pay_items")
        .select("id, kind, name, amount, taxable, active")
        .eq("organization_id", orgId!)
        .eq("employee_id", employeeId)
        .order("kind")
        .order("name");
      if (error) throw error;
      return ((data ?? []) as PayItem[]).map((i) => ({ ...i, amount: Number(i.amount) }));
    },
  });
}

const cleanItem = (v: PayItemInput) => ({
  kind: v.kind,
  name: v.name.trim(),
  amount: Math.max(0, Number(v.amount) || 0),
  taxable: v.kind === "benefit" ? v.taxable : false,
  active: v.active,
});

export function useSavePayItem(orgId: string | undefined, employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string | undefined; values: PayItemInput }) => {
      const q = id
        ? from("employee_pay_items").update(cleanItem(values)).eq("id", id).eq("organization_id", orgId!)
        : from("employee_pay_items").insert({
            ...cleanItem(values),
            organization_id: orgId!,
            employee_id: employeeId,
          });
      const { error } = await q;
      if (error) throw friendly(error);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["pay-items"] }),
  });
}

export function useDeletePayItem(orgId: string | undefined, employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("employee_pay_items")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId!)
        .eq("employee_id", employeeId);
      if (error) throw friendly(error);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["pay-items"] }),
  });
}

/* ───────────── Cash advance ledger ───────────── */

export function useCashEntries(orgId: string | undefined, employeeId: string) {
  return useQuery({
    queryKey: ["cash-entries", orgId, employeeId],
    enabled: !!orgId,
    queryFn: async (): Promise<CashEntry[]> => {
      const { data, error } = await from("employee_cash_advances")
        .select("id, entry_type, amount, entry_date, reason, created_at")
        .eq("organization_id", orgId!)
        .eq("employee_id", employeeId)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as CashEntry[]).map((e) => ({ ...e, amount: Number(e.amount) }));
    },
  });
}

export function useAddCashEntry(orgId: string | undefined, employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: CashEntryInput) => {
      const { error } = await from("employee_cash_advances").insert({
        organization_id: orgId!,
        employee_id: employeeId,
        entry_type: v.entry_type,
        amount: v.amount,
        entry_date: v.entry_date,
        reason: v.reason.trim() || null,
      });
      if (error) throw friendly(error);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cash-entries"] }),
  });
}

export function useDeleteCashEntry(orgId: string | undefined, employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("employee_cash_advances")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId!)
        .eq("employee_id", employeeId);
      if (error) throw friendly(error);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cash-entries"] }),
  });
}