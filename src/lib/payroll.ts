/**
 * Philippine payroll estimate: SSS, PhilHealth, Pag-IBIG and BIR withholding tax.
 *
 * ESTIMATE ONLY. Rates change. Check them against the latest SSS, PhilHealth,
 * Pag-IBIG and BIR issuances before relying on payroll figures. Everything that can
 * change lives in RATES below, so updating a rate means editing only that object.
 *
 * Rates last reviewed: 2026 (employee shares only; employer shares are not computed).
 */
export const RATES = {
  asOf: "2026",
  sss: {
    employeeRate: 0.05, // employee share of the monthly salary credit (total 15%, employer 10%)
    minMsc: 5000,
    maxMsc: 35000,
    step: 500,
  },
  philhealth: {
    premiumRate: 0.05, // total premium, split equally between employee and employer
    employeeShare: 0.5,
    incomeFloor: 10000,
    incomeCeiling: 100000,
  },
  pagibig: {
    employeeRate: 0.02,
    lowIncomeRate: 0.01, // when monthly compensation is at or below lowIncomeLimit
    lowIncomeLimit: 1500,
    maxFundSalary: 10000,
  },
  // TRAIN law annual income tax table for compensation income: [over, upTo, baseTax, rateOnExcess]
  taxBrackets: [
    [0, 250000, 0, 0],
    [250000, 400000, 0, 0.15],
    [400000, 800000, 22500, 0.2],
    [800000, 2000000, 102500, 0.25],
    [2000000, 8000000, 402500, 0.3],
    [8000000, Infinity, 2202500, 0.35],
  ] as [number, number, number, number][],
} as const;

export type PayFrequency = "monthly" | "semi_monthly" | "weekly";

export const PERIODS_PER_MONTH: Record<PayFrequency, number> = {
  monthly: 1,
  semi_monthly: 2,
  weekly: 52 / 12,
};

export type PayItemLike = {
  kind: "benefit" | "deduction";
  amount: number;
  taxable: boolean;
  active: boolean;
};

export type StatutorySettings = {
  sss: boolean;
  philhealth: boolean;
  pagibig: boolean;
  tax: boolean;
};

export type PayEstimate = {
  basic: number;
  benefits: number;
  gross: number;
  sss: number;
  philhealth: number;
  pagibig: number;
  tax: number;
  otherDeductions: number;
  cashAdvance: number;
  totalDeductions: number;
  net: number;
  /** The SSS monthly salary credit used, for display. */
  sssMsc: number;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Monthly salary credit: compensation rounded to the nearest step, kept between min and max. */
export function sssMsc(monthlyCompensation: number): number {
  const { minMsc, maxMsc, step } = RATES.sss;
  const msc = Math.floor((monthlyCompensation + step / 2) / step) * step;
  return Math.min(Math.max(msc, minMsc), maxMsc);
}

export function annualIncomeTax(annualTaxable: number): number {
  if (annualTaxable <= 0) return 0;
  for (const [over, upTo, base, rate] of RATES.taxBrackets) {
    if (annualTaxable <= upTo) return base + (annualTaxable - over) * rate;
  }
  return 0;
}

/**
 * Estimates one pay period. `payPerPeriod` and every pay item amount are per pay period.
 * Contributions are computed monthly, then split evenly across the periods in a month.
 */
export function estimatePay(input: {
  payPerPeriod: number;
  frequency: PayFrequency;
  items: PayItemLike[];
  statutory: StatutorySettings;
  /** Cash advance repayment to deduct each period (the cap of what is still owed is applied here). */
  cashAdvancePerPeriod: number;
  cashAdvanceOutstanding: number;
}): PayEstimate {
  const ppm = PERIODS_PER_MONTH[input.frequency];
  const active = input.items.filter((i) => i.active);

  const baseMonthly = input.payPerPeriod * ppm;
  const benefitsMonthly = active.filter((i) => i.kind === "benefit").reduce((t, i) => t + i.amount * ppm, 0);
  const taxableBenefitsMonthly = active
    .filter((i) => i.kind === "benefit" && i.taxable)
    .reduce((t, i) => t + i.amount * ppm, 0);
  const grossMonthly = baseMonthly + benefitsMonthly;

  // SSS: on total monthly compensation
  const msc = sssMsc(grossMonthly);
  const sssMonthly = input.statutory.sss && grossMonthly > 0 ? msc * RATES.sss.employeeRate : 0;

  // PhilHealth: on basic monthly salary, between the floor and the ceiling
  const ph = RATES.philhealth;
  const phBase = Math.min(Math.max(baseMonthly, ph.incomeFloor), ph.incomeCeiling);
  const philhealthMonthly =
    input.statutory.philhealth && baseMonthly > 0 ? phBase * ph.premiumRate * ph.employeeShare : 0;

  // Pag-IBIG: on monthly compensation, capped at the maximum fund salary
  const pi = RATES.pagibig;
  const piRate = grossMonthly <= pi.lowIncomeLimit ? pi.lowIncomeRate : pi.employeeRate;
  const pagibigMonthly =
    input.statutory.pagibig && grossMonthly > 0 ? Math.min(grossMonthly, pi.maxFundSalary) * piRate : 0;

  // Withholding tax: taxable pay less the employee contributions, annualised
  const taxableMonthly =
    baseMonthly + taxableBenefitsMonthly - sssMonthly - philhealthMonthly - pagibigMonthly;
  const taxMonthly = input.statutory.tax ? annualIncomeTax(Math.max(taxableMonthly, 0) * 12) / 12 : 0;

  const otherMonthly = active.filter((i) => i.kind === "deduction").reduce((t, i) => t + i.amount * ppm, 0);

  // Everything below is per pay period, rounded to cents so the lines add up exactly
  const basic = r2(input.payPerPeriod);
  const benefits = r2(benefitsMonthly / ppm);
  const gross = r2(basic + benefits);
  const sss = r2(sssMonthly / ppm);
  const philhealth = r2(philhealthMonthly / ppm);
  const pagibig = r2(pagibigMonthly / ppm);
  const tax = r2(taxMonthly / ppm);
  const otherDeductions = r2(otherMonthly / ppm);
  const cashAdvance = r2(Math.min(Math.max(input.cashAdvancePerPeriod, 0), Math.max(input.cashAdvanceOutstanding, 0)));
  const totalDeductions = r2(sss + philhealth + pagibig + tax + otherDeductions + cashAdvance);

  return {
    basic,
    benefits,
    gross,
    sss,
    philhealth,
    pagibig,
    tax,
    otherDeductions,
    cashAdvance,
    totalDeductions,
    net: r2(gross - totalDeductions),
    sssMsc: msc,
  };
}