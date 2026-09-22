import type { ModuleKey } from "@/lib/permissions";
import {
  BarChart3,
  Bot,
  Boxes,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  CircleDollarSign,
  FolderKanban,
  Gauge,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type ModulePath =
  | "/dashboard"
  | "/sales"
  | "/inventory"
  | "/crm"
  | "/employees"
  | "/projects"
  | "/finance"
  | "/analytics"
  | "/automation"
  | "/ai-assistant"
  | "/organization"
  | "/team"
  | "/settings";

export type ModuleDefinition = {
  title: string;
  description: string;
  path: ModulePath;
  icon: LucideIcon;
  group: "Overview" | "Operations" | "Intelligence" | "System";
  code: string;
  permission: ModuleKey;
  featured?: boolean;
};

export const modules: ModuleDefinition[] = [
  { title: "Dashboard", description: "Your operations overview", path: "/dashboard", permission: "dashboard", icon: Gauge, group: "Overview", code: "00" },
  { title: "Sales", description: "Pipeline and deals", path: "/sales", permission: "sales", icon: ChartNoAxesCombined, group: "Operations", code: "01" },
  { title: "Inventory", description: "Stock and SKUs", path: "/inventory", permission: "inventory", icon: Boxes, group: "Operations", code: "02" },
  { title: "CRM", description: "Accounts and contacts", path: "/crm", permission: "crm", icon: BriefcaseBusiness, group: "Operations", code: "03" },
  { title: "Employees", description: "People and teams", path: "/employees", permission: "employees", icon: Users, group: "Operations", code: "04" },
  { title: "Projects", description: "Work and delivery", path: "/projects", permission: "projects", icon: FolderKanban, group: "Operations", code: "05" },
  { title: "Finance", description: "Ledger and cash", path: "/finance", permission: "finance", icon: CircleDollarSign, group: "Operations", code: "06" },
  { title: "Analytics", description: "Signals and trends", path: "/analytics", permission: "analytics", icon: BarChart3, group: "Intelligence", code: "07" },
  { title: "Automation", description: "Rules and workflows", path: "/automation", permission: "automation", icon: Workflow, group: "Intelligence", code: "08" },
  { title: "AI Assistant", description: "Ask across NEXORA", path: "/ai-assistant", permission: "ai_assistant", icon: Bot, group: "Intelligence", code: "09", featured: true },
  { title: "Organization", description: "Your organization profile", path: "/organization", permission: "organization", icon: Building2, group: "System", code: "10" },
  { title: "Team", description: "Members and roles", path: "/team", permission: "team", icon: ShieldCheck, group: "System", code: "11" },
  { title: "Settings", description: "Workspace preferences", path: "/settings", permission: "settings", icon: Settings, group: "System", code: "12" },
];

export const dashboardModules = modules.filter((item) => item.group !== "Overview" && item.group !== "System");
export const sparkleIcon = Sparkles;