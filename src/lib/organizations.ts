export const BUSINESS_TYPES = [
  "Retail & E-commerce",
  "Manufacturing",
  "Professional Services",
  "Technology & Software",
  "Healthcare",
  "Finance & Insurance",
  "Logistics & Transport",
  "Construction & Real Estate",
  "Education",
  "Hospitality",
  "Non-profit",
  "Other",
] as const;

export const COMPANY_SIZES = [
  "1–10 employees",
  "11–50 employees",
  "51–200 employees",
  "201–1000 employees",
  "1000+ employees",
] as const;

export type OrgRole = "owner" | "admin" | "member";

export type Organization = {
  id: string;
  name: string;
  business_type: string;
  company_size: string;
  created_by: string;
  created_at: string;
};

export type OrganizationMember = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
};
