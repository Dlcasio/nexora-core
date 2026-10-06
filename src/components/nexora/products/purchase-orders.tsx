import { PackageCheck, Plus, Trash2, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/nexora/data/confirm-dialog";
import { DataTable, type Column } from "@/components/nexora/data/data-table";
import { DataToolbar, FilterSelect, SearchInput } from "@/components/nexora/data/data-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { money, type Product } from "@/lib/products";
import {
  PURCHASE_STATUS_LABEL, useCreatePurchaseOrder, useCreateSupplier, usePurchaseOrders, useReceivePurchaseOrder,
  useSetPurchaseStatus, useSuppliers, type PurchaseOrder, type PurchaseStatus,
} from "@/lib/purchases";

function StatusBadge({ s }: { s: PurchaseStatus }) {
  const v = s === "received" ? "default" : s === "cancelled" ? "destructive" : s === "ordered" ? "secondary" : "outline";
  return <Badge variant={v} className="font-mono text-[10px]">{PURCHASE_STATUS_LABEL[s]}</Badge>;
}

export function PurchaseOrdersPanel({ organizationId, products, canManage }: { organizationId: string | undefined; products: Product[]; canManage: boolean }) {
  const orders = usePurchaseOrders(organizationId);
  const { data: suppliers = [] } = useSuppliers(organizationId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const supName = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const viewing = orders.data?.find((o) => o.id === viewId) ?? null;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (orders.data ?? []).filter((o) =>
      (!q || o.reference.toLowerCase().includes(q) || (supName.get(o.supplier_id ?? "") ?? "").toLowerCase().includes(q)) &&
      (status === "all" || o.status === status));
  }, [orders.data, search, status, supName]);

  const columns: Column<PurchaseOrder>[] = [
    { key: "ref", header: "Order", cell: (o) => <span className="font-mono text-sm">{o.reference}</span> },
    { key: "sup", header: "Supplier", cell: (o) => supName.get(o.supplier_id ?? "") ?? "—" },
    { key: "date", header: "Ordered", className: "hidden md:table-cell", cell: (o) => new Date(o.ordered_on).toLocaleDateString() },
    { key: "items", header: "Items", align: "right", className: "hidden sm:table-cell", cell: (o) => o.items.reduce((a, i) => a + i.quantity, 0) },
    { key: "status", header: "Status", cell: (o) => <StatusBadge s={o.status} /> },
    { key: "total", header: "Total", align: "right", cell: (o) => money(o.total_amount) },
  ];

  return (
    <section className="rounded-lg border border-border bg-card/60 backdrop-blur-xl">
      <DataToolbar actions={canManage ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" />New purchase order</Button> : undefined}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search order or supplier" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "Any status" }, ...Object.entries(PURCHASE_STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
      </DataToolbar>
      <DataTable columns={columns} rows={rows} loading={orders.isLoading || !organizationId}
        error={orders.error ? (orders.error as Error).message : null} onRowClick={(o) => setViewId(o.id)}
        empty={<div className="flex flex-col items-center gap-2 py-6 text-muted-foreground"><Truck className="size-6" /><p className="text-sm">No purchase orders yet.</p></div>} />
      {canManage && <CreatePurchaseOrderDialog open={creating} onOpenChange={setCreating} organizationId={organizationId} products={products} />}
      <PurchaseOrderSheet order={viewing} onClose={() => setViewId(null)} supplier={viewing ? supName.get(viewing.supplier_id ?? "") : undefined} products={products} organizationId={organizationId} canManage={canManage} />
    </section>
  );
}

function PurchaseOrderSheet({ order, onClose, supplier, products, organizationId, canManage }: {
  order: PurchaseOrder | null; onClose: () => void; supplier: string | undefined; products: Product[]; organizationId: string | undefined; canManage: boolean;
}) {
  const receive = useReceivePurchaseOrder(organizationId);
  const setStatus = useSetPurchaseStatus(organizationId);
  const [confirm, setConfirm] = useState<"receive" | "cancel" | null>(null);
  const pName = new Map(products.map((p) => [p.id, p.name]));
  const run = async () => {
    if (!order) return;
    try {
      if (confirm === "receive") { await receive.mutateAsync(order.id); toast.success(`${order.reference} received — stock updated`); }
      else { await setStatus.mutateAsync({ id: order.id, status: "cancelled" }); toast.success("Purchase order cancelled"); }
      setConfirm(null);
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Sheet open={!!order} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {order && (<>
          <SheetHeader>
            <SheetTitle className="font-mono">{order.reference}</SheetTitle>
            <SheetDescription>{supplier ?? "Unknown supplier"}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4 pb-6">
            <div className="flex items-center gap-2"><StatusBadge s={order.status} />
              {order.received_at && <span className="text-xs text-muted-foreground">Received {new Date(order.received_at).toLocaleString()}</span>}</div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[["Ordered", new Date(order.ordered_on).toLocaleDateString()], ["Expected", order.expected_on ? new Date(order.expected_on).toLocaleDateString() : "—"]].map(([k, v]) => (
                <div key={k} className="rounded-md border border-border p-3"><dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{k}</dt><dd className="mt-1 font-medium">{v}</dd></div>
              ))}
            </dl>
            <div className="divide-y divide-border rounded-md border border-border text-sm">
              {order.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0"><p className="truncate font-medium">{pName.get(i.product_id) ?? "Product"}</p><p className="text-xs text-muted-foreground tabular-nums">{i.quantity} × {money(i.unit_cost)}</p></div>
                  <span className="tabular-nums">{money(i.line_total)}</span>
                </div>
              ))}
              <div className="flex justify-between p-3 font-semibold"><span>Total</span><span className="tabular-nums">{money(order.total_amount)}</span></div>
            </div>
            {order.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{order.notes}</p>}
            {canManage && (order.status === "draft" || order.status === "ordered") && (
              <div className="flex flex-wrap gap-2">
                {order.status === "draft" && <Button className="flex-1" disabled={setStatus.isPending} onClick={async () => {
                  try { await setStatus.mutateAsync({ id: order.id, status: "ordered" }); toast.success("Marked as ordered"); } catch (e) { toast.error((e as Error).message); }
                }}><Truck className="size-4" />Mark as ordered</Button>}
                {order.status === "ordered" && <Button className="flex-1" onClick={() => setConfirm("receive")}><PackageCheck className="size-4" />Receive stock</Button>}
                <Button variant="outline" onClick={() => setConfirm("cancel")}>Cancel order</Button>
              </div>
            )}
          </div>
        </>)}
        <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}
          title={confirm === "receive" ? `Receive ${order?.reference}?` : `Cancel ${order?.reference}?`}
          description={confirm === "receive" ? "All items will be added to stock and recorded in movement history. This can't be undone." : "The order will be closed without changing stock."}
          confirmLabel={confirm === "receive" ? "Receive" : "Cancel order"} pending={receive.isPending || setStatus.isPending} onConfirm={run} />
      </SheetContent>
    </Sheet>
  );
}

