import { createFileRoute } from "@tanstack/react-router";
import { Building2, Loader2, Users } from "lucide-react";

import { useCurrentOrganization, useOrganizationMembers } from "@/hooks/use-organization";
import { initials } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/organization")({
  head: () => ({
    meta: [
      { title: "Organization — NEXORA" },
      { name: "description", content: "View your NEXORA organization profile and members." },
      { property: "og:title", content: "Organization — NEXORA" },
      { property: "og:description", content: "Organization details and member directory in NEXORA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrganizationPage,
});

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/50 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function OrganizationPage() {
  const { data: membership, isLoading } = useCurrentOrganization();
  const { data: members, isLoading: membersLoading } = useOrganizationMembers(membership?.organization.id);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Loading organization…</span>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card/60 p-6 text-center backdrop-blur-xl">
        <h1 className="text-sm font-semibold">No organization yet</h1>
        <p className="mt-1 text-xs text-muted-foreground">You don't belong to an organization.</p>
      </div>
    );
  }

  const { organization, role } = membership;

  return (
    <div className="mx-auto max-w-4xl animate-nx-rise">
      <div className="rounded-lg border border-border bg-card/60 p-5 backdrop-blur-xl md:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground shadow-command">
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Organization</p>
            <h1 className="truncate text-2xl font-extrabold">{organization.name}</h1>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              Your role · <span className="text-foreground">{role}</span>
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Detail label="Business type" value={organization.business_type} />
          <Detail label="Company size" value={organization.company_size} />
          <Detail label="Created" value={new Date(organization.created_at).toLocaleDateString()} />
        </div>
      </div>

      <section className="mt-4 rounded-lg border border-border bg-card/60 p-5 backdrop-blur-xl md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Members</h2>
          <span className="font-mono text-[10px] text-muted-foreground">{members?.length ?? 0}</span>
        </div>
        {membersLoading ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Loading members…</p>
        ) : (
          <ul className="space-y-2">
            {members?.map((member) => (
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
                <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
