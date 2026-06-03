export type FireInputs = {
  investableAssets: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  retirementMonthlyExpenses: number;
  annualNominalReturnRate: number;
  annualInflationRate: number;
  annualIncomeGrowthRate: number;
  targetWithdrawalRate: number;
  birthYear: number;
  lifeExpectancy: number;
  nationalPensionMonthlyAmount: number;
};

export type FireProjection = {
  month: number;
  year: number;
  age: number;
  phase: "working" | "retired";
  cashFlow: number;
  monthlyIncome: number;
  monthlySavings: number;
  monthlyExpenses: number;
  retirementMonthlyExpenses: number;
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
  retirementFirstMonthExpenses: number | null;
  nationalPensionStartAge: number | null;
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
  monthlyIncome: number;
  nationalPensionIncome: number;
  monthlyExpenses: number;
  assets: number;
};

export type FirePreset = {
  id: "korea-average" | "fire-example";
  name: string;
  values: FireInputs;
};

export const MAX_SIMULATION_MONTHS = 100 * 12;
export const MAX_FIRE_SCENARIO_MONTHS = 50 * 12;
export const MIN_WITHDRAWAL_RATE = 0.0001;
export const MIN_ANNUAL_NOMINAL_RETURN_RATE = -0.99;
export const DEFAULT_NATIONAL_PENSION_START_AGE = 65;

export const FIRE_PRESETS: FirePreset[] = [
  {
    id: "korea-average",
    name: "대한민국 평균 가구",
    values: {
      investableAssets: 150_000_000,
      monthlyIncome: 6_189_000,
      monthlyExpenses: 35_268_000 / 12,
      retirementMonthlyExpenses: 35_268_000 / 12,
      annualNominalReturnRate: 0.05,
      annualInflationRate: 0.02,
      annualIncomeGrowthRate: 0.03,
      targetWithdrawalRate: 0.035,
      birthYear: getCurrentYear() - 40,
      lifeExpectancy: 90,
      nationalPensionMonthlyAmount: 724_000,
    },
  },
  {
    id: "fire-example",
    name: "입력 예시용 FIRE 가구",
    values: {
      investableAssets: 350_000_000,
      monthlyIncome: 120_000_000 / 12,
      monthlyExpenses: 42_000_000 / 12,
      retirementMonthlyExpenses: 42_000_000 / 12,
      annualNominalReturnRate: 0.05,
      annualInflationRate: 0.02,
      annualIncomeGrowthRate: 0.03,
      targetWithdrawalRate: 0.035,
      birthYear: getCurrentYear() - 40,
      lifeExpectancy: 90,
      nationalPensionMonthlyAmount: 0,
    },
  },
];

export const SCENARIO_DEFINITIONS = [
  {
    name: "보수적",
    description: "수익률 -2%p",
    returnRateDelta: -0.02,
  },
  {
    name: "기본",
    description: "입력값 기준",
    returnRateDelta: 0,
  },
  {
    name: "낙관적",
    description: "수익률 +2%p",
    returnRateDelta: 0.02,
  },
] as const;

export function percentInputToRate(value: number): number {
  return value / 100;
}

export function rateToPercentInput(value: number): number {
  return roundForPercentInput(value * 100);
}

export function calculateCurrentAgeFromBirthYear(
  birthYear: number,
  currentYear = getCurrentYear(),
): number {
  return Math.max(currentYear - normalizeBirthYear(birthYear, currentYear), 0);
}

export function calculateNationalPensionStartAge(birthYear: number): number {
  const normalizedBirthYear = normalizeBirthYear(birthYear);

  if (normalizedBirthYear <= 1952) {
    return 60;
  }

  if (normalizedBirthYear <= 1956) {
    return 61;
  }

  if (normalizedBirthYear <= 1960) {
    return 62;
  }

  if (normalizedBirthYear <= 1964) {
    return 63;
  }

  if (normalizedBirthYear <= 1968) {
    return 64;
  }

  return DEFAULT_NATIONAL_PENSION_START_AGE;
}

