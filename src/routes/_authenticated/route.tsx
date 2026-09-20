import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/nexora/app-shell";
import { fetchCurrentMembership } from "@/hooks/use-organization";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    const membership = await fetchCurrentMembership();
    if (!membership) {
      throw redirect({ to: "/onboarding" });
    }
    return { user: data.user, membership };
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Verifying session…
      </span>
    </div>
  ),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
