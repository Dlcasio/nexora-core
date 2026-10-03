import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRecordMovement, type Product } from "@/lib/products";

export type MovementKind = "stock_in" | "stock_out" | "adjustment";

const COPY: Record<MovementKind, { title: string; label: string; action: string }> = {
  stock_in: { title: "Stock in", label: "Quantity received", action: "Add stock" },
  stock_out: { title: "Stock out", label: "Quantity removed", action: "Remove stock" },
  adjustment: { title: "Stock adjustment", label: "Counted quantity", action: "Set stock" },
};

/** Records a stock in / out / adjustment through the atomic database function. */
export function StockMovementDialog({
  product, kind, onClose, organizationId,
}: {
  product: Product | null;
  kind: MovementKind;
  onClose: () => void;
  organizationId: string | undefined;
}) {
  const record = useRecordMovement(organizationId);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) { setQty(kind === "adjustment" ? String(product.stock_quantity) : ""); setNote(""); setError(null); }
  }, [product, kind]);

  const c = COPY[kind];
  const n = Number(qty);
  const preview = !product || qty.trim() === "" || !Number.isInteger(n) ? null
    : kind === "stock_in" ? product.stock_quantity + n : kind === "stock_out" ? product.stock_quantity - n : n;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!Number.isInteger(n) || n < 0 || (kind !== "adjustment" && n === 0)) { setError("Enter a whole number" + (kind === "adjustment" ? " of 0 or more." : " greater than 0.")); return; }
    if (kind === "stock_out" && n > product.stock_quantity) { setError(`Only ${product.stock_quantity} in stock.`); return; }
    try {
      await record.mutateAsync({ productId: product.id, type: kind, quantity: n, note: note.slice(0, 500) });
      toast.success(`${c.title} recorded`);
      onClose();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{c.title}</DialogTitle>
            <DialogDescription>{product?.name} · currently {product?.stock_quantity} in stock</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="mv-qty">{c.label}</Label>
            <Input id="mv-qty" type="number" min={0} step={1} inputMode="numeric" autoFocus value={qty} onChange={(e) => { setQty(e.target.value); setError(null); }} aria-invalid={!!error} />
            {preview !== null && <p className="text-xs text-muted-foreground">New stock: <span className={preview < 0 ? "text-destructive" : "font-medium text-foreground"}>{preview}</span></p>}
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-note">Note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="mv-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier delivery, damaged goods, stock count…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={record.isPending}>{record.isPending ? "Saving…" : c.action}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
