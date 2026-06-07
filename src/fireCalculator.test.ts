import { describe, expect, it } from "vitest";
import {
  FIRE_PRESETS,
  MAX_FIRE_SCENARIO_MONTHS,
  MIN_ANNUAL_NOMINAL_RETURN_RATE,
  MIN_WITHDRAWAL_RATE,
  calculateCurrentAgeFromBirthYear,
  calculateFireScenario,
  calculateFireScenarios,
  calculateNationalPensionStartAge,
  calculatePresentValue,
  calculateYearsToWork,
  percentInputToRate,
  rateToPercentInput,
  type FireInputs,
} from "./fireCalculator";

const currentYear = new Date().getFullYear();
const birthYearForAge = (age: number) => currentYear - age;

const baseInputs: FireInputs = {
  investableAssets: 100_000_000,
  monthlyIncome: 7_000_000,
  monthlyExpenses: 3_000_000,
  retirementMonthlyExpenses: 3_000_000,
  annualNominalReturnRate: 0.07,
  annualInflationRate: 0.025,
  annualIncomeGrowthRate: 0.035,
  targetWithdrawalRate: 0.04,
  currentAge: 40,
  childIndependenceAge: 0,
  childMonthlyExpenseReduction: 0,
  birthYear: birthYearForAge(40),
  lifeExpectancy: 90,
  nationalPensionMonthlyAmount: 0,
};

