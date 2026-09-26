
-- Enums
CREATE TYPE public.sale_status AS ENUM ('draft','pending','completed','cancelled','refunded');
CREATE TYPE public.project_status AS ENUM ('planning','active','on_hold','completed','cancelled');
CREATE TYPE public.task_status AS ENUM ('todo','in_progress','blocked','done','cancelled');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.employment_status AS ENUM ('active','on_leave','terminated');

-- Allow composite (id, organization_id) references so children can never cross orgs
ALTER TABLE public.organizations ADD CONSTRAINT organizations_id_unique_guard UNIQUE (id);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  address text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id)
);
CREATE INDEX customers_org_idx ON public.customers(organization_id, created_at DESC);
CREATE INDEX customers_org_email_idx ON public.customers(organization_id, lower(email));

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  parent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, name),
  FOREIGN KEY (parent_id, organization_id) REFERENCES public.categories(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX categories_parent_idx ON public.categories(parent_id);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id)
);
CREATE INDEX suppliers_org_idx ON public.suppliers(organization_id, name);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid,
  supplier_id uuid,
  sku text,
  name text NOT NULL,
  description text,
  unit_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  cost_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  stock_quantity integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, sku),
  FOREIGN KEY (category_id, organization_id) REFERENCES public.categories(id, organization_id) ON DELETE SET NULL (category_id),
  FOREIGN KEY (supplier_id, organization_id) REFERENCES public.suppliers(id, organization_id) ON DELETE SET NULL (supplier_id)
);
CREATE INDEX products_org_idx ON public.products(organization_id, name);
CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX products_supplier_idx ON public.products(supplier_id);
CREATE INDEX products_low_stock_idx ON public.products(organization_id) WHERE stock_quantity <= reorder_level;

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid,
  reference text,
  status public.sale_status NOT NULL DEFAULT 'pending',
  currency char(3) NOT NULL DEFAULT 'USD',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  sold_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, reference),
  FOREIGN KEY (customer_id, organization_id) REFERENCES public.customers(id, organization_id) ON DELETE SET NULL (customer_id)
);
CREATE INDEX sales_org_sold_idx ON public.sales(organization_id, sold_at DESC);
CREATE INDEX sales_org_status_idx ON public.sales(organization_id, status);
CREATE INDEX sales_customer_idx ON public.sales(customer_id);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL,
  product_id uuid,
  description text,
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total numeric(14,2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (sale_id, organization_id) REFERENCES public.sales(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, organization_id) REFERENCES public.products(id, organization_id) ON DELETE SET NULL (product_id)
);
CREATE INDEX sale_items_sale_idx ON public.sale_items(sale_id);
CREATE INDEX sale_items_product_idx ON public.sale_items(product_id);
CREATE INDEX sale_items_org_idx ON public.sale_items(organization_id);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid,
  category text NOT NULL DEFAULT 'general',
  description text,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  incurred_on date NOT NULL DEFAULT current_date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (supplier_id, organization_id) REFERENCES public.suppliers(id, organization_id) ON DELETE SET NULL (supplier_id)
);
CREATE INDEX expenses_org_date_idx ON public.expenses(organization_id, incurred_on DESC);
CREATE INDEX expenses_org_category_idx ON public.expenses(organization_id, category);
CREATE INDEX expenses_supplier_idx ON public.expenses(supplier_id);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  job_title text,
  department text,
  status public.employment_status NOT NULL DEFAULT 'active',
  hired_on date,
  salary numeric(14,2) CHECK (salary IS NULL OR salary >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX employees_org_idx ON public.employees(organization_id, full_name);
CREATE INDEX employees_user_idx ON public.employees(user_id);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid,
  owner_employee_id uuid,
  name text NOT NULL,
  description text,
  status public.project_status NOT NULL DEFAULT 'planning',
  budget numeric(14,2) CHECK (budget IS NULL OR budget >= 0),
  start_date date,
  due_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (customer_id, organization_id) REFERENCES public.customers(id, organization_id) ON DELETE SET NULL (customer_id),
  FOREIGN KEY (owner_employee_id, organization_id) REFERENCES public.employees(id, organization_id) ON DELETE SET NULL (owner_employee_id)
);
CREATE INDEX projects_org_status_idx ON public.projects(organization_id, status);
CREATE INDEX projects_customer_idx ON public.projects(customer_id);
CREATE INDEX projects_owner_idx ON public.projects(owner_employee_id);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  assignee_employee_id uuid,
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date date,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, organization_id) REFERENCES public.projects(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_employee_id, organization_id) REFERENCES public.employees(id, organization_id) ON DELETE SET NULL (assignee_employee_id)
);
CREATE INDEX tasks_org_status_idx ON public.tasks(organization_id, status, due_date);
CREATE INDEX tasks_project_idx ON public.tasks(project_id);
CREATE INDEX tasks_assignee_idx ON public.tasks(assignee_employee_id);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON public.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX notifications_org_idx ON public.notifications(organization_id);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_org_idx ON public.activity_logs(organization_id, created_at DESC);
CREATE INDEX activity_logs_entity_idx ON public.activity_logs(entity_type, entity_id);
CREATE INDEX activity_logs_actor_idx ON public.activity_logs(actor_id);

-- Grants, RLS, module-based policies, updated_at triggers
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('customers','crm'), ('categories','inventory'), ('suppliers','inventory'),
    ('products','inventory'), ('sales','sales'), ('sale_items','sales'),
    ('expenses','finance'), ('employees','employees'), ('projects','projects'),
    ('tasks','projects')
  ) AS t(tbl, module) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tbl);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('CREATE POLICY "View with module access" ON public.%I FOR SELECT TO authenticated USING (public.has_module_access(organization_id, auth.uid(), %L, ''view''))', r.tbl, r.module);
    EXECUTE format('CREATE POLICY "Create with manage access" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_module_access(organization_id, auth.uid(), %L, ''manage''))', r.tbl, r.module);
    EXECUTE format('CREATE POLICY "Update with manage access" ON public.%I FOR UPDATE TO authenticated USING (public.has_module_access(organization_id, auth.uid(), %L, ''manage'')) WITH CHECK (public.has_module_access(organization_id, auth.uid(), %L, ''manage''))', r.tbl, r.module, r.module);
    EXECUTE format('CREATE POLICY "Delete with manage access" ON public.%I FOR DELETE TO authenticated USING (public.has_module_access(organization_id, auth.uid(), %L, ''manage''))', r.tbl, r.module);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', r.tbl || '_touch_updated_at', r.tbl);
  END LOOP;
END $$;

-- Notifications: private to the recipient; admins can send within their org
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins send notifications to members" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), ARRAY['owner','administrator','manager']::public.org_role[])
    AND public.is_org_member(organization_id, user_id)
  );

-- Activity logs: append-only audit trail readable by org members
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read org activity" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members log own activity" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));
