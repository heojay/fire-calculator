export type FireInputs = {
  investableAssets: number;
  monthlySavings: number;
  monthlyExpenses: number;
  annualRealReturnRate: number;
  targetWithdrawalRate: number;
  currentAge: number;
  lifeExpectancy: number;
};

export type FireProjection = {
  month: number;
  year: number;
  age: number;
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
export const MIN_ANNUAL_REAL_RETURN_RATE = -0.99;

export const FIRE_PRESETS: FirePreset[] = [
  {
    id: "korea-average",
    name: "대한민국 평균 가구",
    values: {
      investableAssets: 150_000_000,
      monthlySavings: 3_250_000,
      monthlyExpenses: 2_940_000,
      annualRealReturnRate: 0.04,
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
      monthlySavings: 6_500_000,
      monthlyExpenses: 3_500_000,
      annualRealReturnRate: 0.04,
      targetWithdrawalRate: 0.035,
      currentAge: 31,
      lifeExpectancy: 90,
    },
  },
];

export const SCENARIO_DEFINITIONS = [
  {
    name: "보수적",
    description: "실질 수익률 -2%p",
    returnRateDelta: -0.02,
  },
  {
    name: "기본",
    description: "입력값 기준",
    returnRateDelta: 0,
  },
  {
    name: "낙관적",
    description: "실질 수익률 +2%p",
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
    retirementSafeWithdrawalAmount: achievedProjection?.safeWithdrawalAmount ?? null,
    projections,
  };
}

export function calculateFireScenarios(inputs: FireInputs): FireScenarioResult[] {
  return SCENARIO_DEFINITIONS.map((scenario) =>
    calculateFireScenario(
      {
        ...inputs,
        annualRealReturnRate: Math.max(
          inputs.annualRealReturnRate + scenario.returnRateDelta,
          MIN_ANNUAL_REAL_RETURN_RATE,
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
    monthlySavings: finiteOrZero(inputs.monthlySavings),
    monthlyExpenses: finiteOrZero(inputs.monthlyExpenses),
    annualRealReturnRate: Math.max(
      finiteOrZero(inputs.annualRealReturnRate),
      MIN_ANNUAL_REAL_RETURN_RATE,
    ),
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

  const monthlyReturnRate = annualRateToMonthlyRate(inputs.annualRealReturnRate);
  const investableAssets =
    month === 0
      ? inputs.investableAssets
      : previousProjection!.investableAssets * (1 + monthlyReturnRate) + inputs.monthlySavings;
  const fireTargetAssets = (inputs.monthlyExpenses * 12) / inputs.targetWithdrawalRate;

  return {
    month,
    year: month / 12,
    age: inputs.currentAge + month / 12,
    monthlySavings: inputs.monthlySavings,
    monthlyExpenses: inputs.monthlyExpenses,
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
  const monthlyReturnRate = annualRateToMonthlyRate(inputs.annualRealReturnRate);
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
    const cashFlow = isWorking ? inputs.monthlySavings : -inputs.monthlyExpenses;
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

function finiteOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundForPercentInput(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
