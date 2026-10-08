import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Mail, MapPin, Pencil, Phone, Trash2, Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/nexora/data/confirm-dialog";
import { RequirePermission } from "@/components/nexora/permission-gate";
import { SaleStatusBadge } from "@/components/nexora/sales/sale-status-badge";
import { Button } from "@/components/ui/button";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import { relativeTime } from "@/lib/activity";
import { useCustomer, useCustomerActivity, useCustomerSales, useDeleteCustomer } from "@/lib/customers";
import { money } from "@/lib/products";
import { CustomerFormDialog } from "./customer-form-dialog";

const card = "rounded-lg border border-border bg-card/60 p-4 backdrop-blur-xl";
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function CustomerProfilePage({ customerId }: { customerId: string }) {
  return <RequirePermission module="crm"><Inner id={customerId} /></RequirePermission>;
}

function Inner({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const perms = usePermissions();
  const canManage = perms.can("crm", "manage");
  const canSales = perms.can("sales");
  const c = useCustomer(orgId, id);
  const sales = useCustomerSales(orgId, id);
  const activity = useCustomerActivity(orgId, id);
  const del = useDeleteCustomer(orgId);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (c.isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
  if (!c.data) return <div className="mx-auto max-w-md text-center text-sm text-muted-foreground">Customer not found. <Link to="/crm" className="text-primary">Back to customers</Link></div>;
  const cu = c.data;
  const avg = cu.order_count ? cu.total_purchases / cu.order_count : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5 animate-nx-rise">
      <Link to="/crm" className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" /> Customers</Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{cu.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Customer since {fmt(cu.created_at)}</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</Button>
            <Button variant="outline" onClick={() => setConfirm(true)} className="text-destructive"><Trash2 className="size-4" /> Delete</Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[["Total purchases", money(cu.total_purchases)], ["Completed orders", String(cu.order_count)], ["Average order", money(avg)]].map(([l, v]) => (
          <div key={l} className={card}><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{l}</p><p className="mt-1 text-xl font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} space-y-3`}>
          <h2 className="text-sm font-semibold">Contact information</h2>
          {[[Mail, cu.email], [Phone, cu.phone], [Building2, cu.company], [MapPin, cu.address]].map(([Icon, v], i) => {
            const I = Icon as typeof Mail;
            return <p key={i} className="flex items-start gap-2 text-sm"><I className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{(v as string | null) ?? <span className="text-muted-foreground">Not provided</span>}</p>;
          })}
          {cu.notes && <p className="border-t border-border pt-3 text-sm whitespace-pre-wrap text-muted-foreground">{cu.notes}</p>}
        </div>

        <div className={`${card} lg:col-span-2`}>
          <h2 className="mb-3 text-sm font-semibold">Orders</h2>
          {sales.isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : !sales.data?.length ? (
            <p className="text-sm text-muted-foreground">No orders for this customer yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {sales.data.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  {canSales ? <Link to="/sales/$saleId" params={{ saleId: s.id }} className="font-mono text-xs font-medium text-primary">{s.reference ?? "—"}</Link> : <span className="font-mono text-xs">{s.reference ?? "—"}</span>}
                  <span className="hidden text-sm text-muted-foreground sm:inline">{fmt(s.sold_at)}</span>
                  <SaleStatusBadge status={s.status} />
                  <span className="text-sm font-medium tabular-nums">{money(s.total_amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-3 text-sm font-semibold">Activity</h2>
        {!activity.data?.length ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : (
          <ul className="space-y-2">
            {activity.data.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 text-sm"><span>{a.description ?? a.action}</span><span className="shrink-0 font-mono text-[11px] text-muted-foreground">{relativeTime(a.created_at)}</span></li>
            ))}
          </ul>
        )}
      </div>

      <CustomerFormDialog open={edit} onOpenChange={setEdit} orgId={orgId} customer={cu} />
      <ConfirmDialog
        open={confirm} onOpenChange={setConfirm} pending={del.isPending}
        title={`Delete ${cu.name}?`}
        description="The customer is removed permanently. Their past orders are kept but will no longer be linked to a customer."
        onConfirm={() => del.mutate(cu.id, {
          onSuccess: () => { toast.success("Customer deleted"); void navigate({ to: "/crm" }); },
          onError: (e) => toast.error(e.message),
        })}
      />
    </div>
  );
}
