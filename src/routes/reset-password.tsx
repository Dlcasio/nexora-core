import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { AuthLayout } from "@/components/nexora/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — NEXORA" },
      { name: "description", content: "Choose a new password for your NEXORA workspace account." },
      { property: "og:title", content: "Set a new password — NEXORA" },
      { property: "og:description", content: "Complete your NEXORA password reset." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setRecovery(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setRecovery(Boolean(data.session) || hash.includes("type=recovery"));
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Both passwords must match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1200);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a strong password to finish the reset.">
      {!ready ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking your reset link…</p>
      ) : !recovery ? (
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-px size-3.5 shrink-0" /> This reset link is invalid or has expired.
          </p>
          <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>Request a new link</Button>
        </div>
      ) : done ? (
        <p className="flex items-start gap-2 rounded-md border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <CheckCircle2 className="mt-px size-3.5 shrink-0 text-status" /> Password updated. Taking you to your dashboard…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} autoComplete="new-password" required />
          </div>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="mt-px size-3.5 shrink-0" /> {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
