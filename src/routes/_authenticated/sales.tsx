import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/nexora/module-page";
import { modules } from "@/components/nexora/module-catalog";

const moduleItem = modules.find((item) => item.path === "/sales");
export const Route = createFileRoute("/_authenticated/_authenticated/sales")({ head: () => ({ meta: [{ title: "Sales — NEXORA" }, { name: "description", content: "NEXORA sales workspace foundation." }, { property: "og:title", content: "Sales — NEXORA" }, { property: "og:description", content: "Sales operations workspace in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return moduleItem ? <ModulePage module={moduleItem} /> : null; }