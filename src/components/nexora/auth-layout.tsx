import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="pointer-events-none fixed inset-0 bg-command-grid opacity-60" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] animate-nx-rise">
          <Link to="/" className="mb-6 flex items-center justify-center gap-2.5" aria-label="NEXORA home">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground shadow-command">N</span>
            <span className="leading-none">
              <span className="block text-[16px] font-extrabold">NEXORA</span>
              <span className="mt-1 block font-mono text-[10px] text-muted-foreground">OPS · FOUNDATION</span>
            </span>
          </Link>
          <div className="rounded-lg border border-border bg-card/70 p-6 shadow-command backdrop-blur-xl md:p-7">
            <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-xs text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
