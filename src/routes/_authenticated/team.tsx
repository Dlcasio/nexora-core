import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { RequirePermission } from "@/components/nexora/permission-gate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initials } from "@/hooks/use-auth";
import { useCurrentOrganization, useOrganizationMembers } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — NEXORA" },
      { name: "description", content: "View NEXORA organization members and the role each one holds." },
      { property: "og:title", content: "Team — NEXORA" },
      { property: "og:description", content: "Organization members and role based access in NEXORA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequirePermission module="team">
      <TeamPage />
    </RequirePermission>
  ),
});

function TeamPage() {
  const { data: membership } = useCurrentOrganization();
  const organizationId = membership?.organization.id;
  const { data: members, isLoading } = useOrganizationMembers(organizationId);
  const { can } = usePermissions();
  const canManage = can("team", "manage");
  const queryClient = useQueryClient();

  const updateRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: Role }) => {
      const { error } = await supabase.from("organization_members").update({ role }).eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      void queryClient.invalidateQueries({ queryKey: ["organization-members"] });
      void queryClient.invalidateQueries({ queryKey: ["current-organization"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the role"),
  });

  return (
    <div className="mx-auto max-w-4xl animate-nx-rise">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">NEXORA · 11</p>
          <h1 className="text-2xl font-extrabold md:text-3xl">Team</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Members of {membership?.organization.name ?? "your organization"} and the access each role grants.
          </p>
        </div>
        <span className="hidden items-center gap-2 font-mono text-[11px] text-muted-foreground sm:flex">
          <ShieldCheck className="size-3.5" /> Role based access
        </span>
      </div>

      <section className="rounded-lg border border-border bg-card/60 p-5 backdrop-blur-xl md:p-6">
        <h2 className="text-sm font-semibold">Members</h2>
        {isLoading ? (
          <p className="mt-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading members…
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {members?.map((member) => {
              const role = member.role as Role;
              return (
                <li key={member.id} className="flex items-center gap-3 rounded-md border border-border bg-background/50 px-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-[11px] font-bold">
                    {initials(member.profile?.full_name, member.profile?.email)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {member.profile?.full_name ?? member.profile?.email ?? "Member"}
                    </span>
                    {member.profile?.email && (
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">{member.profile.email}</span>
                    )}
                  </span>
                  {canManage ? (
                    <Select
                      value={role}
                      onValueChange={(next) => updateRole.mutate({ memberId: member.id, role: next as Role })}
                      disabled={updateRole.isPending}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORG_ROLES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {ROLE_LABELS[item]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {ROLE_LABELS[role] ?? member.role}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card/60 p-5 backdrop-blur-xl md:p-6">
        <h2 className="text-sm font-semibold">Roles</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {ORG_ROLES.map((item) => (
            <div key={item} className="rounded-md border border-border bg-background/50 px-3 py-2.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{ROLE_LABELS[item]}</dt>
              <dd className="mt-1 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[item]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
