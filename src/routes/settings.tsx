import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/nexora/module-page";
import { modules } from "@/components/nexora/module-catalog";
const moduleItem = modules.find((item) => item.path === "/settings");
export const Route = createFileRoute("/settings")({ head: () => ({ meta: [{ title: "Settings — NEXORA" }, { name: "description", content: "NEXORA workspace settings foundation." }, { property: "og:title", content: "Settings — NEXORA" }, { property: "og:description", content: "Workspace preferences for NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return moduleItem ? <ModulePage module={moduleItem} /> : null; }