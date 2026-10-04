CREATE OR REPLACE FUNCTION public.create_sale(
  _organization_id uuid, _customer_id uuid, _status public.sale_status, _sold_at timestamptz,
  _notes text, _discount numeric, _tax numeric, _items jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _sale_id uuid; _subtotal numeric := 0; _item jsonb; _ref text; _n int;
BEGIN
  IF NOT public.has_module_access(_organization_id, auth.uid(), 'sales', 'manage') THEN
    RAISE EXCEPTION 'You don''t have permission to create sales' USING ERRCODE = '42501';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one product to the sale';
  END IF;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF (_item->>'quantity')::numeric <= 0 OR (_item->>'unit_price')::numeric < 0 THEN
      RAISE EXCEPTION 'Quantities must be positive and prices cannot be negative';
    END IF;
    _subtotal := _subtotal + round((_item->>'quantity')::numeric * (_item->>'unit_price')::numeric, 2);
  END LOOP;
  SELECT count(*) + 1 INTO _n FROM public.sales WHERE organization_id = _organization_id;
  _ref := 'SO-' || lpad(_n::text, 5, '0');
  -- Insert as draft first; switching status afterwards fires the stock trigger once for all items.
  INSERT INTO public.sales (organization_id, customer_id, reference, status, subtotal, tax_amount, discount_amount, total_amount, sold_at, notes, created_by)
  VALUES (_organization_id, _customer_id, _ref, 'draft', _subtotal, coalesce(_tax,0), coalesce(_discount,0),
          greatest(_subtotal + coalesce(_tax,0) - coalesce(_discount,0), 0), coalesce(_sold_at, now()), nullif(_notes,''), auth.uid())
  RETURNING id INTO _sale_id;
  INSERT INTO public.sale_items (organization_id, sale_id, product_id, description, quantity, unit_price)
  SELECT _organization_id, _sale_id, nullif(i->>'product_id','')::uuid, i->>'description', (i->>'quantity')::numeric, (i->>'unit_price')::numeric
  FROM jsonb_array_elements(_items) i;
  IF _status <> 'draft' THEN
    UPDATE public.sales SET status = _status WHERE id = _sale_id;
  END IF;
  RETURN _sale_id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_sale(uuid, uuid, public.sale_status, timestamptz, text, numeric, numeric, jsonb) TO authenticated;