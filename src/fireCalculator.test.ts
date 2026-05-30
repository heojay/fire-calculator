import { describe, expect, it } from "vitest";
import {
  FIRE_PRESETS,
  calculateAutoWithdrawalRate,
  calculateFireScenario,
  calculateFireScenarios,
  percentInputToRate,
  rateToPercentInput,
  type FireInputs,
} from "./fireCalculator";

const baseInputs: FireInputs = {
  investableAssets: 100_000_000,
  annualIncome: 80_000_000,
  annualExpenses: 30_000_000,
  annualReturnRate: 0.04,
  incomeGrowthRate: 0.02,
  inflationRate: 0.02,
  withdrawalMode: "manual",
  targetWithdrawalRate: 0.04,
  currentAge: 40,
  lifeExpectancy: 90,
};

describe("calculateFireScenario", () => {
  it("투자 가능 자산이 이미 FIRE 목표 이상이면 현재 시점 도달로 판정한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 1_000_000_000,
      annualExpenses: 30_000_000,
      targetWithdrawalRate: 0.04,
    });

    expect(result.status).toBe("achieved");
    expect(result.yearsToFire).toBe(0);
  });

  it("저축액은 연 수입에서 연 생활비를 뺀 값으로 계산한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      annualIncome: 90_000_000,
      annualExpenses: 35_000_000,
    });

    expect(result.projections[0].savings).toBe(55_000_000);
  });

  it("1년 뒤 투자 가능 자산에는 당해 저축액의 중간 납입 복리를 반영한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 100,
      annualIncome: 50,
      annualExpenses: 10,
      annualReturnRate: 0.1,
      incomeGrowthRate: 0,
      inflationRate: 0,
      targetWithdrawalRate: 0.01,
    });

    expect(result.projections[1].investableAssets).toBeCloseTo(152);
  });

  it("현재 FIRE 목표 자산은 연 생활비를 목표 인출률로 나누어 계산한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      annualExpenses: 40_000_000,
      targetWithdrawalRate: 0.04,
    });

    expect(result.currentFireTargetAssets).toBe(1_000_000_000);
  });

  it("수동 모드는 입력한 목표 인출률을 그대로 적용한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      targetWithdrawalRate: 0.035,
    });

    expect(result.projections[0].targetWithdrawalRate).toBe(0.035);
  });

  it("자동 모드는 나이와 기대수명으로 목표 인출률을 계산한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      withdrawalMode: "auto",
      currentAge: 40,
      lifeExpectancy: 90,
      annualReturnRate: 0.05,
      inflationRate: 0.02,
    });

    expect(result.projections[0].targetWithdrawalRate).toBeGreaterThan(0.03);
    expect(result.projections[0].targetWithdrawalRate).toBeLessThan(0.05);
  });

  it("자동 모드는 연도가 지날수록 해당 연도의 나이를 반영한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      annualIncome: 0,
      annualExpenses: 60_000_000,
      withdrawalMode: "auto",
      currentAge: 40,
      lifeExpectancy: 90,
      annualReturnRate: 0.05,
      inflationRate: 0.02,
    });

    expect(result.projections[1].targetWithdrawalRate).toBeGreaterThan(
      result.projections[0].targetWithdrawalRate,
    );
  });

  it("100년 안에 도달하지 못하면 도달 어려움 상태를 반환한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      investableAssets: 0,
      annualIncome: 10_000_000,
      annualExpenses: 60_000_000,
      annualReturnRate: 0,
      incomeGrowthRate: 0,
      inflationRate: 0.03,
      targetWithdrawalRate: 0.03,
    });

    expect(result.status).toBe("not-achieved");
    expect(result.yearsToFire).toBeNull();
  });
});

describe("calculateAutoWithdrawalRate", () => {
  it("실질 수익률은 피셔 방정식으로 계산한다", () => {
    const rate = calculateAutoWithdrawalRate({
      ...baseInputs,
      withdrawalMode: "auto",
      currentAge: 40,
      lifeExpectancy: 90,
      annualReturnRate: 0.05,
      inflationRate: 0.02,
    });
    const realReturn = 1.05 / 1.02 - 1;
    const expectedRate = realReturn / (1 - (1 + realReturn) ** -50);

    expect(rate).toBeCloseTo(expectedRate);
  });

  it("기대수명이 현재 나이 이하더라도 최소 1년으로 계산한다", () => {
    const rate = calculateAutoWithdrawalRate({
      ...baseInputs,
      withdrawalMode: "auto",
      currentAge: 90,
      lifeExpectancy: 80,
    });

    expect(rate).toBe(0.1);
  });

  it("자동 인출률은 1%에서 10% 사이로 제한된다", () => {
    const lowRate = calculateAutoWithdrawalRate({
      ...baseInputs,
      withdrawalMode: "auto",
      currentAge: 20,
      lifeExpectancy: 200,
      annualReturnRate: 0,
      inflationRate: 0,
    });
    const highRate = calculateAutoWithdrawalRate({
      ...baseInputs,
      withdrawalMode: "auto",
      currentAge: 90,
      lifeExpectancy: 91,
      annualReturnRate: 0.2,
      inflationRate: 0,
    });

    expect(lowRate).toBe(0.01);
    expect(highRate).toBe(0.1);
  });
});

describe("calculateFireScenarios", () => {
  it("보수적 시나리오의 투자 수익률은 0% 아래로 내려가지 않는다", () => {
    const [conservativeScenario] = calculateFireScenarios({
      ...baseInputs,
      annualReturnRate: 0.01,
    });

    expect(conservativeScenario.inputs.annualReturnRate).toBe(0);
  });

  it("낙관적 시나리오의 인플레이션율은 0% 아래로 내려가지 않는다", () => {
    const optimisticScenario = calculateFireScenarios({
      ...baseInputs,
      inflationRate: 0.005,
    })[2];

    expect(optimisticScenario.inputs.inflationRate).toBe(0);
  });

  it("자동 인출률은 시나리오별 수익률과 물가 변동을 반영한다", () => {
    const scenarios = calculateFireScenarios({
      ...baseInputs,
      withdrawalMode: "auto",
    });

    const [conservativeScenario, baseScenario, optimisticScenario] = scenarios;

    expect(conservativeScenario.projections[0].targetWithdrawalRate).toBeLessThan(
      baseScenario.projections[0].targetWithdrawalRate,
    );
    expect(optimisticScenario.projections[0].targetWithdrawalRate).toBeGreaterThan(
      baseScenario.projections[0].targetWithdrawalRate,
    );
  });
});

describe("FIRE_PRESETS", () => {
  it("기본 장기 가정은 투자 5%, 수입 증가 3%, 인플레이션 2%를 사용한다", () => {
    FIRE_PRESETS.forEach((preset) => {
      expect(preset.values.annualReturnRate).toBe(0.05);
      expect(preset.values.incomeGrowthRate).toBe(0.03);
      expect(preset.values.inflationRate).toBe(0.02);
    });
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
