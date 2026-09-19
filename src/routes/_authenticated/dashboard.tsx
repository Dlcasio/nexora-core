import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CircleCheck, Sparkles } from "lucide-react";
import { dashboardModules } from "@/components/nexora/module-catalog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NEXORA" },
      { name: "description", content: "NEXORA business operations intelligence dashboard." },
      { property: "og:title", content: "Dashboard — NEXORA" },
      { property: "og:description", content: "A unified foundation for business operations intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl animate-nx-rise">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Operations console</p>
          <h1 className="text-2xl font-extrabold md:text-3xl">Welcome to NEXORA</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Your unified workspace for business operations intelligence.</p>
        </div>
        <span className="hidden items-center gap-2 font-mono text-[11px] text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-status" /> All systems nominal</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        {dashboardModules.slice(0, 6).map((module, index) => {
          const Icon = module.icon;
          return (
            <Link key={module.path} to={module.path} className="group rounded-lg border border-border bg-card/60 p-4 backdrop-blur-xl transition-colors hover:border-border-strong hover:bg-card">
              <div className="flex items-start justify-between">
                <span className={module.featured ? "grid size-9 place-items-center rounded-md bg-primary text-primary-foreground" : "grid size-9 place-items-center rounded-md bg-secondary text-foreground"}><Icon className="size-4" /></span>
                <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary">0{index + 1}</span>
              </div>
              <h2 className="mt-4 text-sm font-semibold">{module.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{module.description}</p>
              <span className="mt-3 flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground group-hover:text-primary">Open <ArrowRight className="size-3" /></span>
            </Link>
          );
        })}
      </div>
      <section className="mt-4 flex flex-col items-start gap-4 rounded-lg border border-border bg-card/60 p-5 backdrop-blur-xl sm:flex-row sm:items-center md:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Sparkles className="size-4" /></span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Your workspace is ready</h2>
          <p className="mt-1 text-xs text-muted-foreground">The application foundation is in place. Business modules will be added here when you need them.</p>
        </div>
        <span className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"><CircleCheck className="size-3.5 text-status" /> Foundation active</span>
      </section>
    </div>
  );
}