type Line = { key: number; product_id: string; quantity: string; unit_cost: string };
const today = () => new Date().toISOString().slice(0, 10);

function CreatePurchaseOrderDialog({ open, onOpenChange, organizationId, products }: { open: boolean; onOpenChange: (o: boolean) => void; organizationId: string | undefined; products: Product[] }) {
  const { data: suppliers = [] } = useSuppliers(organizationId);
  const create = useCreatePurchaseOrder(organizationId);
  const addSupplier = useCreateSupplier(organizationId);
  const [supplierId, setSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "ordered">("ordered");
  const [orderedOn, setOrderedOn] = useState(today());
  const [expectedOn, setExpectedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: 1, product_id: "", quantity: "1", unit_cost: "" }]);
  const active = products.filter((p) => p.is_active);

  const reset = () => { setSupplierId(""); setNewSupplier(null); setStatus("ordered"); setOrderedOn(today()); setExpectedOn(""); setNotes(""); setLines([{ key: 1, product_id: "", quantity: "1", unit_cost: "" }]); };
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const total = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);

  const saveSupplier = async () => {
    if (!newSupplier?.trim()) return;
    try { const s = await addSupplier.mutateAsync({ name: newSupplier.trim(), email: null, phone: null }); setSupplierId(s.id); setNewSupplier(null); }
    catch (e) { toast.error((e as Error).message); }
  };

  const submit = async (): Promise<void> => {
    if (!supplierId) { toast.error("Select a supplier"); return; }
    const items = lines.filter((l) => l.product_id).map((l) => ({ product_id: l.product_id, quantity: Math.floor(Number(l.quantity)), unit_cost: Number(l.unit_cost) }));
    if (items.length === 0) { toast.error("Add at least one product"); return; }
    if (items.some((i) => !(i.quantity > 0) || !(i.unit_cost >= 0) || Number.isNaN(i.unit_cost))) { toast.error("Each line needs a whole quantity above zero and a valid cost"); return; }
    try {
      await create.mutateAsync({ supplierId, status, orderedOn, expectedOn: expectedOn || null, notes, items });
      toast.success("Purchase order created");
      reset(); onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>New purchase order</DialogTitle><DialogDescription>Order stock from a supplier. Stock increases when you receive it.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Supplier</Label>
              {newSupplier === null ? (
                <Select value={supplierId} onValueChange={(v) => (v === "__new" ? setNewSupplier("") : setSupplierId(v))}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    <SelectItem value="__new">+ Add new supplier</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input autoFocus value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} placeholder="Supplier name" />
                  <Button type="button" size="sm" onClick={saveSupplier} disabled={addSupplier.isPending}>Add</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setNewSupplier(null)}>Cancel</Button>
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "ordered")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="ordered">Ordered</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="po-ordered">Order date</Label><Input id="po-ordered" type="date" value={orderedOn} onChange={(e) => setOrderedOn(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="po-expected">Expected delivery</Label><Input id="po-expected" type="date" value={expectedOn} onChange={(e) => setExpectedOn(e.target.value)} /></div>
          </div>

          <div className="grid gap-2">
            <Label>Products</Label>
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[1fr_5rem_6rem_auto] items-center gap-2">
                <Select value={l.product_id} onValueChange={(v) => update(l.key, { product_id: v, unit_cost: l.unit_cost || String(active.find((p) => p.id === v)?.cost_price ?? "") })}>
                  <SelectTrigger aria-label="Product"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{active.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</SelectItem>)}</SelectContent>
                </Select>
                <Input aria-label="Quantity" type="number" min={1} step={1} value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} />
                <Input aria-label="Unit cost" type="number" min={0} step="0.01" placeholder="Cost" value={l.unit_cost} onChange={(e) => update(l.key, { unit_cost: e.target.value })} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setLines((ls) => [...ls, { key: Date.now(), product_id: "", quantity: "1", unit_cost: "" }])}><Plus className="size-4" />Add product</Button>
          </div>

          <div className="grid gap-1.5"><Label htmlFor="po-notes">Notes</Label><Textarea id="po-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex justify-between rounded-md border border-border p-3 text-sm font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? "Saving…" : "Create purchase order"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
