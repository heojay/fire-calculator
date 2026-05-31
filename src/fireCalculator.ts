export type FireInputs = {
  investableAssets: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  annualNominalReturnRate: number;
  annualInflationRate: number;
  annualIncomeGrowthRate: number;
  targetWithdrawalRate: number;
  currentAge: number;
  lifeExpectancy: number;
};

export type FireProjection = {
  month: number;
  year: number;
  age: number;
  monthlyIncome: number;
  monthlySavings: number;
  monthlyExpenses: number;
  investableAssets: number;
  targetWithdrawalRate: number;
  fireTargetAssets: number;
  safeWithdrawalAmount: number;
};

export type FireScenarioResult = {
  name: string;
  description: string;
  inputs: FireInputs;
  status: "achieved" | "not-achieved";
  monthsToFire: number | null;
  currentFireTargetAssets: number;
  retirementFireTargetAssets: number | null;
  retirementInvestableAssets: number | null;
  retirementMonthlyExpenses: number | null;
  retirementFirstMonthExpenses: number | null;
  retirementSafeWithdrawalAmount: number | null;
  projections: FireProjection[];
};

export type DepletionResult = {
  status: "achievable" | "already-sufficient" | "not-achievable" | "invalid-time-horizon";
  monthsToWork: number | null;
  retirementAge: number | null;
  peakAssets: number | null;
  finalAssets: number | null;
  totalMonths: number;
  projections: DepletionProjection[];
};

export type DepletionProjection = {
  month: number;
  age: number;
  phase: "working" | "retired";
  cashFlow: number;
  assets: number;
};

export type FirePreset = {
  id: "korea-average" | "fire-example";
  name: string;
  values: FireInputs;
};

export const MAX_SIMULATION_MONTHS = 100 * 12;
export const MIN_WITHDRAWAL_RATE = 0.0001;
export const MIN_ANNUAL_NOMINAL_RETURN_RATE = -0.99;

export const FIRE_PRESETS: FirePreset[] = [
  {
    id: "korea-average",
    name: "대한민국 평균 가구",
    values: {
      investableAssets: 150_000_000,
      monthlyIncome: 6_190_000,
      monthlyExpenses: 2_940_000,
      annualNominalReturnRate: 0.07,
      annualInflationRate: 0.025,
      annualIncomeGrowthRate: 0.035,
      targetWithdrawalRate: 0.035,
      currentAge: 40,
      lifeExpectancy: 90,
    },
  },
  {
    id: "fire-example",
    name: "입력 예시용 FIRE 가구",
    values: {
      investableAssets: 360_000_000,
      monthlyIncome: 10_000_000,
      monthlyExpenses: 3_500_000,
      annualNominalReturnRate: 0.07,
      annualInflationRate: 0.025,
      annualIncomeGrowthRate: 0.035,
      targetWithdrawalRate: 0.035,
      currentAge: 31,
      lifeExpectancy: 90,
    },
  },
];

