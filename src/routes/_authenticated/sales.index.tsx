import { createFileRoute } from "@tanstack/react-router";
import { SalesPage } from "@/components/nexora/sales/sales-page";

export const Route = createFileRoute("/_authenticated/sales/")({
  head: () => ({ meta: [{ title: "Sales orders — NEXORA" }, { name: "description", content: "Create and track sales orders in NEXORA." }, { property: "og:title", content: "Sales orders — NEXORA" }, { property: "og:description", content: "Sales orders, customers and totals for your organization." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SalesPage,
});