export function calculatePresentValue(
  value: number,
  annualInflationRate: number,
  month: number,
): number {
  const normalizedInflationRate = Math.max(finiteOrZero(annualInflationRate), -0.99);

  return value / Math.max(1 + normalizedInflationRate, Number.EPSILON) ** Math.floor(month / 12);
}

export function calculateFireScenario(
  rawInputs: FireInputs,
  name = "기본",
  description = "입력값 기준",
): FireScenarioResult {
  const inputs = normalizeInputs(rawInputs);
  const projections: FireProjection[] = [];
  let achievedProjection: FireProjection | undefined;

  for (let month = 0; month <= MAX_FIRE_SCENARIO_MONTHS; month += 1) {
    const projection = calculateProjectionForMonth(
      inputs,
      month,
      achievedProjection?.month ?? null,
      projections[month - 1],
    );
    projections.push(projection);

    if (!achievedProjection && projection.investableAssets >= projection.fireTargetAssets) {
      achievedProjection = projection;
    }
  }

  const currentProjection = projections[0];
  const retirementFirstMonthExpenses = achievedProjection
    ? calculateMonthlyRetirementExpenses(inputs, achievedProjection.month + 1)
    : null;

  return {
    name,
    description,
    inputs,
    status: achievedProjection ? "achieved" : "not-achieved",
    monthsToFire: achievedProjection ? achievedProjection.month : null,
    currentFireTargetAssets: currentProjection.fireTargetAssets,
    retirementFireTargetAssets: achievedProjection?.fireTargetAssets ?? null,
    retirementInvestableAssets: achievedProjection?.investableAssets ?? null,
    retirementMonthlyExpenses: achievedProjection?.retirementMonthlyExpenses ?? null,
    retirementFirstMonthExpenses,
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
  const totalMonths = Math.floor(
    (inputs.lifeExpectancy - calculateCurrentAgeFromBirthYear(inputs.birthYear)) * 12,
  );

  if (totalMonths <= 0) {
    return {
      status: "invalid-time-horizon",
      monthsToWork: null,
      retirementAge: null,
      retirementFirstMonthExpenses: null,
      nationalPensionStartAge: null,
      peakAssets: null,
      finalAssets: null,
      totalMonths: 0,
      projections: [],
    };
  }

  const cappedTotalMonths = Math.min(totalMonths, MAX_SIMULATION_MONTHS);
  const nowRetirementSimulation = simulateDepletion(inputs, cappedTotalMonths, 0);

  if (isSolventThroughLifeExpectancy(nowRetirementSimulation)) {
    return {
      status: "already-sufficient",
      monthsToWork: 0,
      retirementAge: calculateCurrentAgeFromBirthYear(inputs.birthYear),
      retirementFirstMonthExpenses: nowRetirementSimulation.retirementFirstMonthExpenses,
      nationalPensionStartAge: calculateNationalPensionStartAge(inputs.birthYear),
      peakAssets: nowRetirementSimulation.peakAssets,
      finalAssets: nowRetirementSimulation.finalAssets,
      totalMonths: cappedTotalMonths,
      projections: nowRetirementSimulation.projections,
    };
  }

  for (let monthsToWork = 1; monthsToWork <= cappedTotalMonths; monthsToWork += 1) {
    const simulation = simulateDepletion(inputs, cappedTotalMonths, monthsToWork);

    if (isSolventThroughLifeExpectancy(simulation)) {
      return {
        status: "achievable",
        monthsToWork,
        retirementAge: calculateCurrentAgeFromBirthYear(inputs.birthYear) + monthsToWork / 12,
        retirementFirstMonthExpenses: simulation.retirementFirstMonthExpenses,
        nationalPensionStartAge: calculateNationalPensionStartAge(inputs.birthYear),
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
    retirementFirstMonthExpenses: null,
    nationalPensionStartAge: calculateNationalPensionStartAge(inputs.birthYear),
    peakAssets: null,
    finalAssets: null,
    totalMonths: cappedTotalMonths,
    projections: longestWorkSimulation.projections,
  };
}

function normalizeInputs(inputs: FireInputs): FireInputs {
  const currentYear = getCurrentYear();

  return {
    ...inputs,
    investableAssets: Math.max(finiteOrZero(inputs.investableAssets), 0),
    monthlyIncome: Math.max(finiteOrZero(inputs.monthlyIncome), 0),
    monthlyExpenses: Math.max(finiteOrZero(inputs.monthlyExpenses), 0),
    retirementMonthlyExpenses: Math.max(
      finiteOrZero(inputs.retirementMonthlyExpenses ?? inputs.monthlyExpenses),
      0,
    ),
    annualNominalReturnRate: Math.max(
      finiteOrZero(inputs.annualNominalReturnRate),
      MIN_ANNUAL_NOMINAL_RETURN_RATE,
    ),
    annualInflationRate: Math.max(finiteOrZero(inputs.annualInflationRate), -0.99),
    annualIncomeGrowthRate: Math.max(finiteOrZero(inputs.annualIncomeGrowthRate), -0.99),
    targetWithdrawalRate: Math.max(finiteOrZero(inputs.targetWithdrawalRate), MIN_WITHDRAWAL_RATE),
    birthYear: normalizeBirthYear(inputs.birthYear, currentYear),
    lifeExpectancy: Math.max(finiteOrZero(inputs.lifeExpectancy), 0),
    nationalPensionMonthlyAmount: Math.max(finiteOrZero(inputs.nationalPensionMonthlyAmount), 0),
  };
}

function calculateProjectionForMonth(
  inputs: FireInputs,
  month: number,
  achievedMonth: number | null,
  previousProjection?: FireProjection,
): FireProjection {
  if (month > 0 && !previousProjection) {
    throw new Error(`Missing previous projection for month ${month}.`);
  }

  const monthlyReturnRate = annualRateToMonthlyRate(inputs.annualNominalReturnRate);
  const monthlyExpenses = calculateMonthlyExpenses(inputs, month);
  const retirementMonthlyExpenses = calculateMonthlyRetirementExpenses(inputs, month);
  const fireTargetAssets = (retirementMonthlyExpenses * 12) / inputs.targetWithdrawalRate;
  const phase =
    achievedMonth !== null && month > achievedMonth
      ? "retired"
      : month === 0 && inputs.investableAssets >= fireTargetAssets
        ? "retired"
        : "working";
  const monthlyIncome = phase === "working" ? calculateMonthlyIncome(inputs, month) : 0;
  const monthlySavings = monthlyIncome - monthlyExpenses;
  const cashFlow = phase === "working" ? monthlySavings : -retirementMonthlyExpenses;
  const investableAssets =
    month === 0
      ? inputs.investableAssets
      : previousProjection!.investableAssets * (1 + monthlyReturnRate) + cashFlow;

  return {
    month,
    year: month / 12,
    age: calculateCurrentAgeFromBirthYear(inputs.birthYear) + month / 12,
    phase,
    cashFlow,
    monthlyIncome,
    monthlySavings,
    monthlyExpenses,
    retirementMonthlyExpenses,
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
): {
  finalAssets: number;
  minimumAssets: number;
  peakAssets: number;
  retirementFirstMonthExpenses: number;
  projections: DepletionProjection[];
} {
  const monthlyReturnRate = annualRateToMonthlyRate(inputs.annualNominalReturnRate);
  let assets = inputs.investableAssets;
  let minimumAssets = assets;
  let peakAssets = assets;
  let retirementFirstMonthExpenses: number | null = null;
  const initialPhase = monthsToWork > 0 ? "working" : "retired";
  const initialMonthlyIncome = calculateMonthlyIncome(inputs, 0);
  const initialNationalPensionIncome = calculateMonthlyNationalPension(inputs, 0);
  const initialMonthlyExpenses =
    initialPhase === "working"
      ? calculateMonthlyExpenses(inputs, 0)
      : calculateMonthlyRetirementExpenses(inputs, 0);
  const initialCashFlow =
    (initialPhase === "working" ? initialMonthlyIncome : 0) +
    initialNationalPensionIncome -
    initialMonthlyExpenses;
  const projections: DepletionProjection[] = [
    {
      month: 0,
      age: calculateCurrentAgeFromBirthYear(inputs.birthYear),
      phase: initialPhase,
      cashFlow: initialCashFlow,
      monthlyIncome: initialMonthlyIncome,
      nationalPensionIncome: initialNationalPensionIncome,
      monthlyExpenses: initialMonthlyExpenses,
      assets,
    },
  ];

  for (let month = 1; month <= totalMonths; month += 1) {
    const isWorking = month <= monthsToWork;
    const monthlyIncome = calculateMonthlyIncome(inputs, month);
    const monthlyExpenses = isWorking
      ? calculateMonthlyExpenses(inputs, month)
      : calculateMonthlyRetirementExpenses(inputs, month);
    const nationalPensionIncome = calculateMonthlyNationalPension(inputs, month);
    const cashFlow =
      (isWorking ? monthlyIncome : 0) + nationalPensionIncome - monthlyExpenses;
    assets = assets * (1 + monthlyReturnRate) + cashFlow;
    minimumAssets = Math.min(minimumAssets, assets);

    if (month <= monthsToWork) {
      peakAssets = Math.max(peakAssets, assets);
    }

    if (!isWorking && retirementFirstMonthExpenses === null) {
      retirementFirstMonthExpenses = monthlyExpenses;
    }

    projections.push({
      month,
      age: calculateCurrentAgeFromBirthYear(inputs.birthYear) + month / 12,
      phase: isWorking ? "working" : "retired",
      cashFlow,
      monthlyIncome,
      nationalPensionIncome,
      monthlyExpenses,
      assets,
    });
  }

  return {
    finalAssets: assets,
    minimumAssets,
    peakAssets,
    retirementFirstMonthExpenses:
      retirementFirstMonthExpenses ?? calculateMonthlyRetirementExpenses(inputs, monthsToWork + 1),
    projections,
  };
}

function isSolventThroughLifeExpectancy(simulation: {
  finalAssets: number;
  minimumAssets: number;
}): boolean {
  return simulation.finalAssets >= 0 && simulation.minimumAssets >= 0;
}

function annualRateToMonthlyRate(annualRate: number): number {
  return Math.max(1 + annualRate, Number.EPSILON) ** (1 / 12) - 1;
}

function calculateMonthlyIncome(inputs: FireInputs, month: number): number {
  return applyAnnualGrowth(
    inputs.monthlyIncome,
    inputs.annualIncomeGrowthRate,
    Math.floor(month / 12),
  );
}

function calculateMonthlyExpenses(inputs: FireInputs, month: number): number {
  return applyAnnualGrowth(
    inputs.monthlyExpenses,
    inputs.annualInflationRate,
    Math.floor(month / 12),
  );
}

function calculateMonthlyRetirementExpenses(inputs: FireInputs, month: number): number {
  return applyAnnualGrowth(
    inputs.retirementMonthlyExpenses,
    inputs.annualInflationRate,
    Math.floor(month / 12),
  );
}

function calculateMonthlyNationalPension(inputs: FireInputs, month: number): number {
  const age = calculateCurrentAgeFromBirthYear(inputs.birthYear) + month / 12;

  if (age < calculateNationalPensionStartAge(inputs.birthYear)) {
    return 0;
  }

  return applyAnnualGrowth(
    inputs.nationalPensionMonthlyAmount,
    inputs.annualInflationRate,
    Math.floor(month / 12),
  );
}

function applyAnnualGrowth(value: number, annualGrowthRate: number, elapsedYears: number): number {
  return value * Math.max(1 + annualGrowthRate, Number.EPSILON) ** elapsedYears;
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function normalizeBirthYear(birthYear: number | undefined, currentYear = getCurrentYear()): number {
  return Number.isFinite(birthYear) && Number(birthYear) > 0 ? Number(birthYear) : currentYear;
}

function finiteOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundForPercentInput(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
