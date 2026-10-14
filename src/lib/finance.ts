import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Supplies",
  "Marketing",
  "Transport",
  "Software",
  "Maintenance",
  "Other",
];

export type ExpenseRecord = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  incurred_on: string;
  created_at: string;
};

export type ExpenseInput = {
  category: string;
  description: string;
  amount: string;
  incurred_on: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function friendly(e: { code?: string; message: string }) {
  if (e.code === "42501") return new Error("Your role can't change expenses.");
  return new Error(e.message);
}

const sum = (rows: { amount?: number | string; total_amount?: number | string }[], key: "amount" | "total_amount") =>
  rows.reduce((t, r) => t + Number(r[key] ?? 0), 0);

export function useExpenseList(orgId: string | undefined, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["expenses-fin", orgId, from, to],
    enabled: !!orgId && enabled,
    queryFn: async (): Promise<ExpenseRecord[]> => {
      const { data, error } = await db
        .from("expenses")
        .select("id, category, description, amount, incurred_on, created_at")
        .eq("organization_id", orgId!)
        .gte("incurred_on", from)
        .lte("incurred_on", to)
        .order("incurred_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as ExpenseRecord[]).map((e) => ({ ...e, amount: Number(e.amount) }));
    },
  });
}

export type FinanceSummary = {
  revenue: number;
  expenses: number;
  purchases: number;
  profit: number;
  advancesOutstanding: number;
};

/** Totals for a period. Revenue = completed sales, purchases = received purchase orders. */
export function useFinanceSummary(orgId: string | undefined, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["finance-summary", orgId, from, to],
    enabled: !!orgId && enabled,
    queryFn: async (): Promise<FinanceSummary> => {
      // Local-time day boundaries so a sale at 9am on the 1st counts for that day
      const start = new Date(`${from}T00:00:00`).toISOString();
      const end = new Date(`${to}T23:59:59.999`).toISOString();

      const [sales, purchases, expenses, advances] = await Promise.all([
        supabase
          .from("sales")
          .select("total_amount")
          .eq("organization_id", orgId!)
          .eq("status", "completed")
          .gte("sold_at", start)
          .lte("sold_at", end),
        supabase
          .from("purchase_orders")
          .select("total_amount")
          .eq("organization_id", orgId!)
          .eq("status", "received")
          .gte("ordered_on", from)
          .lte("ordered_on", to),
        db
          .from("expenses")
          .select("amount")
          .eq("organization_id", orgId!)
          .gte("incurred_on", from)
          .lte("incurred_on", to),
        db.from("employee_cash_advances").select("entry_type, amount").eq("organization_id", orgId!),
      ]);

      for (const r of [sales, purchases, expenses, advances]) if (r.error) throw r.error;

      const revenue = sum(sales.data ?? [], "total_amount");
      const purchaseTotal = sum(purchases.data ?? [], "total_amount");
      const expenseTotal = sum(expenses.data ?? [], "amount");
      const advanced = sum(
        ((advances.data ?? []) as { entry_type: string; amount: number }[]).filter((a) => a.entry_type === "advance"),
        "amount",
      );
      const repaid = sum(
        ((advances.data ?? []) as { entry_type: string; amount: number }[]).filter((a) => a.entry_type === "repayment"),
        "amount",
      );

      return {
        revenue,
        expenses: expenseTotal,
        purchases: purchaseTotal,
        profit: revenue - expenseTotal - purchaseTotal,
        advancesOutstanding: advanced - repaid,
      };
    },
  });
}

const clean = (v: ExpenseInput) => ({
  category: v.category.trim(),
  description: v.description.trim() || null,
  amount: Number(v.amount),
  incurred_on: v.incurred_on,
});

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ["expenses-fin", "finance-summary"]) void qc.invalidateQueries({ queryKey: [k] });
}

export function useSaveExpense(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string | undefined; values: ExpenseInput }) => {
      const q = id
        ? db.from("expenses").update(clean(values)).eq("id", id).eq("organization_id", orgId!)
        : db.from("expenses").insert({ ...clean(values), organization_id: orgId! });
      const { error } = await q;
      if (error) throw friendly(error);
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteExpense(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("expenses").delete().eq("id", id).eq("organization_id", orgId!);
      if (error) throw friendly(error);
    },
    onSuccess: () => invalidate(qc),
  });
}