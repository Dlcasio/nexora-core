import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Category = { id: string; name: string };

export type Product = {
  id: string;
  organization_id: string;
  category_id: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductInput = {
  name: string;
  sku: string | null;
  description: string | null;
  category_id: string | null;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  reorder_level: number;
  is_active: boolean;
};

export type StockState = "in_stock" | "low" | "out";

export function stockState(p: Pick<Product, "stock_quantity" | "reorder_level">): StockState {
  if (p.stock_quantity <= 0) return "out";
  if (p.stock_quantity <= p.reorder_level) return "low";
  return "in_stock";
}

const COLUMNS =
  "id, organization_id, category_id, sku, name, description, unit_price, cost_price, stock_quantity, reorder_level, is_active, created_at, updated_at";

export function useProducts(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["products", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(COLUMNS)
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, unit_price: Number(r.unit_price), cost_price: Number(r.cost_price) }));
    },
  });
}

export function useCategories(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["categories", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("organization_id", organizationId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === "23505") return new Error("That SKU or name is already used in your organization.");
  if (error.code === "42501") return new Error("You don't have permission to change products.");
  return new Error(error.message);
}

export function useSaveProduct(organizationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string | undefined; input: ProductInput }) => {
      if (!organizationId) throw new Error("No organization selected.");
      const query = id
        ? supabase.from("products").update(input).eq("id", id).eq("organization_id", organizationId)
        : supabase.from("products").insert({ ...input, organization_id: organizationId });
      const { error } = await query;
      if (error) throw friendly(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products", organizationId] });
      void qc.invalidateQueries({ queryKey: ["activity-logs", organizationId] });
    },
  });
}

export function useDeleteProduct(organizationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id).eq("organization_id", organizationId!);
      if (error) {
        if (error.code === "23503") throw new Error("This product is used in sales. Mark it inactive instead.");
        throw friendly(error);
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["products", organizationId] }),
  });
}

export function useCreateCategory(organizationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Category> => {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name, organization_id: organizationId! })
        .select("id, name")
        .single();
      if (error) throw friendly(error);
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["categories", organizationId] }),
  });
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