describe("calculateFireScenario", () => {
  it("투자 가능 자산이 이미 FIRE 목표 이상이면 현재 시점 도달로 판정한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 1_000_000_000,
      monthlyExpenses: 3_000_000,
      targetWithdrawalRate: 0.04,
    });

    expect(result.status).toBe("achieved");
    expect(result.monthsToFire).toBe(0);
    expect(result.projections).toHaveLength(MAX_FIRE_SCENARIO_MONTHS + 1);
    expect(result.projections[0]).toMatchObject({
      phase: "retired",
      cashFlow: -3_000_000,
    });
    expect(result.projections[1]).toMatchObject({
      phase: "retired",
    });
  });

  it("현재 FIRE 목표 자산은 은퇴 후 월 지출의 12개월치를 목표 인출률로 나누어 계산한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      retirementMonthlyExpenses: 4_000_000,
      targetWithdrawalRate: 0.04,
    });

    expect(result.currentFireTargetAssets).toBe(1_200_000_000);
  });

  it("은퇴 후 월 지출이 달라도 월 저축액은 현재 월 소비액 기준으로 계산한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 1_000,
      monthlyExpenses: 400,
      retirementMonthlyExpenses: 700,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 0.1,
    });

    expect(result.projections[0]).toMatchObject({
      monthlySavings: 600,
      monthlyExpenses: 400,
      retirementMonthlyExpenses: 700,
      fireTargetAssets: 84_000,
    });
  });

  it("1개월 뒤 투자 가능 자산에는 월 복리와 월 수입에서 소비를 뺀 저축액을 반영한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 100,
      monthlyIncome: 1_010,
      monthlyExpenses: 1_000,
      annualNominalReturnRate: 0.12682503013196977,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 0.01,
    });

    expect(result.projections[1].investableAssets).toBeCloseTo(111);
    expect(result.projections[1].monthlySavings).toBe(10);
  });

  it("12개월마다 월 수입과 월 소비액에 각각 수입 증가율과 물가 상승률을 반영한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 100,
      monthlyExpenses: 40,
      annualNominalReturnRate: 0,
      annualInflationRate: 0.25,
      annualIncomeGrowthRate: 0.5,
      targetWithdrawalRate: 0.0001,
    });

    expect(result.projections[11]).toMatchObject({
      monthlyIncome: 100,
      monthlyExpenses: 40,
      monthlySavings: 60,
    });
    expect(result.projections[12]).toMatchObject({
      monthlyIncome: 150,
      monthlyExpenses: 50,
      monthlySavings: 100,
    });
  });

  it("자녀 독립 전에는 기존 소비를 유지하고 독립 시점부터 현재 소비와 은퇴 후 지출을 함께 줄인다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 200,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 200,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 0.0001,
      currentAge: 40,
      childIndependenceAge: 41,
      childMonthlyExpenseReduction: 20,
    });

    expect(result.projections[11]).toMatchObject({
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 200,
      monthlySavings: 100,
    });
    expect(result.projections[12]).toMatchObject({
      monthlyExpenses: 80,
      retirementMonthlyExpenses: 180,
      monthlySavings: 120,
    });
  });

  it("자녀 독립 소비 감소액도 물가 상승률을 반영한 명목 금액으로 차감한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 200,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 200,
      annualNominalReturnRate: 0,
      annualInflationRate: 0.25,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 0.0001,
      currentAge: 40,
      childIndependenceAge: 41,
      childMonthlyExpenseReduction: 20,
    });

    expect(result.projections[12]).toMatchObject({
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 225,
      monthlySavings: 100,
    });
  });

  it("자녀 독립 나이가 0이면 소비 감소를 반영하지 않는다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 200,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 200,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 0.0001,
      currentAge: 40,
      childIndependenceAge: 0,
      childMonthlyExpenseReduction: 20,
    });

    expect(result.projections[12]).toMatchObject({
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 200,
      monthlySavings: 100,
    });
  });

  it("자녀 독립 소비 감소액이 지출보다 커도 월 지출은 0 미만으로 내려가지 않는다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 200,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 50,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 0.0001,
      currentAge: 42,
      childIndependenceAge: 40,
      childMonthlyExpenseReduction: 200,
    });

    expect(result.projections[0]).toMatchObject({
      monthlyExpenses: 0,
      retirementMonthlyExpenses: 0,
      monthlySavings: 0,
      fireTargetAssets: 0,
    });
  });

  it("은퇴 후 첫 달의 예상 생활비는 은퇴 다음 달 물가 상승률까지 반영한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 210,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 1,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 1,
    });

    expect(result.monthsToFire).toBe(11);
    expect(result.retirementMonthlyExpenses).toBe(100);
    expect(result.retirementFirstMonthExpenses).toBe(200);
  });

  it("목표 인출률은 입력값을 그대로 적용한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      targetWithdrawalRate: 0.035,
    });

    expect(result.projections[0].targetWithdrawalRate).toBe(0.035);
  });

  it("50년 안에 도달하지 못하면 도달 어려움 상태를 반환한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 0,
      monthlyExpenses: 6_000_000,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 0.03,
    });

    expect(result.status).toBe("not-achieved");
    expect(result.monthsToFire).toBeNull();
  });

  it("수익률이 물가 상승률보다 낮아도 명목 기준으로 안정적으로 도달 실패를 반환한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 100,
      monthlyExpenses: 100,
      annualNominalReturnRate: 0.01,
      annualInflationRate: 0.1,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 0.04,
    });

    expect(result.status).toBe("not-achieved");
    expect(result.monthsToFire).toBeNull();
    expect(result.projections).toHaveLength(MAX_FIRE_SCENARIO_MONTHS + 1);
    expect(result.projections.at(-1)?.fireTargetAssets).toBeGreaterThan(
      result.currentFireTargetAssets,
    );
    expect(Number.isFinite(result.projections.at(-1)?.investableAssets)).toBe(true);
  });

  it("목표 달성 후에는 근로소득과 국민연금 없이 은퇴 후 월 지출을 차감한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 200,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 0.025,
      nationalPensionMonthlyAmount: 10_000,
    });

    expect(result.status).toBe("achieved");
    expect(result.monthsToFire).toBe(480);
    expect(result.projections).toHaveLength(MAX_FIRE_SCENARIO_MONTHS + 1);
    expect(result.projections[480]).toMatchObject({
      phase: "working",
      cashFlow: 100,
      investableAssets: 48_000,
    });
    expect(result.projections[481]).toMatchObject({
      phase: "retired",
      monthlyIncome: 0,
      cashFlow: -100,
      investableAssets: 47_900,
    });
    expect(result.projections.at(-1)?.month).toBe(MAX_FIRE_SCENARIO_MONTHS);
  });

  it("월 소비액이 월 수입보다 크면 음수 저축액으로 자산 감소를 반영한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 1_000,
      monthlyIncome: 50,
      monthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      targetWithdrawalRate: 0.0001,
    });

    expect(result.projections[1]).toMatchObject({
      monthlySavings: -50,
      investableAssets: 950,
    });
  });

  it("금액과 출생연도, 국민연금의 잘못된 입력은 안전한 범위로 보정한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: -100,
      monthlyIncome: -200,
      monthlyExpenses: -300,
      retirementMonthlyExpenses: -400,
      birthYear: -40,
      currentAge: -1,
      childIndependenceAge: -2,
      childMonthlyExpenseReduction: -3,
      lifeExpectancy: -90,
      nationalPensionMonthlyAmount: -100,
    });

    expect(result.inputs).toMatchObject({
      investableAssets: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      retirementMonthlyExpenses: 0,
      birthYear: currentYear,
      currentAge: 0,
      childIndependenceAge: 0,
      childMonthlyExpenseReduction: 0,
      lifeExpectancy: 0,
      nationalPensionMonthlyAmount: 0,
    });
    expect(result.projections[0]).toMatchObject({
      age: 0,
      fireTargetAssets: 0,
    });
  });

  it("계산 불가능한 숫자와 하한보다 낮은 비율 입력을 안전한 기본 범위로 보정한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: Number.NaN,
      monthlyIncome: Number.POSITIVE_INFINITY,
      monthlyExpenses: Number.NEGATIVE_INFINITY,
      retirementMonthlyExpenses: Number.NEGATIVE_INFINITY,
      annualNominalReturnRate: -10,
      annualInflationRate: -2,
      annualIncomeGrowthRate: -3,
      targetWithdrawalRate: 0,
      birthYear: Number.NaN,
      currentAge: Number.NaN,
      childIndependenceAge: Number.POSITIVE_INFINITY,
      childMonthlyExpenseReduction: Number.NEGATIVE_INFINITY,
      lifeExpectancy: Number.POSITIVE_INFINITY,
      nationalPensionMonthlyAmount: Number.NEGATIVE_INFINITY,
    });

    expect(result.inputs).toMatchObject({
      investableAssets: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      retirementMonthlyExpenses: 0,
      annualNominalReturnRate: MIN_ANNUAL_NOMINAL_RETURN_RATE,
      annualInflationRate: -0.99,
      annualIncomeGrowthRate: -0.99,
      targetWithdrawalRate: MIN_WITHDRAWAL_RATE,
      birthYear: currentYear,
      currentAge: 0,
      childIndependenceAge: 0,
      childMonthlyExpenseReduction: 0,
      lifeExpectancy: 0,
      nationalPensionMonthlyAmount: 0,
    });
  });

  it("현재 가치 환산 표시가 필요한 미래 목표 금액도 도달 판정은 명목 값으로 유지한다", () => {
    const exampleInputs = FIRE_PRESETS.find((preset) => preset.id === "fire-example")!.values;
    const result = calculateFireScenario(exampleInputs);

    expect(result.status).toBe("achieved");
    expect(result.monthsToFire).not.toBeNull();
    expect(result.monthsToFire).toBeGreaterThanOrEqual(12);
    expect(
      calculatePresentValue(
        result.retirementFireTargetAssets!,
        result.inputs.annualInflationRate,
        result.monthsToFire!,
      ),
    ).toBeLessThan(result.retirementFireTargetAssets!);
  });
});

