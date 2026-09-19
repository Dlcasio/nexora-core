import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/nexora/module-page";
import { modules } from "@/components/nexora/module-catalog";
const moduleItem = modules.find((item) => item.path === "/employees");
export const Route = createFileRoute("/_authenticated/_authenticated/employees")({ head: () => ({ meta: [{ title: "Employees — NEXORA" }, { name: "description", content: "NEXORA employees workspace foundation." }, { property: "og:title", content: "Employees — NEXORA" }, { property: "og:description", content: "People operations workspace in NEXORA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return moduleItem ? <ModulePage module={moduleItem} /> : null; }