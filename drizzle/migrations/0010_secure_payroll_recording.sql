CREATE OR REPLACE FUNCTION public.guard_employee_cash_advance_repayment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_row_id uuid;
  _outstanding numeric;
BEGIN
  IF NEW.entry_type <> 'repayment' THEN
    RETURN NEW;
  END IF;
  SELECT e.id INTO _employee_row_id
  FROM public.employees e
  WHERE e.id = NEW.employee_id AND e.organization_id = NEW.organization_id
  FOR UPDATE;
  IF _employee_row_id IS NULL THEN
    RAISE EXCEPTION 'Employee not found in this organization';
  END IF;
  SELECT COALESCE(SUM(CASE WHEN a.entry_type = 'advance' THEN a.amount ELSE -a.amount END), 0)
    INTO _outstanding
  FROM public.employee_cash_advances a
  WHERE a.organization_id = NEW.organization_id AND a.employee_id = NEW.employee_id;
  IF NEW.amount > GREATEST(_outstanding, 0) THEN
    RAISE EXCEPTION 'Repayment exceeds the outstanding cash advance balance';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_employee_cash_advance_repayment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER employee_cash_advance_repayment_guard
  BEFORE INSERT ON public.employee_cash_advances
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_cash_advance_repayment();

CREATE OR REPLACE FUNCTION public.record_employee_payroll_run(
  _organization_id uuid,
  _employee_id uuid,
  _pay_period_start date,
  _pay_period_end date,
  _pay_date date,
  _snapshot jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _run_id uuid;
  _employee_row_id uuid;
  _base_salary numeric;
  _cash_advance_per_period numeric;
  _outstanding numeric;
  _expected_cash_advance numeric;
  _basic numeric;
  _benefits numeric;
  _gross numeric;
  _sss numeric;
  _philhealth numeric;
  _pagibig numeric;
  _tax numeric;
  _other numeric;
  _cash_advance numeric;
  _total_deductions numeric;
  _net numeric;
  _sss_msc numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_module_access(_organization_id, auth.uid(), 'finance', 'manage') THEN
    RAISE EXCEPTION 'Finance manage access is required';
  END IF;
  IF _employee_id IS NULL OR _pay_period_start IS NULL OR _pay_period_end IS NULL OR _pay_date IS NULL
     OR _pay_period_start > _pay_period_end OR _snapshot IS NULL OR jsonb_typeof(_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'Provide a valid employee, pay period, pay date, and payroll estimate';
  END IF;
  IF NOT (_snapshot ?& ARRAY['basic','benefits','gross','sss','philhealth','pagibig','tax','otherDeductions','cashAdvance','totalDeductions','net','sssMsc']) THEN
    RAISE EXCEPTION 'Payroll estimate is incomplete';
  END IF;

  _basic := (_snapshot->>'basic')::numeric;
  _benefits := (_snapshot->>'benefits')::numeric;
  _gross := (_snapshot->>'gross')::numeric;
  _sss := (_snapshot->>'sss')::numeric;
  _philhealth := (_snapshot->>'philhealth')::numeric;
  _pagibig := (_snapshot->>'pagibig')::numeric;
  _tax := (_snapshot->>'tax')::numeric;
  _other := (_snapshot->>'otherDeductions')::numeric;
  _cash_advance := (_snapshot->>'cashAdvance')::numeric;
  _total_deductions := (_snapshot->>'totalDeductions')::numeric;
  _net := (_snapshot->>'net')::numeric;
  _sss_msc := (_snapshot->>'sssMsc')::numeric;
  IF _basic < 0 OR _benefits < 0 OR _gross < 0 OR _sss < 0 OR _philhealth < 0 OR _pagibig < 0 OR _tax < 0
     OR _other < 0 OR _cash_advance < 0 OR _total_deductions < 0 OR _sss_msc < 0
     OR abs(_gross - (_basic + _benefits)) > 0.01
     OR abs(_total_deductions - (_sss + _philhealth + _pagibig + _tax + _other + _cash_advance)) > 0.01
     OR abs(_net - (_gross - _total_deductions)) > 0.01 THEN
    RAISE EXCEPTION 'Payroll estimate totals do not balance';
  END IF;

  SELECT e.id INTO _employee_row_id
  FROM public.employees e
  WHERE e.id = _employee_id AND e.organization_id = _organization_id
  FOR UPDATE;
  IF _employee_row_id IS NULL THEN
    RAISE EXCEPTION 'Employee not found in this organization';
  END IF;
  SELECT c.base_salary, c.cash_advance_deduction
    INTO _base_salary, _cash_advance_per_period
  FROM public.employee_compensation c
  WHERE c.organization_id = _organization_id AND c.employee_id = _employee_row_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Set employee pay before recording a payroll estimate';
  END IF;
  IF abs(_basic - _base_salary) > 0.01 THEN
    RAISE EXCEPTION 'Pay settings changed; refresh the estimate before recording';
  END IF;
  SELECT COALESCE(SUM(CASE WHEN a.entry_type = 'advance' THEN a.amount ELSE -a.amount END), 0)
    INTO _outstanding
  FROM public.employee_cash_advances a
  WHERE a.organization_id = _organization_id AND a.employee_id = _employee_row_id;
  _expected_cash_advance := LEAST(GREATEST(_cash_advance_per_period, 0), GREATEST(_outstanding, 0));
  IF abs(_cash_advance - _expected_cash_advance) > 0.01 THEN
    RAISE EXCEPTION 'Cash advance balance changed; refresh the estimate before recording';
  END IF;

  INSERT INTO public.employee_payroll_runs (
    organization_id, employee_id, pay_period_start, pay_period_end, pay_date,
    basic_pay, benefits, gross_pay, sss_deduction, philhealth_deduction, pagibig_deduction,
    tax_deduction, other_deductions, cash_advance_repaid, total_deductions, net_pay,
    sss_monthly_salary_credit, calculation_snapshot, created_by
  ) VALUES (
    _organization_id, _employee_row_id, _pay_period_start, _pay_period_end, _pay_date,
    _basic, _benefits, _gross, _sss, _philhealth, _pagibig,
    _tax, _other, _cash_advance, _total_deductions, _net,
    _sss_msc, _snapshot, auth.uid()
  ) RETURNING id INTO _run_id;

  IF _cash_advance > 0 THEN
    INSERT INTO public.employee_cash_advances (
      organization_id, employee_id, entry_type, amount, entry_date, reason, created_by, payroll_run_id
    ) VALUES (
      _organization_id, _employee_row_id, 'repayment', _cash_advance, _pay_date,
      'Payroll estimate · ' || to_char(_pay_period_start, 'YYYY-MM-DD') || ' to ' || to_char(_pay_period_end, 'YYYY-MM-DD'),
      auth.uid(), _run_id
    );
  END IF;

  INSERT INTO public.activity_logs (organization_id, actor_id, action, entity_type, entity_id, description, metadata)
  VALUES (
    _organization_id, auth.uid(), 'employee.payroll_recorded', 'employee_payroll_run', _run_id,
    'Payroll estimate recorded for employee ' || _employee_row_id::text,
    jsonb_build_object('employee_id', _employee_row_id, 'pay_period_start', _pay_period_start, 'pay_period_end', _pay_period_end, 'net_pay', _net)
  );
  RETURN _run_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_employee_payroll_run(uuid, uuid, date, date, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_employee_payroll_run(uuid, uuid, date, date, date, jsonb) TO authenticated;