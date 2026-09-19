import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/nexora/module-page";
import { modules } from "@/components/nexora/module-catalog";
const moduleItem = modules.find((item) => item.path === "/analytics");
export const Route = createFileRoute("/_authenticated/analytics")({ head: () => ({ meta: [{ title: "Analytics — NEXORA" }, { name: "description", content: "NEXORA analytics workspace foundation." }, { property: "og:title", content: "Analytics — NEXORA" }, { property: "og:description", content: "Business analytics workspace in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return moduleItem ? <ModulePage module={moduleItem} /> : null; }