export type FireInputs = {
  investableAssets: number;
  annualIncome: number;
  annualExpenses: number;
  annualReturnRate: number;
  incomeGrowthRate: number;
  inflationRate: number;
  targetWithdrawalRate: number;
  currentAge?: number;
  totalAssets?: number;
  debt?: number;
  primaryResidenceValue?: number;
  otherRealAssets?: number;
  annualDebtPayment?: number;
  debtPaymentEndYear?: number;
  retirementAnnualIncome?: number;
  pensionAnnualIncome?: number;
  pensionStartAge?: number;
};

export type FireYearProjection = {
  year: number;
  age?: number;
  annualIncome: number;
  annualExpenses: number;
  debtPayment: number;
  savings: number;
  investableAssets: number;
  retirementIncome: number;
  fireTargetAssets: number;
  safeWithdrawalAmount: number;
};

export type FireScenarioResult = {
  name: string;
  description: string;
  inputs: FireInputs;
  status: "achieved" | "not-achieved";
  yearsToFire: number | null;
  retirementAge?: number;
  currentFireTargetAssets: number;
  retirementFireTargetAssets: number | null;
  retirementInvestableAssets: number | null;
  retirementAnnualExpenses: number | null;
  retirementSafeWithdrawalAmount: number | null;
  projections: FireYearProjection[];
};

export type FirePreset = {
  id: "korea-average" | "fire-example";
  name: string;
  description: string;
  values: FireInputs;
};

export const MAX_SIMULATION_YEARS = 100;

export const FIRE_PRESETS: FirePreset[] = [
  {
    id: "korea-average",
    name: "대한민국 평균 가구",
    description: "총자산 전체가 아닌 투자 가능 자산 1.5억원을 기준으로 시작합니다.",
    values: {
      investableAssets: 150_000_000,
      totalAssets: 566_780_000,
      debt: 95_340_000,
      primaryResidenceValue: 320_000_000,
      otherRealAssets: 96_780_000,
      annualIncome: 74_270_000,
      annualExpenses: 35_268_000,
      annualReturnRate: 0.04,
      incomeGrowthRate: 0.03,
      inflationRate: 0.025,
      targetWithdrawalRate: 0.035,
      currentAge: 40,
      annualDebtPayment: 0,
      debtPaymentEndYear: 0,
      retirementAnnualIncome: 0,
      pensionAnnualIncome: 0,
      pensionStartAge: 65,
    },
  },
  {
    id: "fire-example",
    name: "입력 예시용 FIRE 가구",
    description: "높은 저축률과 투자 가능 자산을 둔 입력 예시입니다.",
    values: {
      investableAssets: 350_000_000,
      totalAssets: 780_000_000,
      debt: 80_000_000,
      primaryResidenceValue: 330_000_000,
      otherRealAssets: 100_000_000,
      annualIncome: 120_000_000,
      annualExpenses: 42_000_000,
      annualReturnRate: 0.05,
      incomeGrowthRate: 0.03,
      inflationRate: 0.025,
      targetWithdrawalRate: 0.035,
      currentAge: 38,
      annualDebtPayment: 12_000_000,
      debtPaymentEndYear: 5,
      retirementAnnualIncome: 6_000_000,
      pensionAnnualIncome: 12_000_000,
      pensionStartAge: 65,
    },
  },
];

export const SCENARIO_DEFINITIONS = [
  {
    name: "보수적",
    description: "투자 수익률 -2%p, 인플레이션 +1%p",
    returnRateDelta: -0.02,
    inflationDelta: 0.01,
  },
  {
    name: "기본",
    description: "입력값 기준",
    returnRateDelta: 0,
    inflationDelta: 0,
  },
  {
    name: "낙관적",
    description: "투자 수익률 +2%p, 인플레이션 -1%p",
    returnRateDelta: 0.02,
    inflationDelta: -0.01,
  },
] as const;

export function percentInputToRate(value: number): number {
  return value / 100;
}

export function rateToPercentInput(value: number): number {
  return roundForPercentInput(value * 100);
}

