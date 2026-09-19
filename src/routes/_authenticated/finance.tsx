import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/nexora/module-page";
import { modules } from "@/components/nexora/module-catalog";
const moduleItem = modules.find((item) => item.path === "/finance");
export const Route = createFileRoute("/finance")({ head: () => ({ meta: [{ title: "Finance — NEXORA" }, { name: "description", content: "NEXORA finance workspace foundation." }, { property: "og:title", content: "Finance — NEXORA" }, { property: "og:description", content: "Financial operations workspace in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return moduleItem ? <ModulePage module={moduleItem} /> : null; }