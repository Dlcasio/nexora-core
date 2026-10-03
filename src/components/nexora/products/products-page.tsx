import { ProductFormDialog as ProductFormDialogLazy } from "./product-form-dialog";
import { ArrowDownToLine, ArrowUpFromLine, MoreHorizontal, Package, Pencil, Plus, SlidersHorizontal, Tags, Trash2 } from "lucide-react";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { MovementHistory, ProductMovements } from "./movement-history";
import { StockMovementDialog, type MovementKind } from "./stock-movement-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/nexora/data/confirm-dialog";
import { DataTable, type Column } from "@/components/nexora/data/data-table";
import { DataToolbar, FilterSelect, SearchInput } from "@/components/nexora/data/data-toolbar";
import { RequirePermission } from "@/components/nexora/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { usePermissions } from "@/hooks/use-permissions";
import { money, stockState, useCategories, useDeleteProduct, useProducts, type Product, type StockState } from "@/lib/products";

const STOCK_LABEL: Record<StockState, string> = { in_stock: "In stock", low: "Low stock", out: "Out of stock" };

function StockBadge({ p }: { p: Product }) {
  const s = stockState(p);
  return <Badge variant={s === "out" ? "destructive" : s === "low" ? "secondary" : "outline"} className="font-mono text-[10px]">{STOCK_LABEL[s]}</Badge>;
}

export function ProductsPage() {
  return <RequirePermission module="inventory"><ProductsInner /></RequirePermission>;
}

