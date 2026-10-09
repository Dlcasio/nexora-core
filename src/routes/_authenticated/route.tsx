import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/nexora/app-shell";
import { fetchCurrentMembership } from "@/hooks/use-organization";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Keep getUser() here: this is the one place we want the server to
    // verify the token, not just trust what's in localStorage.
    const { data, error } = await supabase.auth.getUser();

    // Network blips / 5xx: don't log the user out, surface the error instead.
    if (error && isAuthRetryableFetchError(error)) {
      throw error;
    }

    if (error || !data.user) {
      // Dead or missing session: clear it locally so it isn't re-sent on
      // every reload and /auth doesn't see a leftover session.
      // The server logout may 403 too (session already gone), so never let
      // that failure block the redirect.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }
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