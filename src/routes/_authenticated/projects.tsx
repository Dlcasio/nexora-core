import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/nexora/module-page";
import { modules } from "@/components/nexora/module-catalog";
const moduleItem = modules.find((item) => item.path === "/projects");
export const Route = createFileRoute("/projects")({ head: () => ({ meta: [{ title: "Projects — NEXORA" }, { name: "description", content: "NEXORA projects workspace foundation." }, { property: "og:title", content: "Projects — NEXORA" }, { property: "og:description", content: "Project delivery workspace in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return moduleItem ? <ModulePage module={moduleItem} /> : null; }