describe("calculateFireScenarios", () => {
  it("보수적 시나리오의 수익률은 입력값보다 2%p 낮다", () => {
    const [conservativeScenario] = calculateFireScenarios({
      ...baseInputs,
      annualNominalReturnRate: 0.07,
    });

    expect(conservativeScenario.inputs.annualNominalReturnRate).toBeCloseTo(0.05);
  });

  it("낙관적 시나리오의 수익률은 입력값보다 2%p 높다", () => {
    const optimisticScenario = calculateFireScenarios({
      ...baseInputs,
      annualNominalReturnRate: 0.07,
    })[2];

    expect(optimisticScenario.inputs.annualNominalReturnRate).toBeCloseTo(0.09);
  });
});

describe("calculateYearsToWork", () => {
  it("현재 자산만으로 기대수명까지 버틸 수 있으면 0개월을 반환한다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 1_000_000_000,
      monthlyExpenses: 1_000_000,
      retirementMonthlyExpenses: 1_000_000,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      birthYear: birthYearForAge(40),
      lifeExpectancy: 50,
    });

    expect(result.status).toBe("already-sufficient");
    expect(result.monthsToWork).toBe(0);
    expect(result.retirementAge).toBe(40);
    expect(result.projections[0]).toMatchObject({
      month: 0,
      phase: "retired",
      cashFlow: -1_000_000,
      assets: 1_000_000_000,
    });
  });

  it("수익률 0%에서는 단순 저축과 소비 흐름으로 필요한 근로 개월 수를 찾는다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 200,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      birthYear: birthYearForAge(40),
      lifeExpectancy: 41,
    });

    expect(result.status).toBe("achievable");
    expect(result.monthsToWork).toBe(6);
    expect(result.retirementAge).toBe(40.5);
    expect(result.peakAssets).toBe(600);
    expect(result.finalAssets).toBe(0);
    expect(result.retirementFirstMonthExpenses).toBe(100);
    expect(result.projections).toHaveLength(13);
    expect(result.projections[0]).toMatchObject({
      month: 0,
      phase: "working",
      cashFlow: 100,
      assets: 0,
    });
    expect(result.projections[6]).toMatchObject({
      month: 6,
      phase: "working",
      cashFlow: 100,
      assets: 600,
    });
    expect(result.projections[7]).toMatchObject({
      month: 7,
      phase: "retired",
      cashFlow: -100,
      monthlyExpenses: 100,
      assets: 500,
    });
  });

  it("은퇴 전에는 현재 월 소비액을 쓰고 은퇴 후에는 은퇴 후 월 지출로 전환한다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 200,
      monthlyExpenses: 50,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      birthYear: birthYearForAge(40),
      lifeExpectancy: 41,
    });

    expect(result.status).toBe("achievable");
    expect(result.monthsToWork).toBe(5);
    expect(result.retirementFirstMonthExpenses).toBe(100);
    expect(result.projections[5]).toMatchObject({
      phase: "working",
      cashFlow: 150,
      monthlyExpenses: 50,
      assets: 750,
    });
    expect(result.projections[6]).toMatchObject({
      phase: "retired",
      cashFlow: -100,
      monthlyExpenses: 100,
      assets: 650,
    });
  });

  it("기대수명 소진 모드도 자녀 독립 이후 줄어든 소비를 반영해 근로 기간을 계산한다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 200,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      currentAge: 40,
      childIndependenceAge: 40,
      childMonthlyExpenseReduction: 50,
      birthYear: birthYearForAge(40),
      lifeExpectancy: 41,
    });

    expect(result.status).toBe("achievable");
    expect(result.monthsToWork).toBe(3);
    expect(result.retirementFirstMonthExpenses).toBe(50);
    expect(result.projections[0]).toMatchObject({
      phase: "working",
      cashFlow: 150,
      monthlyExpenses: 50,
      assets: 0,
    });
    expect(result.projections[4]).toMatchObject({
      phase: "retired",
      cashFlow: -50,
      monthlyExpenses: 50,
      assets: 400,
    });
  });

  it("은퇴 후 소비액은 12개월마다 물가 상승률을 반영한다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 5_000,
      monthlyIncome: 100,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0.25,
      annualIncomeGrowthRate: 0,
      birthYear: birthYearForAge(40),
      lifeExpectancy: 42,
    });

    expect(result.status).toBe("already-sufficient");
    expect(result.retirementFirstMonthExpenses).toBe(100);
    expect(result.projections[11]).toMatchObject({
      phase: "retired",
      cashFlow: -100,
      monthlyExpenses: 100,
    });
    expect(result.projections[12]).toMatchObject({
      phase: "retired",
      cashFlow: -125,
      monthlyExpenses: 125,
    });
  });

  it("국민연금은 수령 시작 나이부터 현금흐름에 더한다", () => {
    const birthYear = baseInputs.birthYear;
    const currentAge = calculateCurrentAgeFromBirthYear(birthYear);
    const pensionStartAge = calculateNationalPensionStartAge(birthYear);
    const pensionStartMonth = Math.floor((pensionStartAge - currentAge) * 12);
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 200,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      lifeExpectancy: pensionStartAge + 1,
      nationalPensionMonthlyAmount: 100,
    });

    expect(result.status).toBe("achievable");
    expect(result.monthsToWork).toBe(Math.ceil((pensionStartMonth - 1) / 2));
    expect(result.nationalPensionStartAge).toBe(pensionStartAge);
    expect(result.projections[pensionStartMonth - 1]).toMatchObject({
      nationalPensionIncome: 0,
    });
    expect(result.projections[pensionStartMonth]).toMatchObject({
      nationalPensionIncome: 100,
    });
  });

  it("국민연금으로 나중에 회복되더라도 중간에 자산이 마이너스가 되면 은퇴 가능으로 보지 않는다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 100,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      birthYear: 1968,
      lifeExpectancy: calculateNationalPensionStartAge(1968) + 1,
      nationalPensionMonthlyAmount: 1_000,
    });

    expect(result.status).toBe("achievable");
    expect(result.monthsToWork).toBe(
      (calculateNationalPensionStartAge(1968) - calculateCurrentAgeFromBirthYear(1968)) * 12 - 1,
    );
    expect(Math.min(...result.projections.map((row) => row.assets))).toBeGreaterThanOrEqual(0);
  });

  it("국민연금 현재 기준 금액은 물가상승률에 따라 명목 금액으로 환산한다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 10_000,
      monthlyIncome: 0,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0.25,
      annualIncomeGrowthRate: 0,
      birthYear: 1952,
      lifeExpectancy: calculateCurrentAgeFromBirthYear(1952) + 2,
      nationalPensionMonthlyAmount: 100,
    });

    expect(result.status).toBe("already-sufficient");
    expect(result.projections[1]).toMatchObject({
      nationalPensionIncome: 100,
      cashFlow: 0,
    });
    expect(result.projections[12]).toMatchObject({
      nationalPensionIncome: 125,
      cashFlow: 0,
    });
  });

  it("기대수명이 현재 나이 이하이면 계산 불가 상태를 반환한다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      birthYear: birthYearForAge(90),
      lifeExpectancy: 90,
    });

    expect(result.status).toBe("invalid-time-horizon");
    expect(result.monthsToWork).toBeNull();
    expect(result.projections).toEqual([]);
  });

  it("기대수명까지 계속 일해도 자산이 부족하면 도달 어려움 상태를 반환한다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 0,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      birthYear: birthYearForAge(40),
      lifeExpectancy: 41,
    });

    expect(result.status).toBe("not-achievable");
    expect(result.monthsToWork).toBeNull();
    expect(result.projections.at(-1)?.phase).toBe("working");
  });

  it("월 소비액이 월 수입보다 크면 계속 일해도 부족한 시나리오를 도달 어려움으로 반환한다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 80,
      monthlyExpenses: 100,
      retirementMonthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      birthYear: birthYearForAge(40),
      lifeExpectancy: 41,
    });

    expect(result.status).toBe("not-achievable");
    expect(result.monthsToWork).toBeNull();
    expect(result.projections[1]).toMatchObject({
      phase: "working",
      cashFlow: -20,
      assets: -20,
    });
  });

  it("현재 가치 환산 표시가 필요한 미래 최고점 자산도 최소 근로 기간 판정은 명목 값으로 유지한다", () => {
    const exampleInputs = FIRE_PRESETS.find((preset) => preset.id === "fire-example")!.values;
    const result = calculateYearsToWork(exampleInputs);

    expect(result.status).toBe("achievable");
    expect(result.monthsToWork).not.toBeNull();
    expect(result.monthsToWork).toBeGreaterThanOrEqual(12);
    expect(
      calculatePresentValue(
        result.peakAssets!,
        exampleInputs.annualInflationRate,
        result.monthsToWork!,
      ),
    ).toBeLessThan(result.peakAssets!);
  });
});

