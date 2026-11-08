CREATE TABLE public.employee_payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  pay_date date NOT NULL,
  basic_pay numeric(14,2) NOT NULL CHECK (basic_pay >= 0),
  benefits numeric(14,2) NOT NULL CHECK (benefits >= 0),
  gross_pay numeric(14,2) NOT NULL CHECK (gross_pay >= 0),
  sss_deduction numeric(14,2) NOT NULL CHECK (sss_deduction >= 0),
  philhealth_deduction numeric(14,2) NOT NULL CHECK (philhealth_deduction >= 0),
  pagibig_deduction numeric(14,2) NOT NULL CHECK (pagibig_deduction >= 0),
  tax_deduction numeric(14,2) NOT NULL CHECK (tax_deduction >= 0),
  other_deductions numeric(14,2) NOT NULL CHECK (other_deductions >= 0),
  cash_advance_repaid numeric(14,2) NOT NULL DEFAULT 0 CHECK (cash_advance_repaid >= 0),
  total_deductions numeric(14,2) NOT NULL CHECK (total_deductions >= 0),
  net_pay numeric(14,2) NOT NULL,
  sss_monthly_salary_credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (sss_monthly_salary_credit >= 0),
  calculation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, employee_id, pay_period_start, pay_period_end),
  FOREIGN KEY (employee_id, organization_id) REFERENCES public.employees(id, organization_id) ON DELETE CASCADE,
  CHECK (pay_period_start <= pay_period_end),
  CHECK (gross_pay = basic_pay + benefits),
  CHECK (total_deductions = sss_deduction + philhealth_deduction + pagibig_deduction + tax_deduction + other_deductions + cash_advance_repaid),
  CHECK (net_pay = gross_pay - total_deductions)
);
GRANT SELECT ON public.employee_payroll_runs TO authenticated;
GRANT ALL ON public.employee_payroll_runs TO service_role;
ALTER TABLE public.employee_payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View payroll with finance access" ON public.employee_payroll_runs
  FOR SELECT TO authenticated USING (public.has_module_access(organization_id, auth.uid(), 'finance', 'view'));
CREATE INDEX employee_payroll_runs_employee_idx ON public.employee_payroll_runs(organization_id, employee_id, pay_date DESC);

ALTER TABLE public.employee_cash_advances
  ADD COLUMN payroll_run_id uuid;
ALTER TABLE public.employee_cash_advances
  ADD CONSTRAINT employee_cash_advances_payroll_run_fk
  FOREIGN KEY (payroll_run_id, organization_id)
  REFERENCES public.employee_payroll_runs(id, organization_id);
CREATE UNIQUE INDEX employee_cash_advances_payroll_run_uq
  ON public.employee_cash_advances(payroll_run_id) WHERE payroll_run_id IS NOT NULL;
DROP POLICY IF EXISTS "Create with finance manage" ON public.employee_cash_advances;
CREATE POLICY "Create with finance manage" ON public.employee_cash_advances
  FOR INSERT TO authenticated
  WITH CHECK (payroll_run_id IS NULL AND public.has_module_access(organization_id, auth.uid(), 'finance', 'manage'));
DROP POLICY IF EXISTS "Delete with finance manage" ON public.employee_cash_advances;
CREATE POLICY "Delete with finance manage" ON public.employee_cash_advances
  FOR DELETE TO authenticated
  USING (payroll_run_id IS NULL AND public.has_module_access(organization_id, auth.uid(), 'finance', 'manage'));

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
  _employee_id uuid;
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

  SELECT e.id INTO _employee_id
  FROM public.employees e
  WHERE e.id = _employee_id AND e.organization_id = _organization_id
  FOR UPDATE;
  IF _employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee not found in this organization';
  END IF;
  SELECT c.base_salary, c.cash_advance_deduction
    INTO _base_salary, _cash_advance_per_period
  FROM public.employee_compensation c
  WHERE c.organization_id = _organization_id AND c.employee_id = _employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Set employee pay before recording a payroll estimate';
  END IF;
  IF abs(_basic - _base_salary) > 0.01 THEN
    RAISE EXCEPTION 'Pay settings changed; refresh the estimate before recording';
  END IF;
  SELECT COALESCE(SUM(CASE WHEN entry_type = 'advance' THEN amount ELSE -amount END), 0)
    INTO _outstanding
  FROM public.employee_cash_advances
  WHERE organization_id = _organization_id AND employee_id = _employee_id;
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
    _organization_id, _employee_id, _pay_period_start, _pay_period_end, _pay_date,
    _basic, _benefits, _gross, _sss, _philhealth, _pagibig,
    _tax, _other, _cash_advance, _total_deductions, _net,
    _sss_msc, _snapshot, auth.uid()
  ) RETURNING id INTO _run_id;

  IF _cash_advance > 0 THEN
    INSERT INTO public.employee_cash_advances (
      organization_id, employee_id, entry_type, amount, entry_date, reason, created_by, payroll_run_id
    ) VALUES (
      _organization_id, _employee_id, 'repayment', _cash_advance, _pay_date,
      'Payroll estimate · ' || to_char(_pay_period_start, 'YYYY-MM-DD') || ' to ' || to_char(_pay_period_end, 'YYYY-MM-DD'),
      auth.uid(), _run_id
    );
  END IF;

  INSERT INTO public.activity_logs (organization_id, actor_id, action, entity_type, entity_id, description, metadata)
  VALUES (
    _organization_id, auth.uid(), 'employee.payroll_recorded', 'employee_payroll_run', _run_id,
    'Payroll estimate recorded for employee ' || _employee_id::text,
    jsonb_build_object('employee_id', _employee_id, 'pay_period_start', _pay_period_start, 'pay_period_end', _pay_period_end, 'net_pay', _net)
  );
  RETURN _run_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_employee_payroll_run(uuid, uuid, date, date, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_employee_payroll_run(uuid, uuid, date, date, date, jsonb) TO authenticated;