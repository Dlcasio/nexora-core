import { createFileRoute } from "@tanstack/react-router";
import { LeadsPage } from "@/components/nexora/crm/leads-page";

export const Route = createFileRoute("/_authenticated/crm/")({
  head: () => ({ meta: [{ title: "Leads — NEXORA CRM" }] }),
  component: LeadsPage,
});