export const SCENARIO_DEFINITIONS = [
  {
    name: "보수적",
    description: "명목 수익률 -2%p",
    returnRateDelta: -0.02,
  },
  {
    name: "기본",
    description: "입력값 기준",
    returnRateDelta: 0,
  },
  {
    name: "낙관적",
    description: "명목 수익률 +2%p",
    returnRateDelta: 0.02,
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
  const projections: FireProjection[] = [];
  let achievedProjection: FireProjection | undefined;

  for (let month = 0; month <= MAX_SIMULATION_MONTHS; month += 1) {
    const projection = calculateProjectionForMonth(inputs, month, projections[month - 1]);
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
    monthsToFire: achievedProjection ? achievedProjection.month : null,
    currentFireTargetAssets: currentProjection.fireTargetAssets,
    retirementFireTargetAssets: achievedProjection?.fireTargetAssets ?? null,
    retirementInvestableAssets: achievedProjection?.investableAssets ?? null,
    retirementMonthlyExpenses: achievedProjection?.monthlyExpenses ?? null,
    retirementFirstMonthExpenses: achievedProjection?.monthlyExpenses ?? null,
    retirementSafeWithdrawalAmount: achievedProjection?.safeWithdrawalAmount ?? null,
    projections,
  };
}

export function calculateFireScenarios(inputs: FireInputs): FireScenarioResult[] {
  return SCENARIO_DEFINITIONS.map((scenario) =>
    calculateFireScenario(
      {
        ...inputs,
        annualNominalReturnRate: Math.max(
          inputs.annualNominalReturnRate + scenario.returnRateDelta,
          MIN_ANNUAL_NOMINAL_RETURN_RATE,
        ),
      },
      scenario.name,
      scenario.description,
    ),
  );
}

export function calculateYearsToWork(rawInputs: FireInputs): DepletionResult {
  const inputs = normalizeInputs(rawInputs);
  const totalMonths = Math.floor((inputs.lifeExpectancy - inputs.currentAge) * 12);

  if (totalMonths <= 0) {
    return {
      status: "invalid-time-horizon",
      monthsToWork: null,
      retirementAge: null,
      peakAssets: null,
      finalAssets: null,
      totalMonths: 0,
      projections: [],
    };
  }

  const cappedTotalMonths = Math.min(totalMonths, MAX_SIMULATION_MONTHS);
  const nowRetirementSimulation = simulateDepletion(inputs, cappedTotalMonths, 0);

  if (nowRetirementSimulation.finalAssets >= 0) {
    return {
      status: "already-sufficient",
      monthsToWork: 0,
      retirementAge: inputs.currentAge,
      peakAssets: nowRetirementSimulation.peakAssets,
      finalAssets: nowRetirementSimulation.finalAssets,
      totalMonths: cappedTotalMonths,
      projections: nowRetirementSimulation.projections,
    };
  }

  for (let monthsToWork = 1; monthsToWork <= cappedTotalMonths; monthsToWork += 1) {
    const simulation = simulateDepletion(inputs, cappedTotalMonths, monthsToWork);

    if (simulation.finalAssets >= 0) {
      return {
        status: "achievable",
        monthsToWork,
        retirementAge: inputs.currentAge + monthsToWork / 12,
        peakAssets: simulation.peakAssets,
        finalAssets: simulation.finalAssets,
        totalMonths: cappedTotalMonths,
        projections: simulation.projections,
      };
    }
  }

  const longestWorkSimulation = simulateDepletion(inputs, cappedTotalMonths, cappedTotalMonths);

  return {
    status: "not-achievable",
    monthsToWork: null,
    retirementAge: null,
    peakAssets: null,
    finalAssets: null,
    totalMonths: cappedTotalMonths,
    projections: longestWorkSimulation.projections,
  };
}

function normalizeInputs(inputs: FireInputs): FireInputs {
  return {
    ...inputs,
    investableAssets: finiteOrZero(inputs.investableAssets),
    monthlyIncome: finiteOrZero(inputs.monthlyIncome),
    monthlyExpenses: finiteOrZero(inputs.monthlyExpenses),
    annualNominalReturnRate: Math.max(
      finiteOrZero(inputs.annualNominalReturnRate),
      MIN_ANNUAL_NOMINAL_RETURN_RATE,
    ),
    annualInflationRate: Math.max(finiteOrZero(inputs.annualInflationRate), -0.99),
    annualIncomeGrowthRate: Math.max(finiteOrZero(inputs.annualIncomeGrowthRate), -0.99),
    targetWithdrawalRate: Math.max(finiteOrZero(inputs.targetWithdrawalRate), MIN_WITHDRAWAL_RATE),
    currentAge: finiteOrZero(inputs.currentAge),
    lifeExpectancy: finiteOrZero(inputs.lifeExpectancy),
  };
}

function calculateProjectionForMonth(
  inputs: FireInputs,
  month: number,
  previousProjection?: FireProjection,
): FireProjection {
  if (month > 0 && !previousProjection) {
    throw new Error(`Missing previous projection for month ${month}.`);
  }

  const monthlyReturnRate = annualRateToMonthlyRate(inputs.annualNominalReturnRate);
  const elapsedYears = Math.floor(month / 12);
  const monthlyIncome = applyAnnualGrowth(inputs.monthlyIncome, inputs.annualIncomeGrowthRate, elapsedYears);
  const monthlyExpenses = applyAnnualGrowth(
    inputs.monthlyExpenses,
    inputs.annualInflationRate,
    elapsedYears,
  );
  const monthlySavings = monthlyIncome - monthlyExpenses;
  const investableAssets =
    month === 0
      ? inputs.investableAssets
      : previousProjection!.investableAssets * (1 + monthlyReturnRate) + monthlySavings;
  const fireTargetAssets = (monthlyExpenses * 12) / inputs.targetWithdrawalRate;

  return {
    month,
    year: month / 12,
    age: inputs.currentAge + month / 12,
    monthlyIncome,
    monthlySavings,
    monthlyExpenses,
    investableAssets,
    targetWithdrawalRate: inputs.targetWithdrawalRate,
    fireTargetAssets,
    safeWithdrawalAmount: investableAssets * inputs.targetWithdrawalRate,
  };
}

function simulateDepletion(
  inputs: FireInputs,
  totalMonths: number,
  monthsToWork: number,
): { finalAssets: number; peakAssets: number; projections: DepletionProjection[] } {
  const monthlyReturnRate = annualRateToMonthlyRate(inputs.annualNominalReturnRate);
  let assets = inputs.investableAssets;
  let peakAssets = assets;
  const projections: DepletionProjection[] = [
    {
      month: 0,
      age: inputs.currentAge,
      phase: monthsToWork > 0 ? "working" : "retired",
      cashFlow: 0,
      assets,
    },
  ];

  for (let month = 1; month <= totalMonths; month += 1) {
    const isWorking = month <= monthsToWork;
    const cashFlow = isWorking ? inputs.monthlyIncome - inputs.monthlyExpenses : -inputs.monthlyExpenses;
    assets = assets * (1 + monthlyReturnRate) + cashFlow;

    if (month <= monthsToWork) {
      peakAssets = Math.max(peakAssets, assets);
    }

    projections.push({
      month,
      age: inputs.currentAge + month / 12,
      phase: isWorking ? "working" : "retired",
      cashFlow,
      assets,
    });
  }

  return {
    finalAssets: assets,
    peakAssets,
    projections,
  };
}

function annualRateToMonthlyRate(annualRate: number): number {
  return Math.max(1 + annualRate, Number.EPSILON) ** (1 / 12) - 1;
}

function applyAnnualGrowth(value: number, annualGrowthRate: number, elapsedYears: number): number {
  return value * Math.max(1 + annualGrowthRate, Number.EPSILON) ** elapsedYears;
}

function finiteOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundForPercentInput(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
