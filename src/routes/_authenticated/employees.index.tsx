import { createFileRoute } from "@tanstack/react-router";
import { EmployeesPage } from "@/components/nexora/employees/employees-page";

export const Route = createFileRoute("/_authenticated/employees/")({
  head: () => ({ meta: [{ title: "Employees — NEXORA" }] }),
  component: EmployeesPage,
});