describe("FIRE_PRESETS", () => {
  it("대한민국 평균 가구의 월 수입은 천 원 단위로 절삭한다", () => {
    const koreaAveragePreset = FIRE_PRESETS.find((preset) => preset.id === "korea-average");

    expect(koreaAveragePreset?.values.monthlyIncome).toBe(6_189_000);
  });

  it("대한민국 평균 가구의 국민연금 예상 월 수령액은 노령연금 평균 전망을 천 원 단위로 반영한다", () => {
    const koreaAveragePreset = FIRE_PRESETS.find((preset) => preset.id === "korea-average");

    expect(koreaAveragePreset?.values.nationalPensionMonthlyAmount).toBe(724_000);
  });

  it("기본 예시값은 과거 연 단위 기본값을 월 단위로 환산하고 5% 수익률을 사용한다", () => {
    const examplePreset = FIRE_PRESETS.find((preset) => preset.id === "fire-example");

    expect(examplePreset?.values.investableAssets).toBe(350_000_000);
    expect(examplePreset?.values.monthlyIncome).toBe(120_000_000 / 12);
    expect(examplePreset?.values.monthlyExpenses).toBe(42_000_000 / 12);
    expect(examplePreset?.values.retirementMonthlyExpenses).toBe(42_000_000 / 12);
    expect(examplePreset?.values.annualNominalReturnRate).toBe(0.05);
    expect(examplePreset?.values.annualInflationRate).toBe(0.02);
    expect(examplePreset?.values.annualIncomeGrowthRate).toBe(0.03);
    expect(calculateCurrentAgeFromBirthYear(examplePreset!.values.birthYear)).toBe(40);
    expect(examplePreset?.values.lifeExpectancy).toBe(90);
    expect(examplePreset?.values.nationalPensionMonthlyAmount).toBe(0);
  });
});

