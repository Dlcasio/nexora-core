import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/components/nexora/projects/projects-page";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({ meta: [{ title: "Projects — NEXORA" }] }),
  component: ProjectsPage,
});