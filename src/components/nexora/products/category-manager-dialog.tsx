import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/nexora/data/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateCategory, useDeleteCategory, useUpdateCategory, type Category, type Product } from "@/lib/products";

/** Create, rename and delete organization-scoped product categories. */
export function CategoryManagerDialog({
  open, onOpenChange, categories, products, organizationId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: Category[];
  products: Product[];
  organizationId: string | undefined;
}) {
  const create = useCreateCategory(organizationId);
  const update = useUpdateCategory(organizationId);
  const del = useDeleteCategory(organizationId);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState<Category | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => p.category_id && m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1));
    return m;
  }, [products]);

  const validName = (v: string) => {
    const t = v.trim();
    if (!t) { toast.error("Enter a category name."); return null; }
    if (t.length > 80) { toast.error("Keep it under 80 characters."); return null; }
    return t;
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const t = validName(name);
    if (!t) return;
    try { await create.mutateAsync(t); setName(""); toast.success("Category created"); }
    catch (err) { toast.error((err as Error).message); }
  };

  const save = async (id: string) => {
    const t = validName(editName);
    if (!t) return;
    try { await update.mutateAsync({ id, name: t }); setEditingId(null); toast.success("Category renamed"); }
    catch (err) { toast.error((err as Error).message); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Categories</DialogTitle>
            <DialogDescription>Group products for easier filtering. Only your organization sees these.</DialogDescription>
          </DialogHeader>
          <form onSubmit={add} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" aria-label="New category name" maxLength={80} />
            <Button type="submit" disabled={create.isPending}><Plus className="size-4" />Add</Button>
          </form>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {categories.length === 0 && (
              <li className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground"><Tags className="size-5" />No categories yet.</li>
            )}
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                {editingId === c.id ? (
                  <>
                    <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Category name" maxLength={80} className="h-8"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(c.id); } if (e.key === "Escape") setEditingId(null); }} />
                    <Button size="icon" variant="ghost" className="size-8" aria-label="Save" disabled={update.isPending} onClick={() => void save(c.id)}><Check className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-8" aria-label="Cancel" onClick={() => setEditingId(null)}><X className="size-4" /></Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{counts.get(c.id) ?? 0}</span>
                    <Button size="icon" variant="ghost" className="size-8" aria-label={`Rename ${c.name}`} onClick={() => { setEditingId(c.id); setEditName(c.name); }}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}><Trash2 className="size-4" /></Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "category"}?`}
        description={`${deleting ? counts.get(deleting.id) ?? 0 : 0} product(s) will become uncategorized. The products themselves are kept.`}
        pending={del.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try { await del.mutateAsync(deleting.id); toast.success("Category deleted"); setDeleting(null); }
          catch (err) { toast.error((err as Error).message); }
        }}
      />
    </>
  );
}
