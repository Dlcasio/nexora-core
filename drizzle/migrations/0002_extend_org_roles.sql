ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'administrator';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'viewer';