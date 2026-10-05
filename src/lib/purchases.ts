import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PurchaseStatus = "draft" | "ordered" | "received" | "cancelled";
export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  draft: "Draft", ordered: "Ordered", received: "Received", cancelled: "Cancelled",
};

export type Supplier = { id: string; name: string };
export type PurchaseOrderItem = { id: string; product_id: string; quantity: number; unit_cost: number; line_total: number };
export type PurchaseOrder = {
  id: string; reference: string; status: PurchaseStatus; supplier_id: string | null;
  ordered_on: string; expected_on: string | null; total_amount: number; notes: string | null;
  received_at: string | null; created_at: string; items: PurchaseOrderItem[];
};
export type PurchaseItemInput = { product_id: string; quantity: number; unit_cost: number };

function friendly(e: { code?: string; message: string }) {
  if (e.code === "42501") return new Error("You don't have permission to do that.");
  return new Error(e.message);
}

export function useSuppliers(orgId: string | undefined) {
  return useQuery({
    queryKey: ["suppliers", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase.from("suppliers").select("id, name").eq("organization_id", orgId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateSupplier(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; email: string | null; phone: string | null }): Promise<Supplier> => {
      const { data, error } = await supabase.from("suppliers").insert({ ...v, organization_id: orgId! }).select("id, name").single();
      if (error) throw friendly(error);
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["suppliers", orgId] }),
  });
}

export function usePurchaseOrders(orgId: string | undefined) {
  return useQuery({
    queryKey: ["purchase-orders", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<PurchaseOrder[]> => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, reference, status, supplier_id, ordered_on, expected_on, total_amount, notes, received_at, created_at, purchase_order_items(id, product_id, quantity, unit_cost, line_total)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(({ purchase_order_items, ...r }) => ({
        ...r,
        status: r.status as PurchaseStatus,
        total_amount: Number(r.total_amount),
        items: (purchase_order_items ?? []).map((i) => ({ ...i, unit_cost: Number(i.unit_cost), line_total: Number(i.line_total) })),
      }));
    },
  });
}

function useInvalidate(orgId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    for (const k of ["purchase-orders", "products", "stock-movements", "activity-logs"]) void qc.invalidateQueries({ queryKey: [k, orgId] });
  };
}

export function useCreatePurchaseOrder(orgId: string | undefined) {
  const invalidate = useInvalidate(orgId);
  return useMutation({
    mutationFn: async (v: { supplierId: string; status: "draft" | "ordered"; orderedOn: string; expectedOn: string | null; notes: string; items: PurchaseItemInput[] }) => {
      const { data, error } = await supabase.rpc("create_purchase_order", {
        _organization_id: orgId!, _supplier_id: v.supplierId, _status: v.status, _ordered_on: v.orderedOn,
        _expected_on: v.expectedOn as string, _notes: v.notes, _items: v.items,
      });
      if (error) throw friendly(error);
      return data as string;
    },
    onSuccess: invalidate,
  });
}

export function useSetPurchaseStatus(orgId: string | undefined) {
  const invalidate = useInvalidate(orgId);
  return useMutation({
    mutationFn: async (v: { id: string; status: "ordered" | "cancelled" }) => {
      const { error } = await supabase.rpc("set_purchase_order_status", { _purchase_order_id: v.id, _status: v.status });
      if (error) throw friendly(error);
    },
    onSuccess: invalidate,
  });
}

export function useReceivePurchaseOrder(orgId: string | undefined) {
  const invalidate = useInvalidate(orgId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("receive_purchase_order", { _purchase_order_id: id });
      if (error) throw friendly(error);
    },
    onSuccess: invalidate,
  });
}
