import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  budget: number | null;
  start_date: string | null;
  due_date: string | null;
  customer_id: string | null;
  owner_employee_id: string | null;
  created_at: string;
  task_total: number;
  task_done: number;
};

export type ProjectInput = {
  name: string;
  description: string;
  status: ProjectStatus;
  budget: string; // "" = none
  start_date: string; // "" = none
  due_date: string; // "" = none
  customer_id: string; // "" = none
  owner_employee_id: string; // "" = none
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const COLS =
  "id, name, description, status, budget, start_date, due_date, customer_id, owner_employee_id, created_at, tasks(status)";

type Raw = Omit<ProjectRecord, "task_total" | "task_done" | "budget"> & {
  budget: number | string | null;
  tasks: { status: string }[] | null;
};

/** Progress counts every task except cancelled ones. */
function summarize(r: Raw): ProjectRecord {
  const counted = (r.tasks ?? []).filter((t) => t.status !== "cancelled");
  const { tasks: _tasks, ...rest } = r;
  return {
    ...rest,
    budget: r.budget === null ? null : Number(r.budget),
    task_total: counted.length,
    task_done: counted.filter((t) => t.status === "done").length,
  };
}

function friendly(e: { code?: string; message: string }) {
  if (e.code === "42501") return new Error("Your role can't change projects.");
  return new Error(e.message);
}

export function useProjectList(orgId: string | undefined) {
  return useQuery({
    queryKey: ["projects-pm", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<ProjectRecord[]> => {
      const { data, error } = await db
        .from("projects")
        .select(COLS)
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Raw[]).map(summarize);
    },
  });
}

export function useProject(orgId: string | undefined, id: string) {
  return useQuery({
    queryKey: ["project-pm", orgId, id],
    enabled: !!orgId,
    queryFn: async (): Promise<ProjectRecord | null> => {
      const { data, error } = await db
        .from("projects")
        .select(COLS)
        .eq("organization_id", orgId!)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? summarize(data as Raw) : null;
    },
  });
}

/** Light list for the customer dropdown. */
export function useCustomerOptions(orgId: string | undefined) {
  return useQuery({
    queryKey: ["customer-options", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await db
        .from("customers")
        .select("id, name")
        .eq("organization_id", orgId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

const clean = (v: ProjectInput) => ({
  name: v.name.trim(),
  description: v.description.trim() || null,
  status: v.status,
  budget: v.budget === "" ? null : Math.max(0, Number(v.budget) || 0),
  start_date: v.start_date || null,
  due_date: v.due_date || null,
  customer_id: v.customer_id || null,
  owner_employee_id: v.owner_employee_id || null,
});

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ["projects-pm", "project-pm", "tasks-pm"]) void qc.invalidateQueries({ queryKey: [k] });
}

export function useSaveProject(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string | undefined; values: ProjectInput }) => {
      const q = id
        ? db.from("projects").update(clean(values)).eq("id", id).eq("organization_id", orgId!)
        : db.from("projects").insert({ ...clean(values), organization_id: orgId! });
      const { error } = await q;
      if (error) throw friendly(error);
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteProject(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("projects").delete().eq("id", id).eq("organization_id", orgId!);
      if (error) throw friendly(error);
    },
    onSuccess: () => invalidate(qc),
  });
}