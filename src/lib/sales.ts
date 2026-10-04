import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SaleStatus = Database["public"]["Enums"]["sale_status"];
export const SALE_STATUSES: SaleStatus[] = ["draft", "pending", "completed", "cancelled", "refunded"];
export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  draft: "Draft", pending: "Pending", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded",
};
/** Allowed status changes after creation. Stock is deducted on completion and restored on cancel/refund by DB triggers. */
export const NEXT_STATUSES: Record<SaleStatus, SaleStatus[]> = {
  draft: ["pending", "completed", "cancelled"],
  pending: ["completed", "cancelled"],
  completed: ["refunded", "cancelled"],
  cancelled: [],
  refunded: [],
};

export type Customer = { id: string; name: string; email: string | null; phone: string | null; company: string | null };

export type SaleRow = {
  id: string; reference: string | null; status: SaleStatus; total_amount: number; subtotal: number;
  tax_amount: number; discount_amount: number; currency: string; sold_at: string; notes: string | null;
  customer: { id: string; name: string } | null; item_count: number;
};

export type SaleItem = { id: string; product_id: string | null; description: string | null; quantity: number; unit_price: number; line_total: number; product: { name: string; sku: string | null } | null };

export type NewSaleItem = { product_id: string; description: string; quantity: number; unit_price: number };
export type NewSale = {
  customer_id: string | null; status: SaleStatus; sold_at: string; notes: string;
  discount: number; tax: number; items: NewSaleItem[];
};

function friendly(error: { code?: string; message: string }) {
  if (error.code === "42501") return new Error("You don't have permission to do that.");
  return new Error(error.message);
}

export function useSales(orgId: string | undefined) {
  return useQuery({
    queryKey: ["sales", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<SaleRow[]> => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, reference, status, total_amount, subtotal, tax_amount, discount_amount, currency, sold_at, notes, customer:customers(id, name), sale_items(count)")
        .eq("organization_id", orgId!)
        .order("sold_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        total_amount: Number(r.total_amount), subtotal: Number(r.subtotal), tax_amount: Number(r.tax_amount), discount_amount: Number(r.discount_amount),
        customer: r.customer as SaleRow["customer"],
        item_count: (r.sale_items as unknown as { count: number }[])?.[0]?.count ?? 0,
      }));
    },
  });
}

export function useSale(orgId: string | undefined, saleId: string) {
  return useQuery({
    queryKey: ["sale", orgId, saleId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, reference, status, total_amount, subtotal, tax_amount, discount_amount, currency, sold_at, notes, created_at, customer:customers(id, name, email, phone, company), sale_items(id, product_id, description, quantity, unit_price, line_total, product:products(name, sku))")
        .eq("organization_id", orgId!)
        .eq("id", saleId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        total_amount: Number(data.total_amount), subtotal: Number(data.subtotal), tax_amount: Number(data.tax_amount), discount_amount: Number(data.discount_amount),
        customer: data.customer as Customer | null,
        items: (data.sale_items ?? []).map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price), line_total: Number(i.line_total) })) as SaleItem[],
      };
    },
  });
}

export function useCustomers(orgId: string | undefined) {
  return useQuery({
    queryKey: ["customers", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase.from("customers").select("id, name, email, phone, company").eq("organization_id", orgId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCustomer(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; email: string; phone: string; company: string }): Promise<Customer> => {
      const { data, error } = await supabase
        .from("customers")
        .insert({ organization_id: orgId!, name: v.name, email: v.email || null, phone: v.phone || null, company: v.company || null })
        .select("id, name, email, phone, company")
        .single();
      if (error) throw error.code === "42501" ? new Error("Your role can't add customers.") : friendly(error);
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["customers", orgId] }),
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, orgId: string | undefined) {
  for (const k of ["sales", "sale", "products", "stock-movements", "activity-logs"]) void qc.invalidateQueries({ queryKey: [k, orgId] });
}

/** Creates the sale and all its items in one database transaction (create_sale RPC). */
export function useCreateSale(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: NewSale): Promise<string> => {
      const { data, error } = await supabase.rpc("create_sale", {
        _organization_id: orgId!,
        _customer_id: s.customer_id as string,
        _status: s.status,
        _sold_at: new Date(s.sold_at).toISOString(),
        _notes: s.notes,
        _discount: s.discount,
        _tax: s.tax,
        _items: s.items,
      });
      if (error) throw friendly(error);
      return data as string;
    },
    onSuccess: () => invalidateAll(qc, orgId),
  });
}

export function useUpdateSaleStatus(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SaleStatus }) => {
      const { error } = await supabase.from("sales").update({ status }).eq("id", id).eq("organization_id", orgId!);
      if (error) throw friendly(error);
    },
    onSuccess: () => invalidateAll(qc, orgId),
  });
}
