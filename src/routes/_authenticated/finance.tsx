import { createFileRoute } from "@tanstack/react-router";
import { FinancePage } from "@/components/nexora/finance/finance-page";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — NEXORA" }] }),
  component: FinancePage,
});