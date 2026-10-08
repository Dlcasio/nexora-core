import { createFileRoute } from "@tanstack/react-router";
import { CustomerProfilePage } from "@/components/nexora/crm/customer-profile-page";

export const Route = createFileRoute("/_authenticated/crm/$customerId")({
  head: () => ({ meta: [{ title: "Customer profile — NEXORA CRM" }, { name: "description", content: "Customer contact details, orders and activity." }, { property: "og:title", content: "Customer profile — NEXORA CRM" }, { property: "og:description", content: "Customer profile in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Page,
});

function Page() {
  const { customerId } = Route.useParams();
  return <CustomerProfilePage customerId={customerId} />;
}
