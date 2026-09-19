import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/nexora/module-page";
import { modules } from "@/components/nexora/module-catalog";
const moduleItem = modules.find((item) => item.path === "/crm");
export const Route = createFileRoute("/_authenticated/crm")({ head: () => ({ meta: [{ title: "CRM — NEXORA" }, { name: "description", content: "NEXORA customer relationship workspace foundation." }, { property: "og:title", content: "CRM — NEXORA" }, { property: "og:description", content: "Customer operations workspace in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return moduleItem ? <ModulePage module={moduleItem} /> : null; }