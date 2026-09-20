import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Organization, OrganizationMember, OrgRole } from "@/lib/organizations";

export type Membership = {
  organization: Organization;
  role: OrgRole;
};

/** Returns the membership (organization + role) for the signed-in user, or null. */
export async function fetchCurrentMembership(): Promise<Membership | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, business_type, company_size, created_by, created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.organizations) return null;
  return {
    organization: data.organizations as unknown as Organization,
    role: data.role as OrgRole,
  };
}

export function useCurrentOrganization() {
  return useQuery({
    queryKey: ["current-organization"],
    queryFn: fetchCurrentMembership,
    staleTime: 60_000,
  });
}

export type MemberRow = OrganizationMember & {
  profile: { full_name: string | null; email: string | null } | null;
};

export function useOrganizationMembers(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["organization-members", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, organization_id, user_id, role, created_at")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as OrganizationMember[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", rows.map((row) => row.user_id));

      return rows.map((row) => {
        const profile = profiles?.find((item) => item.id === row.user_id);
        return {
          ...row,
          profile: profile ? { full_name: profile.full_name, email: profile.email } : null,
        };
      });
    },
  });
}

export function useInvalidateOrganization() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["current-organization"] });
    void queryClient.invalidateQueries({ queryKey: ["organization-members"] });
  };
}
