import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/nexora/data/confirm-dialog";
import { RequirePermission } from "@/components/nexora/permission-gate";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import { money } from "@/lib/products";
import { NEXT_STATUSES, SALE_STATUS_LABEL, useSale, useUpdateSaleStatus, type SaleStatus } from "@/lib/sales";
import { SaleStatusBadge } from "./sale-status-badge";
import { formatDate } from "./sales-page";

const STATUS_HINT: Partial<Record<SaleStatus, string>> = {
  completed: "Stock for every product in this sale will be reduced now.",
  cancelled: "If this sale was completed, its stock is returned.",
  refunded: "Stock for every product in this sale is returned.",
};

export function SaleDetailsPage({ saleId }: { saleId: string }) {
  return <RequirePermission module="sales"><Inner saleId={saleId} /></RequirePermission>;
}

function Inner({ saleId }: { saleId: string }) {
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const canManage = usePermissions().can("sales", "manage");
  const { data: sale, isLoading, error } = useSale(orgId, saleId);
  const updateStatus = useUpdateSaleStatus(orgId);
  const [pending, setPending] = useState<SaleStatus | null>(null);

  const back = (
    <Link to="/sales" className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3.5" /> Sales orders
    </Link>
  );

  if (isLoading || !orgId) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
  if (error) return <div className="mx-auto max-w-5xl space-y-4">{back}<p className="text-sm text-destructive">{(error as Error).message}</p></div>;
  if (!sale) return <div className="mx-auto max-w-5xl space-y-4">{back}<p className="text-sm text-muted-foreground">This sale doesn't exist or belongs to another organization.</p></div>;

  const confirm = () => {
    if (!pending) return;
    updateStatus.mutate({ id: sale.id, status: pending }, {
      onSuccess: () => { toast.success(`Sale marked ${SALE_STATUS_LABEL[pending].toLowerCase()}`); setPending(null); },
      onError: (e) => { toast.error(e.message); setPending(null); },
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-nx-rise">
      {back}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{sale.reference ?? "Sale"}</h1>
            <SaleStatusBadge status={sale.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{formatDate(sale.sold_at)} · {sale.customer?.name ?? "Walk-in customer"}</p>
        </div>
        {canManage && NEXT_STATUSES[sale.status].length > 0 && (
          <div className="flex flex-wrap gap-2">
            {NEXT_STATUSES[sale.status].map((s) => (
              <Button key={s} size="sm" variant={s === "completed" ? "default" : "outline"} onClick={() => setPending(s)}>
                Mark {SALE_STATUS_LABEL[s].toLowerCase()}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="rounded-lg border border-border bg-card/60 backdrop-blur-xl">
          <Table>
            <TableHeader>
              <TableRow>
                {["Product", "Qty", "Unit price", "Line total"].map((h, i) => (
                  <TableHead key={h} className={`font-mono text-[10px] uppercase tracking-[0.14em] ${i > 0 ? "text-right" : ""}`}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <p className="font-medium">{i.product?.name ?? i.description ?? "Removed product"}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{i.product?.sku ?? ""}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(i.unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{money(i.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="ml-auto max-w-xs space-y-1.5 border-t border-border p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(sale.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{money(sale.tax_amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">−{money(sale.discount_amount)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums">{money(sale.total_amount)}</span></div>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-xl">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Customer</h2>
            {sale.customer ? (
              <div className="mt-2 space-y-0.5 text-sm">
                <p className="font-medium">{sale.customer.name}</p>
                {sale.customer.company && <p className="text-muted-foreground">{sale.customer.company}</p>}
                {sale.customer.email && <p className="text-muted-foreground">{sale.customer.email}</p>}
                {sale.customer.phone && <p className="text-muted-foreground">{sale.customer.phone}</p>}
              </div>
            ) : <p className="mt-2 text-sm text-muted-foreground">Walk-in customer</p>}
          </section>
          <section className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-xl">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Inventory</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {sale.status === "completed" ? "Stock has been deducted for this sale." :
               sale.status === "refunded" || sale.status === "cancelled" ? "No stock is held by this sale." :
               "Stock will be deducted when this sale is completed."}
            </p>
          </section>
          {sale.notes && (
            <section className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-xl">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{sale.notes}</p>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? `Mark sale ${SALE_STATUS_LABEL[pending].toLowerCase()}?` : ""}
        description={(pending && STATUS_HINT[pending]) ?? "This updates the sale status."}
        confirmLabel={pending ? `Mark ${SALE_STATUS_LABEL[pending].toLowerCase()}` : "Confirm"}
        pending={updateStatus.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
