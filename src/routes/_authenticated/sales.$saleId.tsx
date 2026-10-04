import { createFileRoute } from "@tanstack/react-router";
import { SaleDetailsPage } from "@/components/nexora/sales/sale-details-page";

export const Route = createFileRoute("/_authenticated/sales/$saleId")({
  head: () => ({ meta: [{ title: "Sale details — NEXORA" }, { name: "description", content: "Sales order details, items and totals." }, { property: "og:title", content: "Sale details — NEXORA" }, { property: "og:description", content: "Sales order details in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Page,
});

function Page() {
  const { saleId } = Route.useParams();
  return <SaleDetailsPage saleId={saleId} />;
}
