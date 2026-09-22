import { Clock3 } from "lucide-react";

import { RequirePermission } from "./permission-gate";
import type { ModuleDefinition } from "./module-catalog";

export function ModulePage({ module }: { module: ModuleDefinition }) {
  const Icon = module.icon;
  return (
    <RequirePermission module={module.permission}>
    <div className="mx-auto max-w-6xl animate-nx-rise">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">NEXORA · {module.code}</p>
          <h1 className="text-2xl font-extrabold md:text-3xl">{module.title}</h1>
        </div>
        <span className="hidden items-center gap-2 font-mono text-[11px] text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-status" /> Foundation ready</span>
      </div>
      <section className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-border bg-card/60 p-8 text-center backdrop-blur-xl">
        <span className="grid size-12 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-5" /></span>
        <h2 className="mt-5 text-lg font-bold">{module.title} workspace</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{module.description}. This area is prepared for a future module and intentionally contains no placeholder business data.</p>
        <span className="mt-5 inline-flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><Clock3 className="size-3.5" /> Module not configured</span>
      </section>
    </div>
    </RequirePermission>
  );
}
