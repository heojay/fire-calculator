export type FireInputs = {
  investableAssets: number;
  annualIncome: number;
  annualExpenses: number;
  annualReturnRate: number;
  incomeGrowthRate: number;
  inflationRate: number;
  targetWithdrawalRate: number;
};

export type FireYearProjection = {
  year: number;
  annualIncome: number;
  annualExpenses: number;
  savings: number;
  investableAssets: number;
  fireTargetAssets: number;
  safeWithdrawalAmount: number;
};

export type FireScenarioResult = {
  name: string;
  description: string;
  inputs: FireInputs;
  status: "achieved" | "not-achieved";
  yearsToFire: number | null;
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
  values: FireInputs;
};

export const MAX_SIMULATION_YEARS = 100;

export const FIRE_PRESETS: FirePreset[] = [
  {
    id: "korea-average",
    name: "대한민국 평균 가구",
    values: {
      investableAssets: 150_000_000,
      annualIncome: 74_270_000,
      annualExpenses: 35_268_000,
      annualReturnRate: 0.04,
      incomeGrowthRate: 0.03,
      inflationRate: 0.025,
      targetWithdrawalRate: 0.035,
    },
  },
  {
    id: "fire-example",
    name: "입력 예시용 FIRE 가구",
    values: {
      investableAssets: 350_000_000,
      annualIncome: 120_000_000,
      annualExpenses: 42_000_000,
      annualReturnRate: 0.05,
      incomeGrowthRate: 0.03,
      inflationRate: 0.025,
      targetWithdrawalRate: 0.035,
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
        annualReturnRate: Math.max(inputs.annualReturnRate + scenario.returnRateDelta, 0),
        inflationRate: Math.max(inputs.inflationRate + scenario.inflationDelta, 0),
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
  };
}

function calculateProjectionForYear(
  inputs: FireInputs,
  year: number,
  previousProjection?: FireYearProjection,
): FireYearProjection {
  const annualIncome = inputs.annualIncome * (1 + inputs.incomeGrowthRate) ** year;
  const annualExpenses = inputs.annualExpenses * (1 + inputs.inflationRate) ** year;
  const savings = annualIncome - annualExpenses;
  const investableAssets =
    year === 0
      ? inputs.investableAssets
      : (previousProjection?.investableAssets ?? inputs.investableAssets) *
          (1 + inputs.annualReturnRate) +
        savings;
  const fireTargetAssets = annualExpenses / inputs.targetWithdrawalRate;

  return {
    year,
    annualIncome,
    annualExpenses,
    savings,
    investableAssets,
    fireTargetAssets,
    safeWithdrawalAmount: investableAssets * inputs.targetWithdrawalRate,
  };
}

function finiteOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundForPercentInput(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
