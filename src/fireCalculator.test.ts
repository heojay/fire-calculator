import { describe, expect, it } from "vitest";
import {
  FIRE_PRESETS,
  calculateFireScenario,
  calculateFireScenarios,
  calculateYearsToWork,
  percentInputToRate,
  rateToPercentInput,
  type FireInputs,
} from "./fireCalculator";

const baseInputs: FireInputs = {
  investableAssets: 100_000_000,
  monthlyIncome: 7_000_000,
  monthlyExpenses: 3_000_000,
  annualNominalReturnRate: 0.07,
  annualInflationRate: 0.025,
  annualIncomeGrowthRate: 0.035,
  targetWithdrawalRate: 0.04,
  currentAge: 40,
  lifeExpectancy: 90,
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
  });

  it("현재 FIRE 목표 자산은 월 소비액의 12개월치를 목표 인출률로 나누어 계산한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      monthlyExpenses: 4_000_000,
      targetWithdrawalRate: 0.04,
    });

    expect(result.currentFireTargetAssets).toBe(1_200_000_000);
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

  it("은퇴 후 첫 달의 예상 생활비는 은퇴 다음 달 물가 상승률까지 반영한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 210,
      monthlyExpenses: 100,
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

  it("100년 안에 도달하지 못하면 도달 어려움 상태를 반환한다", () => {
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
});

describe("calculateFireScenarios", () => {
  it("보수적 시나리오의 명목 수익률은 입력값보다 2%p 낮다", () => {
    const [conservativeScenario] = calculateFireScenarios({
      ...baseInputs,
      annualNominalReturnRate: 0.07,
    });

    expect(conservativeScenario.inputs.annualNominalReturnRate).toBeCloseTo(0.05);
  });

  it("낙관적 시나리오의 명목 수익률은 입력값보다 2%p 높다", () => {
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
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      currentAge: 40,
      lifeExpectancy: 50,
    });

    expect(result.status).toBe("already-sufficient");
    expect(result.monthsToWork).toBe(0);
    expect(result.retirementAge).toBe(40);
  });

  it("수익률 0%에서는 단순 저축과 소비 흐름으로 필요한 근로 개월 수를 찾는다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 0,
      monthlyIncome: 200,
      monthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      currentAge: 40,
      lifeExpectancy: 41,
    });

    expect(result.status).toBe("achievable");
    expect(result.monthsToWork).toBe(6);
    expect(result.retirementAge).toBe(40.5);
    expect(result.peakAssets).toBe(600);
    expect(result.finalAssets).toBe(0);
    expect(result.retirementFirstMonthExpenses).toBe(100);
    expect(result.projections).toHaveLength(13);
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

  it("은퇴 후 소비액은 12개월마다 물가 상승률을 반영한다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      investableAssets: 5_000,
      monthlyIncome: 100,
      monthlyExpenses: 100,
      annualNominalReturnRate: 0,
      annualInflationRate: 0.25,
      annualIncomeGrowthRate: 0,
      currentAge: 40,
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

  it("기대수명이 현재 나이 이하이면 계산 불가 상태를 반환한다", () => {
    const result = calculateYearsToWork({
      ...baseInputs,
      currentAge: 90,
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
      annualNominalReturnRate: 0,
      annualInflationRate: 0,
      annualIncomeGrowthRate: 0,
      currentAge: 40,
      lifeExpectancy: 41,
    });

    expect(result.status).toBe("not-achievable");
    expect(result.monthsToWork).toBeNull();
    expect(result.projections.at(-1)?.phase).toBe("working");
  });
});

describe("FIRE_PRESETS", () => {
  it("기본 예시값은 월 단위 수입, 소비와 7% 명목 수익률을 사용한다", () => {
    const examplePreset = FIRE_PRESETS.find((preset) => preset.id === "fire-example");

    expect(examplePreset?.values.investableAssets).toBe(360_000_000);
    expect(examplePreset?.values.monthlyIncome).toBe(10_000_000);
    expect(examplePreset?.values.monthlyExpenses).toBe(3_500_000);
    expect(examplePreset?.values.annualNominalReturnRate).toBe(0.07);
    expect(examplePreset?.values.annualInflationRate).toBe(0.025);
    expect(examplePreset?.values.annualIncomeGrowthRate).toBe(0.035);
    expect(examplePreset?.values.currentAge).toBe(31);
    expect(examplePreset?.values.lifeExpectancy).toBe(90);
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
