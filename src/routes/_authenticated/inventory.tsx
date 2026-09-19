import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/nexora/module-page";
import { modules } from "@/components/nexora/module-catalog";
const moduleItem = modules.find((item) => item.path === "/inventory");
export const Route = createFileRoute("/_authenticated/inventory")({ head: () => ({ meta: [{ title: "Inventory — NEXORA" }, { name: "description", content: "NEXORA inventory workspace foundation." }, { property: "og:title", content: "Inventory — NEXORA" }, { property: "og:description", content: "Inventory operations workspace in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return moduleItem ? <ModulePage module={moduleItem} /> : null; }