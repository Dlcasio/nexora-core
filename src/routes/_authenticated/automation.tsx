import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/nexora/module-page";
import { modules } from "@/components/nexora/module-catalog";
const moduleItem = modules.find((item) => item.path === "/automation");
export const Route = createFileRoute("/_authenticated/_authenticated/automation")({ head: () => ({ meta: [{ title: "Automation — NEXORA" }, { name: "description", content: "NEXORA automation workspace foundation." }, { property: "og:title", content: "Automation — NEXORA" }, { property: "og:description", content: "Business automation workspace in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return moduleItem ? <ModulePage module={moduleItem} /> : null; }