import { Plus, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { money, useProducts } from "@/lib/products";
import { SALE_STATUS_LABEL, useCreateSale, useCustomers, type SaleStatus } from "@/lib/sales";
import { CustomerDialog } from "./customer-dialog";

type Line = { key: number; product_id: string; quantity: string; unit_price: string };
const today = () => new Date().toISOString().slice(0, 10);
let seq = 0;
const blank = (): Line => ({ key: ++seq, product_id: "", quantity: "1", unit_price: "" });

export function SaleFormDialog({ open, onOpenChange, orgId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; orgId: string | undefined; onCreated: (id: string) => void }) {
  const { data: products = [] } = useProducts(orgId);
  const { data: customers = [] } = useCustomers(orgId);
  const create = useCreateSale(orgId);
  const active = products.filter((p) => p.is_active);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [customerId, setCustomerId] = useState("none");
  const [status, setStatus] = useState<SaleStatus>("completed");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [addCustomer, setAddCustomer] = useState(false);

  const reset = () => { setCustomerId("none"); setStatus("completed"); setDate(today()); setNotes(""); setDiscount("0"); setTax("0"); setLines([blank()]); };
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const subtotal = lines.reduce((s, l) => s + Math.round((Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * 100) / 100, 0);
  const total = Math.max(subtotal + (Number(tax) || 0) - (Number(discount) || 0), 0);

  const stockIssues = status === "completed"
    ? lines.filter((l) => { const p = byId.get(l.product_id); return p && Number(l.quantity) > p.stock_quantity; })
    : [];
  const valid = lines.length > 0 && lines.every((l) => l.product_id && Number(l.quantity) > 0 && Number(l.unit_price) >= 0 && l.unit_price !== "") && stockIssues.length === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    create.mutate({
      customer_id: customerId === "none" ? null : customerId,
      status, sold_at: `${date}T12:00:00`, notes: notes.trim(),
      discount: Number(discount) || 0, tax: Number(tax) || 0,
      items: lines.map((l) => ({ product_id: l.product_id, description: byId.get(l.product_id)?.name ?? "", quantity: Number(l.quantity), unit_price: Number(l.unit_price) })),
    }, {
      onSuccess: (id) => { toast.success("Sale created"); reset(); onOpenChange(false); onCreated(id); },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>New sale</DialogTitle>
              <DialogDescription>Completed sales reduce stock immediately. Pending and draft sales reduce stock when marked completed.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label>Customer</Label>
                <div className="flex gap-1.5">
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger aria-label="Customer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Walk-in customer</SelectItem>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" onClick={() => setAddCustomer(true)} aria-label="Add customer"><UserPlus className="size-4" /></Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as SaleStatus)}>
                  <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["draft", "pending", "completed"] as SaleStatus[]).map((s) => <SelectItem key={s} value={s}>{SALE_STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="s-date">Date</Label><Input id="s-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Products</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setLines((ls) => [...ls, blank()])}><Plus className="size-4" /> Add product</Button>
              </div>
              <div className="rounded-md border border-border">
                <div className="hidden grid-cols-[1fr_90px_120px_110px_36px] gap-2 border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:grid">
                  <span>Product</span><span>Qty</span><span>Unit price</span><span className="text-right">Line total</span><span />
                </div>
                {lines.map((l) => {
                  const p = byId.get(l.product_id);
                  const over = status === "completed" && p && Number(l.quantity) > p.stock_quantity;
                  return (
                    <div key={l.key} className="grid grid-cols-2 gap-2 border-b border-border px-3 py-2 last:border-b-0 sm:grid-cols-[1fr_90px_120px_110px_36px] sm:items-center">
                      <div className="col-span-2 sm:col-span-1">
                        <Select value={l.product_id} onValueChange={(v) => update(l.key, { product_id: v, unit_price: String(byId.get(v)?.unit_price ?? "") })}>
                          <SelectTrigger aria-label="Product"><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {active.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No active products</div>}
                            {active.map((ap) => <SelectItem key={ap.id} value={ap.id}>{ap.name} <span className="text-muted-foreground">· {ap.stock_quantity} in stock</span></SelectItem>)}
                          </SelectContent>
                        </Select>
                        {over && <p className="mt-1 text-xs text-destructive">Only {p.stock_quantity} in stock</p>}
                      </div>
                      <Input aria-label="Quantity" type="number" min="1" step="1" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} />
                      <Input aria-label="Unit price" type="number" min="0" step="0.01" value={l.unit_price} onChange={(e) => update(l.key, { unit_price: e.target.value })} />
                      <span className="text-right tabular-nums text-sm">{money((Number(l.quantity) || 0) * (Number(l.unit_price) || 0))}</span>
                      <Button type="button" size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove product"><Trash2 className="size-4" /></Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
              <div className="space-y-1.5"><Label htmlFor="s-notes">Notes</Label><Textarea id="s-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={4} /></div>
              <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
                <div className="flex items-center justify-between gap-2"><Label htmlFor="s-tax" className="font-normal text-muted-foreground">Tax</Label><Input id="s-tax" type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className="h-8 w-28 text-right" /></div>
                <div className="flex items-center justify-between gap-2"><Label htmlFor="s-disc" className="font-normal text-muted-foreground">Discount</Label><Input id="s-disc" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8 w-28 text-right" /></div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={!valid || create.isPending}>{create.isPending ? "Creating…" : "Create sale"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <CustomerDialog open={addCustomer} onOpenChange={setAddCustomer} orgId={orgId} onCreated={(c) => setCustomerId(c.id)} />
    </>
  );
}
