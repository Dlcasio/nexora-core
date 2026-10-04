import { Badge } from "@/components/ui/badge";
import { SALE_STATUS_LABEL, type SaleStatus } from "@/lib/sales";

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  const variant = status === "completed" ? "default" : status === "cancelled" || status === "refunded" ? "destructive" : status === "pending" ? "secondary" : "outline";
  return <Badge variant={variant} className="font-mono text-[10px]">{SALE_STATUS_LABEL[status]}</Badge>;
}
