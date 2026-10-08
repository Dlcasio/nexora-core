import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage } from "@/components/nexora/crm/customers-page";

export const Route = createFileRoute("/_authenticated/crm/")({
  head: () => ({ meta: [{ title: "Customers — NEXORA CRM" }, { name: "description", content: "Manage customers, contacts and purchase history." }, { property: "og:title", content: "Customers — NEXORA CRM" }, { property: "og:description", content: "Customer list with purchases and order counts." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: CustomersPage,
});
