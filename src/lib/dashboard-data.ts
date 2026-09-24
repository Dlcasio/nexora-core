import { useQuery } from "@tanstack/react-query";

export type DashboardMetric = {
  id: "revenue" | "expenses" | "net-income" | "orders" | "customers" | "inventory" | "tasks";
  label: string;
  value: string;
  change: string;
  direction: "up" | "down" | "neutral";
  context: string;
};

export type DashboardSnapshot = {
  source: "demo" | "live";
  periodLabel: string;
  updatedLabel: string;
  metrics: DashboardMetric[];
  financialTrend: Array<{ month: string; revenue: number; previous: number; expenses: number }>;
  expenseMix: Array<{ category: string; value: number }>;
  activity: Array<{ id: string; title: string; detail: string; time: string; type: "order" | "customer" | "inventory" | "payment" }>;
  inventoryAlerts: Array<{ id: string; name: string; sku: string; stock: number; reorderAt: number; severity: "critical" | "low" }>;
  transactions: Array<{ id: string; counterparty: string; type: string; date: string; amount: number; status: "Completed" | "Pending" }>;
  tasks: Array<{ id: string; title: string; owner: string; due: string; priority: "High" | "Medium" | "Low" }>;
};

const executiveDemoSnapshot: DashboardSnapshot = {
  source: "demo",
  periodLabel: "Mar 1–31, 2026",
  updatedLabel: "Updated just now",
  metrics: [
    { id: "revenue", label: "Revenue", value: "$284,500", change: "+12.4%", direction: "up", context: "vs. previous period" },
    { id: "expenses", label: "Expenses", value: "$171,200", change: "+4.1%", direction: "down", context: "vs. previous period" },
    { id: "net-income", label: "Net income", value: "$113,300", change: "+28.1%", direction: "up", context: "39.8% margin" },
    { id: "orders", label: "Orders", value: "1,284", change: "+8.7%", direction: "up", context: "94 awaiting fulfillment" },
    { id: "customers", label: "Customers", value: "3,842", change: "+6.2%", direction: "up", context: "126 added this month" },
    { id: "inventory", label: "Inventory alerts", value: "8", change: "3 critical", direction: "neutral", context: "items below reorder point" },
    { id: "tasks", label: "Pending tasks", value: "14", change: "5 due soon", direction: "neutral", context: "across your workspace" },
  ],
  financialTrend: [
    { month: "Oct", revenue: 198000, previous: 183000, expenses: 132000 },
    { month: "Nov", revenue: 221000, previous: 201000, expenses: 143000 },
    { month: "Dec", revenue: 246000, previous: 229000, expenses: 151000 },
    { month: "Jan", revenue: 238000, previous: 218000, expenses: 147000 },
    { month: "Feb", revenue: 253000, previous: 232000, expenses: 164000 },
    { month: "Mar", revenue: 284500, previous: 253000, expenses: 171200 },
  ],
  expenseMix: [
    { category: "Payroll", value: 68400 },
    { category: "Operations", value: 42700 },
    { category: "Inventory", value: 32500 },
    { category: "Marketing", value: 17600 },
    { category: "Other", value: 10000 },
  ],
  activity: [
    { id: "a1", title: "Enterprise order confirmed", detail: "Order #NX-4821 · Northstar Retail", time: "8 min ago", type: "order" },
    { id: "a2", title: "New customer account", detail: "Meridian & Co. joined the workspace", time: "32 min ago", type: "customer" },
    { id: "a3", title: "Inventory threshold reached", detail: "Wireless Scanner Pro is critically low", time: "1 hr ago", type: "inventory" },
    { id: "a4", title: "Payment received", detail: "Invoice #INV-3098 · $18,750", time: "2 hrs ago", type: "payment" },
  ],
  inventoryAlerts: [
    { id: "i1", name: "Wireless Scanner Pro", sku: "WSP-240", stock: 3, reorderAt: 12, severity: "critical" },
    { id: "i2", name: "Thermal Label Roll", sku: "TLR-500", stock: 18, reorderAt: 40, severity: "critical" },
    { id: "i3", name: "Docking Station X2", sku: "DSX-200", stock: 11, reorderAt: 20, severity: "low" },
    { id: "i4", name: "Inventory Tags", sku: "ITG-100", stock: 62, reorderAt: 80, severity: "low" },
  ],
  transactions: [
    { id: "TX-9048", counterparty: "Northstar Retail", type: "Order payment", date: "Mar 24", amount: 18750, status: "Completed" },
    { id: "TX-9047", counterparty: "Apex Logistics", type: "Supplier payment", date: "Mar 24", amount: -8420, status: "Completed" },
    { id: "TX-9046", counterparty: "Meridian & Co.", type: "Invoice payment", date: "Mar 23", amount: 12300, status: "Pending" },
    { id: "TX-9045", counterparty: "Cloudwork Systems", type: "Software expense", date: "Mar 22", amount: -2150, status: "Completed" },
  ],
  tasks: [
    { id: "t1", title: "Approve Q2 operating budget", owner: "Finance", due: "Today", priority: "High" },
    { id: "t2", title: "Review low-stock purchase orders", owner: "Operations", due: "Today", priority: "High" },
    { id: "t3", title: "Finalize March revenue report", owner: "Finance", due: "Tomorrow", priority: "Medium" },
    { id: "t4", title: "Confirm enterprise renewals", owner: "Sales", due: "Mar 27", priority: "Low" },
  ],
};

async function fetchExecutiveDashboard(): Promise<DashboardSnapshot> {
  // This boundary will switch to organization-scoped Lovable Cloud queries when business modules are connected.
  return executiveDemoSnapshot;
}

export function useExecutiveDashboard() {
  return useQuery({
    queryKey: ["executive-dashboard", "demo"],
    queryFn: fetchExecutiveDashboard,
    staleTime: 5 * 60_000,
  });
}