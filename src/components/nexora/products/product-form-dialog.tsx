import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCategory, useSaveProduct, type Category, type Product, type ProductInput } from "@/lib/products";

const NONE = "__none";

type FormState = { name: string; sku: string; description: string; category_id: string; unit_price: string; cost_price: string; stock_quantity: string; reorder_level: string; is_active: boolean };

function toForm(p?: Product | null): FormState {
  return {
    name: p?.name ?? "", sku: p?.sku ?? "", description: p?.description ?? "", category_id: p?.category_id ?? NONE,
    unit_price: p ? String(p.unit_price) : "", cost_price: p ? String(p.cost_price) : "",
    stock_quantity: p ? String(p.stock_quantity) : "0", reorder_level: p ? String(p.reorder_level) : "0", is_active: p?.is_active ?? true,
  };
}

function validate(f: FormState): { input?: ProductInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = f.name.trim();
  if (!name) errors["name"] = "Name is required.";
  else if (name.length > 200) errors["name"] = "Keep it under 200 characters.";
  if (f.sku.trim().length > 64) errors["sku"] = "Keep it under 64 characters.";
  const money = (v: string, k: string) => {
    const n = Number(v);
    if (v.trim() === "" || !Number.isFinite(n) || n < 0) errors[k] = "Enter an amount of 0 or more.";
    return Math.round(n * 100) / 100;
  };
  const int = (v: string, k: string) => {
    const n = Number(v);
    if (v.trim() === "" || !Number.isInteger(n) || n < 0) errors[k] = "Enter a whole number of 0 or more.";
    return n;
  };
  const input: ProductInput = {
    name, sku: f.sku.trim() || null, description: f.description.trim() || null,
    category_id: f.category_id === NONE ? null : f.category_id,
    unit_price: money(f.unit_price, "unit_price"), cost_price: money(f.cost_price, "cost_price"),
    stock_quantity: int(f.stock_quantity, "stock_quantity"), reorder_level: int(f.reorder_level, "reorder_level"),
    is_active: f.is_active,
  };
  return Object.keys(errors).length ? { errors } : { input, errors };
}

export function ProductFormDialog({
  open, onOpenChange, product, categories, organizationId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: Product | null;
  categories: Category[];
  organizationId: string | undefined;
}) {
  const [form, setForm] = useState<FormState>(toForm(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const save = useSaveProduct(organizationId);
  const createCategory = useCreateCategory(organizationId);

  useEffect(() => { if (open) { setForm(toForm(product)); setErrors({}); setNewCategory(null); } }, [open, product]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function addCategory() {
    const name = newCategory?.trim();
    if (!name) return;
    try {
      const c = await createCategory.mutateAsync(name);
      set("category_id", c.id);
      setNewCategory(null);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { input, errors } = validate(form);
    setErrors(errors);
    if (!input) return;
    try {
      await save.mutateAsync({ id: product?.id, input });
      toast.success(product ? "Product updated" : "Product created");
      onOpenChange(false);
    } catch (err) { toast.error((err as Error).message); }
  }

  const field = (k: keyof FormState, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`p-${k}`}>{label}</Label>
      <Input id={`p-${k}`} value={form[k] as string} onChange={(e) => set(k, e.target.value as never)} aria-invalid={!!errors[k]} {...props} />
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>Product details, pricing and stock thresholds.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {field("name", "Name", { autoFocus: true, maxLength: 200 })}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("sku", "SKU", { maxLength: 64, placeholder: "Optional", className: "font-mono" })}
            <div className="space-y-1.5">
              <Label>Category</Label>
              {newCategory === null ? (
                <Select value={form.category_id} onValueChange={(v) => (v === "__new" ? setNewCategory("") : set("category_id", v))}>
                  <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Uncategorized</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    <SelectItem value="__new"><span className="inline-flex items-center gap-1 text-primary"><Plus className="size-3.5" />New category</span></SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input autoFocus value={newCategory} maxLength={100} placeholder="Category name" onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addCategory(); } if (e.key === "Escape") { e.stopPropagation(); setNewCategory(null); } }} />
                  <Button type="button" size="sm" onClick={addCategory} disabled={createCategory.isPending || !newCategory.trim()}>Add</Button>
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("unit_price", "Price", { type: "number", min: 0, step: "0.01", inputMode: "decimal" })}
            {field("cost_price", "Cost", { type: "number", min: 0, step: "0.01", inputMode: "decimal" })}
            {field("stock_quantity", "Stock quantity", { type: "number", min: 0, step: 1, inputMode: "numeric" })}
            {field("reorder_level", "Minimum stock level", { type: "number", min: 0, step: 1, inputMode: "numeric" })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-description">Description</Label>
            <Textarea id="p-description" rows={3} maxLength={2000} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="p-active">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive products stay on record but are hidden from selling.</p>
            </div>
            <Switch id="p-active" checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : product ? "Save changes" : "Create product"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
