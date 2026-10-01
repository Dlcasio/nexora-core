ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS description text;

CREATE OR REPLACE FUNCTION public.log_activity(_organization_id uuid, _action text, _entity_type text, _entity_id uuid, _description text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  INSERT INTO public.activity_logs (organization_id, actor_id, action, entity_type, entity_id, description, metadata)
  VALUES (_organization_id, auth.uid(), _action, _entity_type, _entity_id, _description, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.log_activity(uuid, text, text, uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_log_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _entity text := TG_ARGV[0];
  _label_col text := TG_ARGV[1];
  _row jsonb := to_jsonb(NEW);
  _label text := COALESCE(_row ->> _label_col, _entity);
  _action text;
  _desc text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := _entity || '.created';
    _desc := initcap(replace(_entity, '_', ' ')) || ' created: ' || _label;
  ELSE
    IF _entity = 'task' AND NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
      _action := 'task.completed';
      _desc := 'Task completed: ' || _label;
    ELSE
      _action := _entity || '.updated';
      _desc := initcap(replace(_entity, '_', ' ')) || ' updated: ' || _label;
    END IF;
  END IF;
  INSERT INTO public.activity_logs (organization_id, actor_id, action, entity_type, entity_id, description, metadata)
  VALUES ((_row ->> 'organization_id')::uuid, auth.uid(), _action, _entity, (_row ->> 'id')::uuid, _desc, '{}'::jsonb);
  RETURN NEW;
END $$;

CREATE TRIGGER products_log_activity AFTER INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity('product', 'name');
CREATE TRIGGER sales_log_activity AFTER INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity('sale', 'reference');
CREATE TRIGGER expenses_log_activity AFTER INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity('expense', 'category');
CREATE TRIGGER tasks_log_activity AFTER INSERT OR UPDATE OF status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity('task', 'title');
CREATE TRIGGER customers_log_activity AFTER INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity('customer', 'name');
CREATE TRIGGER employees_log_activity AFTER INSERT OR UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity('employee', 'full_name');

CREATE OR REPLACE FUNCTION public.trg_log_member_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  SELECT COALESCE(full_name, email) INTO _name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.activity_logs (organization_id, actor_id, action, entity_type, entity_id, description, metadata)
  VALUES (NEW.organization_id, auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'user.created' ELSE 'user.updated' END,
    'user', NEW.user_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'User joined: ' ELSE 'User role updated: ' END || COALESCE(_name, 'member'),
    jsonb_build_object('role', NEW.role));
  RETURN NEW;
END $$;
CREATE TRIGGER organization_members_log_activity AFTER INSERT OR UPDATE OF role ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.trg_log_member_activity();

REVOKE EXECUTE ON FUNCTION public.trg_log_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_log_member_activity() FROM PUBLIC, anon, authenticated;