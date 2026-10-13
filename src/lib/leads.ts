import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ["Website", "Referral", "Facebook", "LinkedIn", "Cold Call", "Email", "Event", "Other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export type LeadRecord = {
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
};

export type LeadInput = {
  name: string;
  company: string;
  email: string;
  phone: string;
  status: LeadStatus;
  source: LeadSource;
  assigned_to: string; // "" = unassigned
  expected_value: string;
  notes: string;
};

const COLS = "id, name, company, email, phone, status, source, assigned_to, expected_value, notes, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("leads");

function friendly(e: { code?: string; message: string }) {
  if (e.code === "42501") return new Error("Your role can't change leads.");
  return new Error(e.message);
}

export function useLeadList(orgId: string | undefined) {
  return useQuery({
    queryKey: ["leads-crm", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<LeadRecord[]> => {
      const { data, error } = await table()
        .select(COLS)
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as LeadRecord[]).map((l) => ({ ...l, expected_value: Number(l.expected_value) }));
    },
  });
}

const clean = (v: LeadInput) => ({
  name: v.name.trim(),
  company: v.company.trim() || null,
  email: v.email.trim() || null,
  phone: v.phone.trim() || null,
  status: v.status,
  source: v.source,
  assigned_to: v.assigned_to || null,
  expected_value: Math.max(0, Number(v.expected_value) || 0),
  notes: v.notes.trim() || null,
});

export function useSaveLead(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string | undefined; values: LeadInput }) => {
      const q = id
        ? table().update(clean(values)).eq("id", id).eq("organization_id", orgId!).select("id").single()
        : table().insert({ ...clean(values), organization_id: orgId! }).select("id").single();
      const { data, error } = await q;
      if (error) throw friendly(error);
      return data.id as string;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["leads-crm"] }),
  });
}

/** Moves a lead to another pipeline stage, updating the board instantly and rolling back on error. */
export function useMoveLead(orgId: string | undefined) {
  const qc = useQueryClient();
  const key = ["leads-crm", orgId];
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await table().update({ status }).eq("id", id).eq("organization_id", orgId!);
      if (error) throw friendly(error);
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LeadRecord[]>(key);
      qc.setQueryData<LeadRecord[]>(key, (old) => (old ?? []).map((l) => (l.id === id ? { ...l, status } : l)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["leads-crm"] }),
  });
}

export function useDeleteLead(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id).eq("organization_id", orgId!);
      if (error) throw friendly(error);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["leads-crm"] }),
  });
}