/**
 * NEXORA permission system.
 *
 * Roles live in the database (`org_role`), the default matrix in `role_permissions`,
 * and per-organization overrides in `organization_role_permissions`.
 * This module is the single client-side source of truth for role/module metadata.
 */

export const ORG_ROLES = ["owner", "administrator", "manager", "employee", "viewer"] as const;
export type Role = (typeof ORG_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  administrator: "Administrator",
  manager: "Manager",
  employee: "Employee",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control of the organization, including billing and ownership.",
  administrator: "Manages every module, members and workspace settings.",
  manager: "Runs day-to-day operations across their modules.",
  employee: "Works inside assigned modules with limited visibility.",
  viewer: "Read-only access to shared operational information.",
};

export const MODULE_KEYS = [
  "dashboard",
  "sales",
  "inventory",
  "crm",
  "employees",
  "projects",
  "finance",
  "analytics",
  "automation",
  "ai_assistant",
  "settings",
  "team",
  "organization",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export type AccessLevel = "none" | "view" | "manage";

const RANK: Record<AccessLevel, number> = { none: 0, view: 1, manage: 2 };

export type PermissionMatrix = Partial<Record<Role, Partial<Record<ModuleKey, AccessLevel>>>>;

export function accessFor(matrix: PermissionMatrix, role: Role | undefined, module: ModuleKey): AccessLevel {
  if (!role) return "none";
  return matrix[role]?.[module] ?? "none";
}

export function meets(level: AccessLevel, required: AccessLevel) {
  return RANK[level] >= RANK[required];
}

/** Fallback used before the matrix loads, so the UI never flashes full access. */
export const EMPTY_MATRIX: PermissionMatrix = {};
