import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCustomer, type Customer } from "@/lib/sales";

export function CustomerDialog({ open, onOpenChange, orgId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; orgId: string | undefined; onCreated: (c: Customer) => void }) {
  const create = useCreateCustomer(orgId);
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    create.mutate({ ...f, name: f.name.trim() }, {
      onSuccess: (c) => { toast.success(`Customer ${c.name} added`); onCreated(c); setF({ name: "", email: "", phone: "", company: "" }); onOpenChange(false); },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>The customer is saved to your organization and selected for this sale.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={f.name} onChange={set("name")} required maxLength={200} autoFocus /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" value={f.email} onChange={set("email")} maxLength={255} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-phone">Phone</Label><Input id="c-phone" value={f.phone} onChange={set("phone")} maxLength={50} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="c-company">Company</Label><Input id="c-company" value={f.company} onChange={set("company")} maxLength={200} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || !f.name.trim()}>{create.isPending ? "Saving…" : "Add customer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
