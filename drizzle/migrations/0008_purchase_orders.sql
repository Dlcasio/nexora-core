CREATE TYPE public.purchase_status AS ENUM ('draft','ordered','received','cancelled');

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid,
  reference text NOT NULL,
  status public.purchase_status NOT NULL DEFAULT 'draft',
  ordered_on date NOT NULL DEFAULT current_date,
  expected_on date,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  received_at timestamptz,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, reference),
  FOREIGN KEY (supplier_id, organization_id) REFERENCES public.suppliers(id, organization_id)
);
CREATE INDEX purchase_orders_org_created_idx ON public.purchase_orders(organization_id, created_at DESC);
CREATE INDEX purchase_orders_supplier_idx ON public.purchase_orders(supplier_id);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric(14,2) NOT NULL CHECK (unit_cost >= 0),
  line_total numeric(14,2) GENERATED ALWAYS AS (round(quantity * unit_cost, 2)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (purchase_order_id, organization_id) REFERENCES public.purchase_orders(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, organization_id) REFERENCES public.products(id, organization_id)
);
CREATE INDEX purchase_order_items_po_idx ON public.purchase_order_items(purchase_order_id);
CREATE INDEX purchase_order_items_product_idx ON public.purchase_order_items(product_id);

GRANT SELECT ON public.purchase_orders, public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_orders, public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inventory viewers read purchase orders" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.has_module_access(organization_id, auth.uid(), 'inventory', 'view'));
CREATE POLICY "Inventory viewers read purchase order items" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (public.has_module_access(organization_id, auth.uid(), 'inventory', 'view'));

CREATE TRIGGER purchase_orders_touch BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.stock_movements ADD COLUMN purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL;
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type IN ('initial','stock_in','stock_out','adjustment','sale','sale_reversal','purchase'));

CREATE OR REPLACE FUNCTION public.create_purchase_order(_organization_id uuid, _supplier_id uuid, _status public.purchase_status, _ordered_on date, _expected_on date, _notes text, _items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _ref text; _n int; _total numeric := 0; _i jsonb;
BEGIN
  IF NOT public.has_module_access(_organization_id, auth.uid(), 'inventory', 'manage') THEN
    RAISE EXCEPTION 'You don''t have permission to create purchase orders' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('draft','ordered') THEN RAISE EXCEPTION 'New purchase orders must be draft or ordered'; END IF;
  IF _supplier_id IS NULL THEN RAISE EXCEPTION 'Select a supplier'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Add at least one product'; END IF;
  FOR _i IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF (_i->>'quantity')::int <= 0 OR (_i->>'unit_cost')::numeric < 0 THEN
      RAISE EXCEPTION 'Quantities must be positive and costs cannot be negative';
    END IF;
    _total := _total + round((_i->>'quantity')::int * (_i->>'unit_cost')::numeric, 2);
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('po:' || _organization_id::text));
  SELECT count(*) + 1 INTO _n FROM public.purchase_orders WHERE organization_id = _organization_id;
  _ref := 'PO-' || lpad(_n::text, 5, '0');
  INSERT INTO public.purchase_orders (organization_id, supplier_id, reference, status, ordered_on, expected_on, total_amount, notes, created_by)
  VALUES (_organization_id, _supplier_id, _ref, _status, coalesce(_ordered_on, current_date), _expected_on, _total, nullif(trim(_notes),''), auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.purchase_order_items (organization_id, purchase_order_id, product_id, quantity, unit_cost)
  SELECT _organization_id, _id, (i->>'product_id')::uuid, (i->>'quantity')::int, (i->>'unit_cost')::numeric FROM jsonb_array_elements(_items) i;
  PERFORM public.log_activity(_organization_id, 'purchase_order.created', 'purchase_order', _id, 'Created purchase order ' || _ref, '{}'::jsonb);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.set_purchase_order_status(_purchase_order_id uuid, _status public.purchase_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _po record;
BEGIN
  SELECT * INTO _po FROM public.purchase_orders WHERE id = _purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF NOT public.has_module_access(_po.organization_id, auth.uid(), 'inventory', 'manage') THEN
    RAISE EXCEPTION 'You don''t have permission to change purchase orders' USING ERRCODE = '42501';
  END IF;
  IF _status = 'received' THEN RAISE EXCEPTION 'Use the receive action to receive stock'; END IF;
  IF _po.status IN ('received','cancelled') THEN RAISE EXCEPTION 'This purchase order is already %', _po.status; END IF;
  UPDATE public.purchase_orders SET status = _status WHERE id = _purchase_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(_purchase_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _po record; _it record; _new int;
BEGIN
  SELECT * INTO _po FROM public.purchase_orders WHERE id = _purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF NOT public.has_module_access(_po.organization_id, auth.uid(), 'inventory', 'manage') THEN
    RAISE EXCEPTION 'You don''t have permission to receive stock' USING ERRCODE = '42501';
  END IF;
  IF _po.status <> 'ordered' THEN RAISE EXCEPTION 'Only ordered purchase orders can be received'; END IF;
  FOR _it IN SELECT product_id, sum(quantity)::int AS qty FROM public.purchase_order_items
             WHERE purchase_order_id = _purchase_order_id GROUP BY product_id ORDER BY product_id LOOP
    PERFORM set_config('nexora.stock_tx', 'on', true);
    UPDATE public.products SET stock_quantity = stock_quantity + _it.qty
      WHERE id = _it.product_id AND organization_id = _po.organization_id
      RETURNING stock_quantity INTO _new;
    PERFORM set_config('nexora.stock_tx', 'off', true);
    INSERT INTO public.stock_movements (organization_id, product_id, movement_type, quantity_change, quantity_after, note, purchase_order_id, created_by)
    VALUES (_po.organization_id, _it.product_id, 'purchase', _it.qty, _new, 'Received ' || _po.reference, _purchase_order_id, auth.uid());
  END LOOP;
  UPDATE public.purchase_orders SET status = 'received', received_at = now(), received_by = auth.uid() WHERE id = _purchase_order_id;
  PERFORM public.log_activity(_po.organization_id, 'purchase_order.received', 'purchase_order', _purchase_order_id, 'Received purchase order ' || _po.reference, '{}'::jsonb);
END $$;

REVOKE EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, public.purchase_status, date, date, text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_purchase_order_status(uuid, public.purchase_status) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, public.purchase_status, date, date, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_purchase_order_status(uuid, public.purchase_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid) TO authenticated;