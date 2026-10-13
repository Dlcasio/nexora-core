import { createFileRoute } from "@tanstack/react-router";
import { EmployeeDetailPage } from "@/components/nexora/employees/employee-detail-page";

export const Route = createFileRoute("/_authenticated/employees/$employeeId")({
  head: () => ({ meta: [{ title: "Employee — NEXORA" }] }),
  component: RouteComponent,
});

function RouteComponent() {
  const { employeeId } = Route.useParams();
  return <EmployeeDetailPage employeeId={employeeId} />;
}