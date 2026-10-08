import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CustomerRecord = {
  id: string; name: string; email: string | null; phone: string | null; company: string | null;
  address: string | null; notes: string | null; created_at: string;
  order_count: number; total_purchases: number; last_order_at: string | null;
};
export type CustomerInput = { name: string; email: string; phone: string; company: string; address: string; notes: string };

const COLS = "id, name, email, phone, company, address, notes, created_at, sales(status, total_amount, sold_at)";

type Raw = Omit<CustomerRecord, "order_count" | "total_purchases" | "last_order_at"> & { sales: { status: string; total_amount: number; sold_at: string }[] | null };

/** Totals count completed sales only (refunded/cancelled are excluded). */
export function summarize(r: Raw): CustomerRecord {
  const done = (r.sales ?? []).filter((s) => s.status === "completed");
  const last = done.map((s) => s.sold_at).sort().at(-1) ?? null;
  const { sales: _s, ...rest } = r;
  return { ...rest, order_count: done.length, total_purchases: done.reduce((t, s) => t + Number(s.total_amount), 0), last_order_at: last };
}

function friendly(e: { code?: string; message: string }) {
  if (e.code === "42501") return new Error("Your role can't change customers.");
  return new Error(e.message);
}

export function useCustomerList(orgId: string | undefined) {
  return useQuery({
    queryKey: ["customers-crm", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select(COLS).eq("organization_id", orgId!).order("name");
      if (error) throw error;
      return (data as unknown as Raw[]).map(summarize);
    },
  });
}

export function useCustomer(orgId: string | undefined, id: string) {
  return useQuery({
    queryKey: ["customer", orgId, id],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select(COLS).eq("organization_id", orgId!).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? summarize(data as unknown as Raw) : null;
    },
  });
}

export function useCustomerSales(orgId: string | undefined, id: string) {
  return useQuery({
    queryKey: ["customer-sales", orgId, id],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("id, reference, status, total_amount, sold_at")
        .eq("organization_id", orgId!).eq("customer_id", id).order("sold_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((s) => ({ ...s, total_amount: Number(s.total_amount) }));
    },
  });
}

export function useCustomerActivity(orgId: string | undefined, id: string) {
  return useQuery({
    queryKey: ["customer-activity", orgId, id],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_logs").select("id, action, description, created_at")
        .eq("organization_id", orgId!).eq("entity_id", id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

const clean = (v: CustomerInput) => ({
  name: v.name.trim(), email: v.email.trim() || null, phone: v.phone.trim() || null,
  company: v.company.trim() || null, address: v.address.trim() || null, notes: v.notes.trim() || null,
});

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ["customers-crm", "customers", "customer", "customer-activity", "activity-logs", "sales"]) void qc.invalidateQueries({ queryKey: [k] });
}

export function useSaveCustomer(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string | undefined; values: CustomerInput }) => {
      const q = id
        ? supabase.from("customers").update(clean(values)).eq("id", id).eq("organization_id", orgId!).select("id").single()
        : supabase.from("customers").insert({ ...clean(values), organization_id: orgId! }).select("id").single();
      const { data, error } = await q;
      if (error) throw friendly(error);
      return data.id as string;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCustomer(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id).eq("organization_id", orgId!);
      if (error) throw friendly(error);
    },
    onSuccess: () => invalidate(qc),
  });
}
