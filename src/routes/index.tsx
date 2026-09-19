import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { modules } from "@/components/nexora/module-catalog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEXORA — Business Operations Intelligence" },
      { name: "description", content: "NEXORA unifies sales, inventory, people, finance and analytics in one operations workspace." },
      { property: "og:title", content: "NEXORA — Business Operations Intelligence" },
      { property: "og:description", content: "One secure workspace for your business operations intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();

  return (
    <div className="relative min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="pointer-events-none fixed inset-0 bg-command-grid opacity-60" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground shadow-command">N</span>
            <span className="leading-none">
              <span className="block text-[15px] font-extrabold">NEXORA</span>
              <span className="mt-1 block font-mono text-[10px] text-muted-foreground">OPS · FOUNDATION</span>
            </span>
          </span>
          {!loading && (
            user ? (
              <Button asChild size="sm"><Link to="/dashboard">Open dashboard</Link></Button>
            ) : (
              <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
            )
          )}
        </header>

        <main className="flex flex-1 flex-col justify-center py-14">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Business operations intelligence</p>
          <h1 className="max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">One secure workspace for how your business actually runs.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
            Sales, inventory, customers, people, projects, finance and analytics — brought together in a single operations console for teams of any size.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/auth"}>{user ? "Open dashboard" : "Get started"} <ArrowRight className="size-4" /></Link>
            </Button>
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-status" /> Secure account access
            </span>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {modules.filter((item) => item.group !== "Overview" && item.group !== "System").map((module) => {
              const Icon = module.icon;
              return (
                <div key={module.path} className="rounded-lg border border-border bg-card/60 p-3 backdrop-blur-xl">
                  <Icon className="size-4 text-primary" />
                  <p className="mt-2 text-xs font-semibold">{module.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{module.description}</p>
                </div>
              );
            })}
          </div>
        </main>

        <footer className="border-t border-border pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          NEXORA Operations · Foundation build
        </footer>
      </div>
    </div>
  );
}
