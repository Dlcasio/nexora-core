import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActivityEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  actor_id: string | null;
  created_at: string;
  actor_name: string | null;
};

/** Reusable logger for future modules. Most core tables also log automatically via database triggers. */
export async function logActivity(input: {
  organizationId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.rpc("log_activity", {
    _organization_id: input.organizationId,
    _action: input.action,
    _entity_type: input.entityType,
    _entity_id: (input.entityId ?? null) as string,
    _description: input.description,
    _metadata: (input.metadata ?? {}) as never,
  });
  if (error) throw error;
}

export function useRecentActivity(organizationId: string | undefined, limit = 8) {
  return useQuery({
    queryKey: ["activity-logs", organizationId, limit],
    enabled: !!organizationId,
    queryFn: async (): Promise<ActivityEntry[]> => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, entity_id, description, actor_id, created_at")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (actorIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
        profiles?.forEach((p) => names.set(p.id, p.full_name || p.email || "Member"));
      }
      return (data ?? []).map((r) => ({ ...r, actor_name: r.actor_id ? names.get(r.actor_id) ?? null : null }));
    },
  });
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
