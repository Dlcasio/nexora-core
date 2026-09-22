import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { usePermissions } from "@/hooks/use-permissions";
import { ROLE_LABELS, type AccessLevel, type ModuleKey } from "@/lib/permissions";

export function AccessDenied({ module }: { module: ModuleKey }) {
  const { role } = usePermissions();
  return (
    <div className="mx-auto max-w-md animate-nx-rise rounded-lg border border-border bg-card/60 p-6 text-center backdrop-blur-xl">
      <span className="mx-auto grid size-11 place-items-center rounded-md bg-secondary text-muted-foreground">
        <ShieldAlert className="size-5" />
      </span>
      <h1 className="mt-4 text-sm font-semibold">You don't have access to this area</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Your role{role ? ` (${ROLE_LABELS[role]})` : ""} doesn't include the <span className="font-mono">{module}</span> module.
        Ask an owner or administrator to update your permissions.
      </p>
      <Link to="/dashboard" className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
        Back to dashboard
      </Link>
    </div>
  );
}

/** Reusable gate: renders children only when the signed-in member has the required access. */
export function RequirePermission({
  module,
  level = "view",
  children,
  fallback,
}: {
  module: ModuleKey;
  level?: AccessLevel;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Checking permissions…</span>
      </div>
    );
  }

  if (!can(module, level)) return <>{fallback ?? <AccessDenied module={module} />}</>;
  return <>{children}</>;
}
