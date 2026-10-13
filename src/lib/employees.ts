import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Matches the database enum `employment_status`.
export const EMPLOYEE_STATUSES = ["active", "on_leave", "terminated"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: "Active",
  on_leave: "On leave",
  terminated: "Terminated",
};

export type EmployeeRecord = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  status: EmployeeStatus;
  hired_on: string | null;
  created_at: string;
};

export type EmployeeInput = {
  full_name: string;
  email: string;
  phone: string;
  department: string;
  job_title: string;
  status: EmployeeStatus;
  hired_on: string; // "" = none
};

// Note: `salary` and `user_id` exist on the table but are deliberately not read or written here.
const COLS = "id, full_name, email, phone, department, job_title, status, hired_on, created_at";

// The generated Supabase types may not be in sync with this table. This untyped handle
// keeps the file compiling either way; you can switch to the typed client later.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("employees");

function friendly(e: { code?: string; message: string }) {
  if (e.code === "42501") return new Error("Your role can't change employees.");
  return new Error(e.message);
}

export function useEmployeeList(orgId: string | undefined) {
  return useQuery({
    queryKey: ["employees-hr", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<EmployeeRecord[]> => {
      const { data, error } = await table().select(COLS).eq("organization_id", orgId!).order("full_name");
      if (error) throw error;
      return (data ?? []) as EmployeeRecord[];
    },
  });
}

const clean = (v: EmployeeInput) => ({
  full_name: v.full_name.trim(),
  email: v.email.trim() || null,
  phone: v.phone.trim() || null,
  department: v.department.trim() || null,
  job_title: v.job_title.trim() || null,
  status: v.status,
  hired_on: v.hired_on || null,
});

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  // leads show the assigned employee's name, so refresh them too
  for (const k of ["employees-hr", "employee-hr", "employee-leads", "employee-activity", "leads-crm"])
    void qc.invalidateQueries({ queryKey: [k] });
}

export function useEmployee(orgId: string | undefined, id: string) {
  return useQuery({
    queryKey: ["employee-hr", orgId, id],
    enabled: !!orgId,
    queryFn: async (): Promise<EmployeeRecord | null> => {
      const { data, error } = await table().select(COLS).eq("organization_id", orgId!).eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as EmployeeRecord | null) ?? null;
    },
  });
}

export type EmployeeLead = {
  id: string;
  name: string;
  company: string | null;
  status: string;
  expected_value: number;
};

/** Leads currently assigned to this employee. */
export function useEmployeeLeads(orgId: string | undefined, id: string) {
  return useQuery({
    queryKey: ["employee-leads", orgId, id],
    enabled: !!orgId,
    queryFn: async (): Promise<EmployeeLead[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("leads")
        .select("id, name, company, status, expected_value")
        .eq("organization_id", orgId!)
        .eq("assigned_to", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as EmployeeLead[]).map((l) => ({ ...l, expected_value: Number(l.expected_value) }));
    },
  });
}

export function useEmployeeActivity(orgId: string | undefined, id: string) {
  return useQuery({
    queryKey: ["employee-activity", orgId, id],
    enabled: !!orgId,
    queryFn: async (): Promise<{ id: string; action: string; description: string | null; created_at: string }[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("activity_logs")
        .select("id, action, description, created_at")
        .eq("organization_id", orgId!)
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}
async function logActivity(orgId: string, entityId: string, action: string, description: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("activity_logs").insert({
      organization_id: orgId,
      entity_type: "employee",
      entity_id: entityId,
      action,
      description,
    });
    if (error) console.warn("Activity log failed:", error.message);
  } catch (err) {
    console.warn("Activity log failed:", err);
  }
}

export function useSaveEmployee(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: EmployeeInput }) => {
      if (!orgId) throw new Error("No organization selected.");
      const name = values.full_name.trim();
      if (id) {
        const { error } = await table().update(clean(values)).eq("organization_id", orgId).eq("id", id);
        if (error) throw friendly(error);
        await logActivity(orgId, id, "employee_updated", `Updated ${name}`);
      } else {
        const { data, error } = await table()
          .insert({ organization_id: orgId, ...clean(values) })
          .select("id")
          .single();
        if (error) throw friendly(error);
        await logActivity(orgId, data.id, "employee_created", `Added ${name}`);
      }
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteEmployee(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) throw new Error("No organization selected.");
      const { error } = await table().delete().eq("organization_id", orgId).eq("id", id);
      if (error) throw friendly(error);
      await logActivity(orgId, id, "employee_deleted", "Employee deleted");
    },
    onSuccess: () => invalidate(qc),
  });
}