import { History } from "lucide-react";
import { useMemo } from "react";

import { DataTable, type Column } from "@/components/nexora/data/data-table";
import { MOVEMENT_LABEL, useStockMovements, type Product, type StockMovement } from "@/lib/products";
import { cn } from "@/lib/utils";

function Change({ n }: { n: number }) {
  return <span className={cn("font-medium tabular-nums", n > 0 ? "text-primary" : n < 0 ? "text-destructive" : "text-muted-foreground")}>{n > 0 ? `+${n}` : n}</span>;
}

/** Organization-wide inventory movement history table. */
export function MovementHistory({ organizationId, products }: { organizationId: string | undefined; products: Product[] }) {
  const q = useStockMovements(organizationId);
  const names = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const columns: Column<StockMovement>[] = [
    { key: "when", header: "Date", cell: (m) => <span className="whitespace-nowrap text-sm text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span> },
    { key: "product", header: "Product", cell: (m) => <span className="font-medium">{names.get(m.product_id) ?? "—"}</span> },
    { key: "type", header: "Type", cell: (m) => <span className="text-sm">{MOVEMENT_LABEL[m.movement_type]}</span> },
    { key: "change", header: "Change", align: "right", cell: (m) => <Change n={m.quantity_change} /> },
    { key: "after", header: "Stock after", align: "right", cell: (m) => m.quantity_after },
    { key: "note", header: "Note", className: "hidden md:table-cell max-w-xs truncate text-sm text-muted-foreground", cell: (m) => m.note ?? "" },
  ];
  return (
    <DataTable
      columns={columns}
      rows={q.data ?? []}
      loading={q.isLoading || !organizationId}
      error={q.error ? (q.error as Error).message : null}
      empty={<div className="flex flex-col items-center gap-2 py-6 text-muted-foreground"><History className="size-6" /><p className="text-sm">No stock movements yet.</p></div>}
    />
  );
}

/** Compact recent movements for one product. */
export function ProductMovements({ organizationId, productId }: { organizationId: string | undefined; productId: string }) {
  const q = useStockMovements(organizationId, productId);
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading history…</p>;
  if (!q.data?.length) return <p className="text-sm text-muted-foreground">No stock movements yet.</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {q.data.slice(0, 10).map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{MOVEMENT_LABEL[m.movement_type]}</p>
            <p className="truncate text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}{m.note ? ` · ${m.note}` : ""}</p>
          </div>
          <div className="text-right"><Change n={m.quantity_change} /><p className="text-xs text-muted-foreground">→ {m.quantity_after}</p></div>
        </li>
      ))}
    </ul>
  );
}