function ProductsInner() {
  const { data: membership } = useCurrentOrganization();
  const orgId = membership?.organization.id;
  const { can } = usePermissions();
  const canManage = can("inventory", "manage");
  const products = useProducts(orgId);
  const { data: categories = [] } = useCategories(orgId);
  const del = useDeleteProduct(orgId);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewingRaw, setViewing] = useState<Product | null>(null);
  const viewing = viewingRaw ? products.data?.find((p) => p.id === viewingRaw.id) ?? viewingRaw : null;
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [moving, setMoving] = useState<{ product: Product; kind: MovementKind } | null>(null);
  const move = (product: Product, kind: MovementKind) => setMoving({ product, kind });

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products.data ?? []).filter((p) =>
      (!q || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)) &&
      (category === "all" || (category === "none" ? !p.category_id : p.category_id === category)) &&
      (stock === "all" || stockState(p) === stock) &&
      (status === "all" || (status === "active") === p.is_active),
    );
  }, [products.data, search, category, stock, status]);

  const openEdit = (p: Product | null) => { setEditing(p); setFormOpen(true); setViewing(null); };

  const columns: Column<Product>[] = [
    { key: "name", header: "Product", cell: (p) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{p.name}{!p.is_active && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{p.sku ?? "No SKU"}</p>
      </div>
    ) },
    { key: "category", header: "Category", className: "hidden md:table-cell", cell: (p) => <span className="text-sm text-muted-foreground">{p.category_id ? catName.get(p.category_id) ?? "—" : "Uncategorized"}</span> },
    { key: "price", header: "Price", align: "right", cell: (p) => money(p.unit_price) },
    { key: "cost", header: "Cost", align: "right", className: "hidden lg:table-cell", cell: (p) => <span className="text-muted-foreground">{money(p.cost_price)}</span> },
    { key: "stock", header: "Stock", align: "right", cell: (p) => <span>{p.stock_quantity}<span className="text-muted-foreground"> / {p.reorder_level}</span></span> },
    { key: "state", header: "Status", className: "hidden sm:table-cell", cell: (p) => <StockBadge p={p} /> },
    ...(canManage ? [{ key: "actions", header: "", className: "w-10", cell: (p: Product) => (
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${p.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => move(p, "stock_in")}><ArrowDownToLine className="size-4" />Stock in</DropdownMenuItem>
            <DropdownMenuItem onClick={() => move(p, "stock_out")}><ArrowUpFromLine className="size-4" />Stock out</DropdownMenuItem>
            <DropdownMenuItem onClick={() => move(p, "adjustment")}><SlidersHorizontal className="size-4" />Adjust stock</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="size-4" />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleting(p)} className="text-destructive focus:text-destructive"><Trash2 className="size-4" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ) }] : []),
  ];

  const total = products.data?.length ?? 0;
  const lowCount = (products.data ?? []).filter((p) => stockState(p) === "low").length;
  const outCount = (products.data ?? []).filter((p) => stockState(p) === "out").length;

  return (
    <div className="mx-auto max-w-6xl animate-nx-rise">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">NEXORA · 02 · Inventory</p>
          <h1 className="text-2xl font-extrabold md:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} products · {lowCount} low stock · {outCount} out of stock</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCatsOpen(true)}><Tags className="size-4" />Categories</Button>
            <Button onClick={() => openEdit(null)}><Plus className="size-4" />New product</Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="products">
      <TabsList className="mb-3">
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="movements">Movement history</TabsTrigger>
      </TabsList>
      <TabsContent value="products">
      <section className="rounded-lg border border-border bg-card/60 backdrop-blur-xl">
        <DataToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or SKU" />
          <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, { value: "none", label: "Uncategorized" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
          <FilterSelect label="Stock" value={stock} onChange={setStock} options={[{ value: "all", label: "Any stock" }, { value: "in_stock", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }]} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        </DataToolbar>
        <DataTable
          columns={columns}
          rows={rows}
          loading={products.isLoading || !orgId}
          error={products.error ? (products.error as Error).message : null}
          onRowClick={setViewing}
          empty={
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
              <Package className="size-6" />
              <p className="text-sm">{total === 0 ? "No products yet." : "No products match these filters."}</p>
              {total === 0 && canManage && <Button size="sm" variant="outline" onClick={() => openEdit(null)}><Plus className="size-4" />Add your first product</Button>}
            </div>
          }
        />
      </section>
      </TabsContent>
      <TabsContent value="movements">
        <section className="rounded-lg border border-border bg-card/60 backdrop-blur-xl">
          <MovementHistory organizationId={orgId} products={products.data ?? []} />
        </section>
      </TabsContent>
      </Tabs>

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.name}</SheetTitle>
                <SheetDescription className="font-mono">{viewing.sku ?? "No SKU"}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                <div className="flex gap-2"><StockBadge p={viewing} />{!viewing.is_active && <Badge variant="outline">Inactive</Badge>}</div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Category", viewing.category_id ? catName.get(viewing.category_id) ?? "—" : "Uncategorized"],
                    ["Price", money(viewing.unit_price)],
                    ["Cost", money(viewing.cost_price)],
                    ["Margin", viewing.unit_price > 0 ? `${(((viewing.unit_price - viewing.cost_price) / viewing.unit_price) * 100).toFixed(1)}%` : "—"],
                    ["Stock quantity", String(viewing.stock_quantity)],
                    ["Minimum stock", String(viewing.reorder_level)],
                    ["Stock value", money(viewing.cost_price * viewing.stock_quantity)],
                    ["Updated", new Date(viewing.updated_at).toLocaleDateString()],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md border border-border p-3">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{k}</dt>
                      <dd className="mt-1 font-medium tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                {viewing.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{viewing.description}</p>}
                {canManage && (
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant="outline" onClick={() => move(viewing, "stock_in")}><ArrowDownToLine className="size-4" />In</Button>
                    <Button size="sm" variant="outline" onClick={() => move(viewing, "stock_out")}><ArrowUpFromLine className="size-4" />Out</Button>
                    <Button size="sm" variant="outline" onClick={() => move(viewing, "adjustment")}><SlidersHorizontal className="size-4" />Adjust</Button>
                  </div>
                )}
                <div className="space-y-2">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Stock history</h3>
                  <ProductMovements organizationId={orgId} productId={viewing.id} />
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => openEdit(viewing)}><Pencil className="size-4" />Edit</Button>
                    <Button variant="outline" onClick={() => setDeleting(viewing)}><Trash2 className="size-4" />Delete</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {canManage && (
        <>
        <CategoryManagerDialog open={catsOpen} onOpenChange={setCatsOpen} categories={categories} products={products.data ?? []} organizationId={orgId} />
        <StockMovementDialog product={moving?.product ?? null} kind={moving?.kind ?? "stock_in"} onClose={() => setMoving(null)} organizationId={orgId} />
        </>
      )}
      {canManage && (
        <ProductFormDialogLazy open={formOpen} onOpenChange={setFormOpen} product={editing} categories={categories} organizationId={orgId} />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "product"}?`}
        description="This permanently removes the product. This can't be undone."
        pending={del.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await del.mutateAsync(deleting.id);
            toast.success("Product deleted");
            setDeleting(null);
            setViewing(null);
          } catch (e) { toast.error((e as Error).message); }
        }}
      />
    </div>
  );
}