describe("calculateNationalPensionStartAge", () => {
  it("출생연도별 국민연금 수령 시작 나이를 반환한다", () => {
    expect(calculateNationalPensionStartAge(1952)).toBe(60);
    expect(calculateNationalPensionStartAge(1953)).toBe(61);
    expect(calculateNationalPensionStartAge(1957)).toBe(62);
    expect(calculateNationalPensionStartAge(1961)).toBe(63);
    expect(calculateNationalPensionStartAge(1965)).toBe(64);
    expect(calculateNationalPensionStartAge(1969)).toBe(65);
  });
});

describe("percentInputToRate", () => {
  it("사용자가 입력한 퍼센트 숫자를 계산용 비율로 변환한다", () => {
    expect(percentInputToRate(5)).toBe(0.05);
    expect(percentInputToRate(2.5)).toBe(0.025);
  });
});

describe("rateToPercentInput", () => {
  it("계산용 비율을 입력 화면에 표시할 퍼센트 숫자로 깔끔하게 변환한다", () => {
    expect(rateToPercentInput(0.035)).toBe(3.5);
    expect(rateToPercentInput(0.025)).toBe(2.5);
  });
});

describe("calculatePresentValue", () => {
  it("현재 시점 금액은 원래 금액 그대로 반환한다", () => {
    expect(calculatePresentValue(1_000, 0.25, 0)).toBe(1_000);
  });

  it("12개월이 지나면 1년치 물가 상승률로 명목 금액을 나눈다", () => {
    expect(calculatePresentValue(1_250, 0.25, 12)).toBe(1_000);
  });

  it("12개월 전까지는 아직 첫해 현재 가치로 유지한다", () => {
    expect(calculatePresentValue(1_000, 0.25, 11)).toBe(1_000);
  });
});
