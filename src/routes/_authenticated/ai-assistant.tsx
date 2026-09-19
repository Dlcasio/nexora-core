import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/nexora/module-page";
import { modules } from "@/components/nexora/module-catalog";
const moduleItem = modules.find((item) => item.path === "/ai-assistant");
export const Route = createFileRoute("/_authenticated/_authenticated/ai-assistant")({ head: () => ({ meta: [{ title: "AI Assistant — NEXORA" }, { name: "description", content: "NEXORA AI assistant workspace foundation." }, { property: "og:title", content: "AI Assistant — NEXORA" }, { property: "og:description", content: "AI-assisted operations workspace in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return moduleItem ? <ModulePage module={moduleItem} /> : null; }