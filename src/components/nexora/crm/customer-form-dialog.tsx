import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSaveCustomer, type CustomerInput, type CustomerRecord } from "@/lib/customers";

const EMPTY: CustomerInput = { name: "", email: "", phone: "", company: "", address: "", notes: "" };

export function CustomerFormDialog({ open, onOpenChange, orgId, customer }: { open: boolean; onOpenChange: (o: boolean) => void; orgId: string | undefined; customer?: CustomerRecord | null }) {
  const save = useSaveCustomer(orgId);
  const [f, setF] = useState<CustomerInput>(EMPTY);
  useEffect(() => {
    if (open) setF(customer ? { name: customer.name, email: customer.email ?? "", phone: customer.phone ?? "", company: customer.company ?? "", address: customer.address ?? "", notes: customer.notes ?? "" } : EMPTY);
  }, [open, customer]);
  const set = (k: keyof CustomerInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    save.mutate({ id: customer?.id, values: f }, {
      onSuccess: () => { toast.success(customer ? "Customer updated" : `Customer ${f.name.trim()} added`); onOpenChange(false); },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{customer ? "Edit customer" : "Add customer"}</DialogTitle>
            <DialogDescription>Contact details are visible to members who can view CRM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="cf-name">Name</Label><Input id="cf-name" value={f.name} onChange={set("name")} required maxLength={200} autoFocus /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="cf-email">Email</Label><Input id="cf-email" type="email" value={f.email} onChange={set("email")} maxLength={255} /></div>
            <div className="space-y-1.5"><Label htmlFor="cf-phone">Phone</Label><Input id="cf-phone" value={f.phone} onChange={set("phone")} maxLength={50} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="cf-company">Company</Label><Input id="cf-company" value={f.company} onChange={set("company")} maxLength={200} /></div>
          <div className="space-y-1.5"><Label htmlFor="cf-address">Address</Label><Input id="cf-address" value={f.address} onChange={set("address")} maxLength={500} /></div>
          <div className="space-y-1.5"><Label htmlFor="cf-notes">Notes</Label><Textarea id="cf-notes" value={f.notes} onChange={set("notes")} maxLength={2000} rows={3} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || !f.name.trim()}>{save.isPending ? "Saving…" : customer ? "Save changes" : "Add customer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
