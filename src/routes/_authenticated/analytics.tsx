import { createFileRoute } from "@tanstack/react-router";
import { SalesAnalyticsPage } from "@/components/nexora/analytics/sales-analytics-page";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Sales Analytics — NEXORA" }, { name: "description", content: "Revenue, orders, average order value, top products and customers in NEXORA." }, { property: "og:title", content: "Sales Analytics — NEXORA" }, { property: "og:description", content: "Daily, weekly and monthly sales performance for your organization." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SalesAnalyticsPage,
});
