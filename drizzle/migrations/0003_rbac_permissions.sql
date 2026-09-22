-- Map legacy roles onto the new role set
UPDATE public.organization_members SET role = 'administrator' WHERE role = 'admin';
UPDATE public.organization_members SET role = 'employee' WHERE role = 'member';
ALTER TABLE public.organization_members ALTER COLUMN role SET DEFAULT 'employee'::org_role;

-- Global default permission matrix
CREATE TABLE public.role_permissions (
  role public.org_role NOT NULL,
  module TEXT NOT NULL,
  access TEXT NOT NULL CHECK (access IN ('none','view','manage')),
  PRIMARY KEY (role, module)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read permission matrix"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- Per-organization overrides (future enterprise permissions)
CREATE TABLE public.organization_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.org_role NOT NULL,
  module TEXT NOT NULL,
  access TEXT NOT NULL CHECK (access IN ('none','view','manage')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, role, module)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_role_permissions TO authenticated;
GRANT ALL ON public.organization_role_permissions TO service_role;
ALTER TABLE public.organization_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read org permission overrides"
  ON public.organization_role_permissions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Owners and administrators manage overrides"
  ON public.organization_role_permissions FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','administrator']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','administrator']::org_role[]));

CREATE TRIGGER organization_role_permissions_touch_updated_at
  BEFORE UPDATE ON public.organization_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed defaults
INSERT INTO public.role_permissions (role, module, access) VALUES
('owner','dashboard','manage'),('owner','sales','manage'),('owner','inventory','manage'),('owner','crm','manage'),('owner','employees','manage'),('owner','projects','manage'),('owner','finance','manage'),('owner','analytics','manage'),('owner','automation','manage'),('owner','ai_assistant','manage'),('owner','settings','manage'),('owner','team','manage'),('owner','organization','manage'),
('administrator','dashboard','manage'),('administrator','sales','manage'),('administrator','inventory','manage'),('administrator','crm','manage'),('administrator','employees','manage'),('administrator','projects','manage'),('administrator','finance','manage'),('administrator','analytics','manage'),('administrator','automation','manage'),('administrator','ai_assistant','manage'),('administrator','settings','manage'),('administrator','team','manage'),('administrator','organization','manage'),
('manager','dashboard','view'),('manager','sales','manage'),('manager','inventory','manage'),('manager','crm','manage'),('manager','employees','view'),('manager','projects','manage'),('manager','finance','view'),('manager','analytics','view'),('manager','automation','view'),('manager','ai_assistant','manage'),('manager','settings','view'),('manager','team','view'),('manager','organization','view'),
('employee','dashboard','view'),('employee','sales','view'),('employee','inventory','view'),('employee','crm','view'),('employee','employees','none'),('employee','projects','manage'),('employee','finance','none'),('employee','analytics','none'),('employee','automation','none'),('employee','ai_assistant','view'),('employee','settings','view'),('employee','team','none'),('employee','organization','view'),
('viewer','dashboard','view'),('viewer','sales','view'),('viewer','inventory','view'),('viewer','crm','view'),('viewer','employees','none'),('viewer','projects','view'),('viewer','finance','none'),('viewer','analytics','view'),('viewer','automation','none'),('viewer','ai_assistant','none'),('viewer','settings','view'),('viewer','team','none'),('viewer','organization','view');

-- Effective access for a user in an organization
CREATE OR REPLACE FUNCTION public.module_access(_organization_id UUID, _user_id UUID, _module TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT orp.access FROM public.organization_role_permissions orp
       JOIN public.organization_members m
         ON m.organization_id = orp.organization_id AND m.role = orp.role
      WHERE orp.organization_id = _organization_id
        AND m.user_id = _user_id
        AND orp.module = _module
      LIMIT 1),
    (SELECT rp.access FROM public.role_permissions rp
       JOIN public.organization_members m ON m.role = rp.role
      WHERE m.organization_id = _organization_id
        AND m.user_id = _user_id
        AND rp.module = _module
      LIMIT 1),
    'none'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_module_access(_organization_id UUID, _user_id UUID, _module TEXT, _min TEXT DEFAULT 'view')
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _min = 'manage' THEN public.module_access(_organization_id, _user_id, _module) = 'manage'
    ELSE public.module_access(_organization_id, _user_id, _module) IN ('view','manage')
  END;
$$;

-- Refresh member policies for the new role names
DROP POLICY IF EXISTS "Owners and admins manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners and admins remove members" ON public.organization_members;
DROP POLICY IF EXISTS "Founders join their own organization" ON public.organization_members;

CREATE POLICY "Founders join their own organization"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    ((user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.created_by = auth.uid()))
    OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','administrator']::org_role[])
  );

CREATE POLICY "Owners and administrators manage members"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','administrator']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','administrator']::org_role[]));

CREATE POLICY "Owners and administrators remove members"
  ON public.organization_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','administrator']::org_role[]));

DROP POLICY IF EXISTS "Owners and admins can update their organization" ON public.organizations;
CREATE POLICY "Owners and administrators update their organization"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner','administrator']::org_role[]))
  WITH CHECK (public.has_org_role(id, auth.uid(), ARRAY['owner','administrator']::org_role[]));