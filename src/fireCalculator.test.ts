import { describe, expect, it } from "vitest";
import {
  calculateFireScenario,
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
  targetWithdrawalRate: 0.04,
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

  it("현재 FIRE 목표 자산은 연 생활비를 목표 인출률로 나누어 계산한다", () => {
    const result = calculateFireScenario({
      ...baseInputs,
      annualExpenses: 40_000_000,
      targetWithdrawalRate: 0.04,
    });

    expect(result.currentFireTargetAssets).toBe(1_000_000_000);
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
