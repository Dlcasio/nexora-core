import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/use-organization";
import {
  accessFor,
  meets,
  type AccessLevel,
  type ModuleKey,
  type PermissionMatrix,
  type Role,
} from "@/lib/permissions";

async function fetchMatrix(organizationId: string | undefined): Promise<PermissionMatrix> {
  const matrix: PermissionMatrix = {};

  const { data: defaults, error } = await supabase.from("role_permissions").select("role, module, access");
  if (error) throw error;
  for (const row of defaults ?? []) {
    const role = row.role as Role;
    matrix[role] = { ...(matrix[role] ?? {}), [row.module as ModuleKey]: row.access as AccessLevel };
  }

  if (organizationId) {
    const { data: overrides } = await supabase
      .from("organization_role_permissions")
      .select("role, module, access")
      .eq("organization_id", organizationId);
    for (const row of overrides ?? []) {
      const role = row.role as Role;
      matrix[role] = { ...(matrix[role] ?? {}), [row.module as ModuleKey]: row.access as AccessLevel };
    }
  }

  return matrix;
}

export function usePermissionMatrix() {
  const { data: membership } = useCurrentOrganization();
  const organizationId = membership?.organization.id;
  return useQuery({
    queryKey: ["permission-matrix", organizationId ?? "global"],
    queryFn: () => fetchMatrix(organizationId),
    staleTime: 5 * 60_000,
  });
}

export type Permissions = {
  role: Role | undefined;
  loading: boolean;
  access: (module: ModuleKey) => AccessLevel;
  can: (module: ModuleKey, required?: AccessLevel) => boolean;
};

/** Reusable permission gate for any module in NEXORA. */
export function usePermissions(): Permissions {
  const { data: membership, isLoading: orgLoading } = useCurrentOrganization();
  const { data: matrix, isLoading } = usePermissionMatrix();
  const role = membership?.role as Role | undefined;

  return {
    role,
    loading: orgLoading || isLoading,
    access: (module) => accessFor(matrix ?? {}, role, module),
    can: (module, required = "view") => meets(accessFor(matrix ?? {}, role, module), required),
  };
}
