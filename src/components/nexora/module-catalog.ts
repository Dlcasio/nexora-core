import {
  BarChart3,
  Bot,
  Boxes,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleDollarSign,
  FolderKanban,
  Gauge,
  Settings,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type ModulePath =
  | "/"
  | "/sales"
  | "/inventory"
  | "/crm"
  | "/employees"
  | "/projects"
  | "/finance"
  | "/analytics"
  | "/automation"
  | "/ai-assistant"
  | "/settings";

export type ModuleDefinition = {
  title: string;
  description: string;
  path: ModulePath;
  icon: LucideIcon;
  group: "Overview" | "Operations" | "Intelligence" | "System";
  code: string;
  featured?: boolean;
};

export const modules: ModuleDefinition[] = [
  { title: "Dashboard", description: "Your operations overview", path: "/", icon: Gauge, group: "Overview", code: "00" },
  { title: "Sales", description: "Pipeline and deals", path: "/sales", icon: ChartNoAxesCombined, group: "Operations", code: "01" },
  { title: "Inventory", description: "Stock and SKUs", path: "/inventory", icon: Boxes, group: "Operations", code: "02" },
  { title: "CRM", description: "Accounts and contacts", path: "/crm", icon: BriefcaseBusiness, group: "Operations", code: "03" },
  { title: "Employees", description: "People and teams", path: "/employees", icon: Users, group: "Operations", code: "04" },
  { title: "Projects", description: "Work and delivery", path: "/projects", icon: FolderKanban, group: "Operations", code: "05" },
  { title: "Finance", description: "Ledger and cash", path: "/finance", icon: CircleDollarSign, group: "Operations", code: "06" },
  { title: "Analytics", description: "Signals and trends", path: "/analytics", icon: BarChart3, group: "Intelligence", code: "07" },
  { title: "Automation", description: "Rules and workflows", path: "/automation", icon: Workflow, group: "Intelligence", code: "08" },
  { title: "AI Assistant", description: "Ask across NEXORA", path: "/ai-assistant", icon: Bot, group: "Intelligence", code: "09", featured: true },
  { title: "Settings", description: "Workspace preferences", path: "/settings", icon: Settings, group: "System", code: "10" },
];

export const dashboardModules = modules.filter((item) => item.group !== "Overview" && item.group !== "System");
export const sparkleIcon = Sparkles;