import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveDashboard } from "@/components/nexora/executive-dashboard";
import { RequirePermission } from "@/components/nexora/permission-gate";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NEXORA" },
      { name: "description", content: "NEXORA business operations intelligence dashboard." },
      { property: "og:title", content: "Dashboard — NEXORA" },
      { property: "og:description", content: "A unified foundation for business operations intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <RequirePermission module="dashboard">
      <ExecutiveDashboard />
    </RequirePermission>
  );
}
