CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('initial','stock_in','stock_out','adjustment','sale','sale_reversal')),
  quantity_change integer NOT NULL,
  quantity_after integer NOT NULL CHECK (quantity_after >= 0),
  note text,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, organization_id) REFERENCES public.products(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX stock_movements_org_created_idx ON public.stock_movements(organization_id, created_at DESC);
CREATE INDEX stock_movements_product_idx ON public.stock_movements(product_id, created_at DESC);

GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members with inventory access view movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (public.has_module_access(organization_id, auth.uid(), 'inventory', 'view'));

-- Log any direct stock change on products (creation, manual edits) unless a movement function is writing it.
CREATE OR REPLACE FUNCTION public.trg_products_stock_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('nexora.stock_tx', true), '') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.stock_quantity <> 0 THEN
      INSERT INTO public.stock_movements (organization_id, product_id, movement_type, quantity_change, quantity_after, note, created_by)
      VALUES (NEW.organization_id, NEW.id, 'initial', NEW.stock_quantity, NEW.stock_quantity, 'Opening stock', auth.uid());
    END IF;
  ELSIF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
    INSERT INTO public.stock_movements (organization_id, product_id, movement_type, quantity_change, quantity_after, note, created_by)
    VALUES (NEW.organization_id, NEW.id, 'adjustment', NEW.stock_quantity - OLD.stock_quantity, NEW.stock_quantity, 'Edited on product', auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER products_stock_log AFTER INSERT OR UPDATE OF stock_quantity ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_products_stock_log();

-- Atomic, permission-checked stock movement.
CREATE OR REPLACE FUNCTION public.record_stock_movement(_product_id uuid, _type text, _quantity integer, _note text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p record; _change integer; _new integer;
BEGIN
  IF _type NOT IN ('stock_in','stock_out','adjustment') THEN RAISE EXCEPTION 'Invalid movement type'; END IF;
  SELECT id, organization_id, stock_quantity INTO _p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF NOT public.has_module_access(_p.organization_id, auth.uid(), 'inventory', 'manage') THEN
    RAISE EXCEPTION 'You do not have permission to change stock' USING ERRCODE = '42501';
  END IF;
  IF _type = 'adjustment' THEN
    IF _quantity < 0 THEN RAISE EXCEPTION 'Counted quantity cannot be negative'; END IF;
    _new := _quantity; _change := _quantity - _p.stock_quantity;
  ELSE
    IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero'; END IF;
    _change := CASE WHEN _type = 'stock_in' THEN _quantity ELSE -_quantity END;
    _new := _p.stock_quantity + _change;
    IF _new < 0 THEN RAISE EXCEPTION 'Not enough stock: only % available', _p.stock_quantity; END IF;
  END IF;
  PERFORM set_config('nexora.stock_tx', 'on', true);
  UPDATE public.products SET stock_quantity = _new WHERE id = _product_id;
  PERFORM set_config('nexora.stock_tx', 'off', true);
  INSERT INTO public.stock_movements (organization_id, product_id, movement_type, quantity_change, quantity_after, note, created_by)
  VALUES (_p.organization_id, _product_id, _type, _change, _new, NULLIF(trim(_note), ''), auth.uid());
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid, text, integer, text) TO authenticated;

-- Apply (or reverse) sale items against stock.
CREATE OR REPLACE FUNCTION public.apply_sale_stock(_sale_id uuid, _direction integer, _item_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _i record; _stock integer; _qty integer;
BEGIN
  PERFORM set_config('nexora.stock_tx', 'on', true);
  FOR _i IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id AND product_id IS NOT NULL AND (_item_id IS NULL OR id = _item_id) LOOP
    _qty := ceil(_i.quantity)::integer;
    SELECT stock_quantity INTO _stock FROM public.products WHERE id = _i.product_id FOR UPDATE;
    IF _direction < 0 AND _stock < _qty THEN
      RAISE EXCEPTION 'Not enough stock for this sale: only % available', _stock;
    END IF;
    UPDATE public.products SET stock_quantity = stock_quantity + _direction * _qty WHERE id = _i.product_id;
    INSERT INTO public.stock_movements (organization_id, product_id, movement_type, quantity_change, quantity_after, sale_id, created_by)
    VALUES (_i.organization_id, _i.product_id, CASE WHEN _direction < 0 THEN 'sale' ELSE 'sale_reversal' END,
            _direction * _qty, _stock + _direction * _qty, _sale_id, auth.uid());
  END LOOP;
  PERFORM set_config('nexora.stock_tx', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.apply_sale_stock(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_sales_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status <> 'completed') THEN
    PERFORM public.apply_sale_stock(NEW.id, -1);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status IN ('cancelled','refunded') THEN
    PERFORM public.apply_sale_stock(NEW.id, 1);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sales_stock AFTER INSERT OR UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_stock();

CREATE OR REPLACE FUNCTION public.trg_sale_items_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sales WHERE id = NEW.sale_id AND status = 'completed') THEN
    PERFORM public.apply_sale_stock(NEW.sale_id, -1, NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sale_items_stock AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_sale_items_stock();