import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { initials, useAuth, useProfile } from "@/hooks/use-auth";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { cn } from "@/lib/utils";
import { modules } from "./module-catalog";

function AccountMenu() {
  const { user } = useAuth();
  const profile = useProfile(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const name = profile?.full_name ?? (user?.user_metadata?.['full_name'] as string | undefined) ?? null;
  const email = profile?.email ?? user?.email ?? null;

  async function handleSignOut() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="text-xs font-bold" aria-label="Open account menu">
          {initials(name, email)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate text-sm font-semibold">{name ?? "Your account"}</span>
          {email && <span className="block truncate font-mono text-[10px] font-normal text-muted-foreground">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">Workspace settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void handleSignOut(); }} disabled={signingOut}>
          <LogOut className="size-4" /> {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const groups = ["Overview", "Operations", "Intelligence"] as const;

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="NEXORA dashboard">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground shadow-command">N</span>
      {!compact && (
        <span className="min-w-0 leading-none">
          <span className="block text-[15px] font-extrabold">NEXORA</span>
          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">OPS · FOUNDATION</span>
        </span>
      )}
    </Link>
  );
}

function Navigation({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3" aria-label="Primary navigation">
      {groups.map((group) => (
        <div key={group}>
          {!compact && <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{group}</p>}
          <div className="space-y-0.5">
            {modules.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  activeOptions={{ exact: item.path === "/dashboard" }}
                  className={cn("group flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", compact && "justify-center px-0")}
                  activeProps={{ className: "bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground" }}
                  title={compact ? item.title : undefined}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                  {!compact && <span className="truncate">{item.title}</span>}
                  {!compact && item.featured && <span className="ml-auto font-mono text-[9px] text-primary group-data-[status=active]:text-primary-foreground">NEW</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Sidebar({ compact, onToggle }: { compact: boolean; onToggle: () => void }) {
  return (
    <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar/75 backdrop-blur-xl transition-[width] duration-300 md:flex", compact ? "w-[76px]" : "w-[264px]")}>
      <div className={cn("flex h-16 items-center border-b border-border px-5", compact && "justify-center px-0")}><Brand compact={compact} /></div>
      {!compact && (
        <div className="px-4 pb-2 pt-4">
          <Button variant="outline" className="h-auto w-full justify-between bg-card/70 px-3 py-2 text-left">
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded bg-secondary font-mono text-[10px] font-bold text-muted-foreground">NX</span>
              <span className="min-w-0"><span className="block truncate text-xs font-semibold">NEXORA Workspace</span><span className="block font-mono text-[10px] text-muted-foreground">Enterprise</span></span>
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      )}
      <Navigation compact={compact} />
      <div className="border-t border-border p-3">
        {!compact && modules.filter((item) => item.group === "System").map((item) => {
          const Icon = item.icon;
          return <Link key={item.path} to={item.path} className="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-primary font-semibold text-primary-foreground" }}><Icon className="size-4" />{item.title}</Link>;
        })}
        <Button variant="ghost" size="icon" onClick={onToggle} className={cn("mt-1 text-muted-foreground", !compact && "ml-auto")} aria-label={compact ? "Expand sidebar" : "Collapse sidebar"} title={compact ? "Expand sidebar" : "Collapse sidebar"}>
          {compact ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const currentTitle = modules.find((item) => item.path === pathname)?.title ?? "Dashboard";

  useEffect(() => {
    const stored = window.localStorage.getItem("nexora-theme");
    const nextDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("nexora-theme", next ? "dark" : "light");
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="pointer-events-none fixed inset-0 bg-command-grid opacity-60" />
      <div className="relative flex min-h-screen">
        <Sidebar compact={compact} onToggle={() => setCompact((value) => !value)} />
        {mobileOpen && <Button variant="ghost" aria-label="Close navigation" className="fixed inset-0 z-40 h-auto rounded-none bg-overlay p-0 hover:bg-overlay md:hidden" onClick={() => setMobileOpen(false)} />}
        <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col border-r border-border bg-sidebar shadow-2xl transition-transform duration-300 md:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex h-16 items-center justify-between border-b border-border px-5"><Brand /><Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></Button></div>
          <div className="px-4 pb-2 pt-4"><div className="rounded-md border border-border bg-card/70 px-3 py-2"><p className="text-xs font-semibold">NEXORA Workspace</p><p className="font-mono text-[10px] text-muted-foreground">Enterprise</p></div></div>
          <Navigation onNavigate={() => setMobileOpen(false)} />
          <div className="border-t border-border p-3">{modules.filter((item) => item.group === "System").map((item) => { const Icon = item.icon; return <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent"><Icon className="size-4" />{item.title}</Link>; })}</div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/75 px-4 backdrop-blur-xl md:px-6">
            <Button variant="outline" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></Button>
            <div className="hidden items-center gap-2 font-mono text-[11px] text-muted-foreground sm:flex"><span>Workspace</span><span className="opacity-40">/</span><span className="font-medium text-foreground">{currentTitle}</span></div>
            <div className="mx-auto flex h-9 max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-card/70 px-3 text-sm text-muted-foreground shadow-xs">
              <Search className="size-4 opacity-70" /><span className="min-w-0 flex-1 truncate">Search modules, records…</span><kbd className="hidden rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] sm:block">⌘K</kbd>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" aria-label="Notifications" title="Notifications" className="relative"><Bell /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" /></Button>
              <Button variant="outline" size="icon" onClick={toggleTheme} aria-label={dark ? "Use light mode" : "Use dark mode"} title={dark ? "Use light mode" : "Use dark mode"}>{dark ? <Sun /> : <Moon />}</Button>
              <AccountMenu />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}