export function calculateFireScenario(
  rawInputs: FireInputs,
  name = "기본",
  description = "입력값 기준",
): FireScenarioResult {
  const inputs = normalizeInputs(rawInputs);
  const projections: FireYearProjection[] = [];
  let achievedProjection: FireYearProjection | undefined;

  for (let year = 0; year <= MAX_SIMULATION_YEARS; year += 1) {
    const projection = calculateProjectionForYear(inputs, year, projections[year - 1]);
    projections.push(projection);

    if (!achievedProjection && projection.investableAssets >= projection.fireTargetAssets) {
      achievedProjection = projection;
      break;
    }
  }

  const currentProjection = projections[0];

  return {
    name,
    description,
    inputs,
    status: achievedProjection ? "achieved" : "not-achieved",
    yearsToFire: achievedProjection ? achievedProjection.year : null,
    retirementAge: achievedProjection?.age,
    currentFireTargetAssets: currentProjection.fireTargetAssets,
    retirementFireTargetAssets: achievedProjection?.fireTargetAssets ?? null,
    retirementInvestableAssets: achievedProjection?.investableAssets ?? null,
    retirementAnnualExpenses: achievedProjection?.annualExpenses ?? null,
    retirementSafeWithdrawalAmount: achievedProjection?.safeWithdrawalAmount ?? null,
    projections,
  };
}

export function calculateFireScenarios(inputs: FireInputs): FireScenarioResult[] {
  return SCENARIO_DEFINITIONS.map((scenario) =>
    calculateFireScenario(
      {
        ...inputs,
        annualReturnRate: Math.max(inputs.annualReturnRate + scenario.returnRateDelta, -0.99),
        inflationRate: Math.max(inputs.inflationRate + scenario.inflationDelta, -0.99),
      },
      scenario.name,
      scenario.description,
    ),
  );
}

function normalizeInputs(inputs: FireInputs): FireInputs {
  return {
    ...inputs,
    investableAssets: finiteOrZero(inputs.investableAssets),
    annualIncome: finiteOrZero(inputs.annualIncome),
    annualExpenses: finiteOrZero(inputs.annualExpenses),
    annualReturnRate: finiteOrZero(inputs.annualReturnRate),
    incomeGrowthRate: finiteOrZero(inputs.incomeGrowthRate),
    inflationRate: finiteOrZero(inputs.inflationRate),
    targetWithdrawalRate: Math.max(finiteOrZero(inputs.targetWithdrawalRate), 0.0001),
    annualDebtPayment: finiteOrZero(inputs.annualDebtPayment),
    debtPaymentEndYear: finiteOrZero(inputs.debtPaymentEndYear),
    retirementAnnualIncome: finiteOrZero(inputs.retirementAnnualIncome),
    pensionAnnualIncome: finiteOrZero(inputs.pensionAnnualIncome),
  };
}

function calculateProjectionForYear(
  inputs: FireInputs,
  year: number,
  previousProjection?: FireYearProjection,
): FireYearProjection {
  const age = inputs.currentAge === undefined ? undefined : inputs.currentAge + year;
  const annualIncome = inputs.annualIncome * (1 + inputs.incomeGrowthRate) ** year;
  const annualExpenses = inputs.annualExpenses * (1 + inputs.inflationRate) ** year;
  const debtPayment = getDebtPaymentForYear(inputs, year);
  const savings = annualIncome - annualExpenses - debtPayment;
  const investableAssets =
    year === 0
      ? inputs.investableAssets
      : (previousProjection?.investableAssets ?? inputs.investableAssets) *
          (1 + inputs.annualReturnRate) +
        savings;
  const retirementIncome = getRetirementIncomeForYear(inputs, age);
  const fireTargetAssets = Math.max(annualExpenses - retirementIncome, 0) / inputs.targetWithdrawalRate;

  return {
    year,
    age,
    annualIncome,
    annualExpenses,
    debtPayment,
    savings,
    investableAssets,
    retirementIncome,
    fireTargetAssets,
    safeWithdrawalAmount: investableAssets * inputs.targetWithdrawalRate,
  };
}

function getDebtPaymentForYear(inputs: FireInputs, year: number): number {
  const annualDebtPayment = inputs.annualDebtPayment ?? 0;
  const debtPaymentEndYear = inputs.debtPaymentEndYear ?? 0;

  if (annualDebtPayment <= 0) {
    return 0;
  }

  if (debtPaymentEndYear <= 0) {
    return annualDebtPayment;
  }

  return year <= debtPaymentEndYear ? annualDebtPayment : 0;
}

function getRetirementIncomeForYear(inputs: FireInputs, age?: number): number {
  const baseRetirementIncome = inputs.retirementAnnualIncome ?? 0;
  const pensionAnnualIncome = inputs.pensionAnnualIncome ?? 0;
  const pensionStartAge = inputs.pensionStartAge;

  if (age === undefined || pensionStartAge === undefined || age < pensionStartAge) {
    return baseRetirementIncome;
  }

  return baseRetirementIncome + pensionAnnualIncome;
}

function finiteOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundForPercentInput(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
