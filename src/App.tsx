import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  FIRE_PRESETS,
  calculateFireScenarios,
  percentInputToRate,
  rateToPercentInput,
  type FireInputs,
  type FireScenarioResult,
  type FireYearProjection,
} from "./fireCalculator";

type FormValues = {
  investableAssets: number;
  annualIncome: number;
  annualExpenses: number;
  annualReturnRate: number;
  incomeGrowthRate: number;
  inflationRate: number;
  targetWithdrawalRate: number;
  currentAge: number;
  totalAssets: number;
  debt: number;
  primaryResidenceValue: number;
  otherRealAssets: number;
  annualDebtPayment: number;
  debtPaymentEndYear: number;
  retirementAnnualIncome: number;
  pensionAnnualIncome: number;
  pensionStartAge: number;
};

const requiredFields = [
  ["investableAssets", "현재 투자 가능 자산", "원"],
  ["annualIncome", "연 수입", "원"],
  ["annualExpenses", "연 생활비", "원"],
  ["annualReturnRate", "연 투자 수익률", "%"],
  ["incomeGrowthRate", "연 수입 증가율", "%"],
  ["inflationRate", "인플레이션율", "%"],
  ["targetWithdrawalRate", "목표 인출률", "%"],
] as const;

const optionalFields = [
  ["currentAge", "현재 나이", "세"],
  ["totalAssets", "현재 총자산", "원"],
  ["debt", "현재 부채", "원"],
  ["primaryResidenceValue", "거주용 부동산 가치", "원"],
  ["otherRealAssets", "기타 실물자산", "원"],
  ["annualDebtPayment", "연 부채 상환액", "원"],
  ["debtPaymentEndYear", "부채 상환 종료 시점", "년 뒤"],
  ["retirementAnnualIncome", "은퇴 후 예상 연 수입", "원"],
  ["pensionAnnualIncome", "국민연금/퇴직연금 예상 연 수령액", "원"],
  ["pensionStartAge", "연금 수령 시작 나이", "세"],
] as const;

const scenarioClassNames = ["scenario-conservative", "scenario-base", "scenario-optimistic"];
const koreaAveragePreset = FIRE_PRESETS.find((preset) => preset.id === "korea-average")!;
const fireExamplePreset = FIRE_PRESETS.find((preset) => preset.id === "fire-example")!;

function App() {
  const [formValues, setFormValues] = useState<FormValues>(() =>
    presetToFormValues(fireExamplePreset.values),
  );

  const inputs = useMemo(() => formValuesToInputs(formValues), [formValues]);
  const scenarios = useMemo(() => calculateFireScenarios(inputs), [inputs]);
  const baseScenario = scenarios[1];

  const handleFieldChange = (field: keyof FormValues, value: string) => {
    setFormValues((current) => ({
      ...current,
      [field]: Number(value),
    }));
  };

  return (
    <main>
      <header className="hero-band">
        <nav className="top-nav" aria-label="상단">
          <div className="brand">FIRE 계산기</div>
        </nav>

        <section className="hero-grid">
          <div>
            <p className="eyebrow">INVESTABLE ASSETS FIRST</p>
            <h1>총자산이 아니라 투자 가능 자산으로 계산합니다.</h1>
            <p className="lead">
              거주용 부동산은 기본적으로 인출 가능 자산에서 제외하고, 연도별 현금흐름과
              목표 인출률을 기준으로 경제적 자유 도달 시점을 시뮬레이션합니다.
            </p>
          </div>
          <ResultHero scenario={baseScenario} />
        </section>
      </header>

      <section className="content-grid" aria-label="계산 입력과 결과">
        <section className="input-panel">
          <div className="section-heading">
            <p className="eyebrow">INPUTS</p>
            <h2>입력값</h2>
          </div>

          <div className="input-actions">
            <button
              className="button-secondary"
              type="button"
              onClick={() => setFormValues(presetToFormValues(koreaAveragePreset.values))}
            >
              대한민국 평균 가구 값 입력해보기
            </button>
          </div>

          <Fieldset title="필수 입력">
            {requiredFields.map(([field, label, suffix]) => (
              <NumberField
                key={field}
                label={label}
                suffix={suffix}
                value={formValues[field]}
                onChange={(value) => handleFieldChange(field, value)}
              />
            ))}
          </Fieldset>

          <Fieldset title="선택 입력">
            {optionalFields.map(([field, label, suffix]) => (
              <NumberField
                key={field}
                label={label}
                suffix={suffix}
                value={formValues[field]}
                onChange={(value) => handleFieldChange(field, value)}
              />
            ))}
          </Fieldset>
        </section>

        <section className="results-panel">
          <div className="section-heading">
            <p className="eyebrow">RESULTS</p>
            <h2>계산 결과</h2>
          </div>

          <SummaryGrid scenario={baseScenario} />
          <ScenarioGrid scenarios={scenarios} />
          <AssetChart scenario={baseScenario} />
        </section>
      </section>

      <section className="tables-band">
        <div className="section-heading">
          <p className="eyebrow">YEARLY PROJECTION</p>
          <h2>연도별 추이</h2>
        </div>
        <div className="table-grid">
          <ProjectionTable
            title="연도별 투자 가능 자산 추이"
            rows={baseScenario.projections}
            valueKey="investableAssets"
          />
          <ProjectionTable
            title="연도별 FIRE 목표 자산 추이"
            rows={baseScenario.projections}
            valueKey="fireTargetAssets"
          />
        </div>
      </section>
    </main>
  );
}

function ResultHero({ scenario }: { scenario: FireScenarioResult }) {
  return (
    <aside className="hero-card">
      <p className="card-label">경제적 자유 도달 시점</p>
      <strong>{scenario.status === "achieved" ? `${scenario.yearsToFire}년 뒤` : "도달 어려움"}</strong>
      <span>
        {scenario.status === "achieved" && scenario.retirementAge !== undefined
          ? `예상 은퇴 가능 나이 ${scenario.retirementAge}세`
          : "100년 안에 목표 자산에 도달하지 못합니다."}
      </span>
    </aside>
  );
}

function SummaryGrid({ scenario }: { scenario: FireScenarioResult }) {
  const items = [
    ["현재 기준 FIRE 목표 자산", formatMoney(scenario.currentFireTargetAssets)],
    [
      "인플레이션 반영 은퇴 시점의 FIRE 목표 자산",
      scenario.retirementFireTargetAssets === null
        ? "도달 어려움"
        : formatMoney(scenario.retirementFireTargetAssets),
    ],
    ["앞으로 더 일해야 하는 기간", scenario.yearsToFire === null ? "도달 어려움" : `${scenario.yearsToFire}년`],
    [
      "예상 은퇴 가능 나이",
      scenario.retirementAge === undefined ? "입력 없음" : `${scenario.retirementAge}세`,
    ],
    [
      "은퇴 시 예상 투자 가능 자산",
      scenario.retirementInvestableAssets === null
        ? "도달 어려움"
        : formatMoney(scenario.retirementInvestableAssets),
    ],
    [
      "은퇴 시 예상 연 생활비",
      scenario.retirementAnnualExpenses === null
        ? "도달 어려움"
        : formatMoney(scenario.retirementAnnualExpenses),
    ],
    [
      "은퇴 후 안전 인출 가능 금액",
      scenario.retirementSafeWithdrawalAmount === null
        ? "도달 어려움"
        : `${formatMoney(scenario.retirementSafeWithdrawalAmount)} / 년`,
    ],
  ];

  return (
    <div className="summary-grid">
      {items.map(([label, value]) => (
        <article className="metric-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function ScenarioGrid({ scenarios }: { scenarios: FireScenarioResult[] }) {
  return (
    <div className="scenario-grid">
      {scenarios.map((scenario, index) => (
        <article className={`scenario-card ${scenarioClassNames[index]}`} key={scenario.name}>
          <span>{scenario.description}</span>
          <h3>{scenario.name} 시나리오</h3>
          <strong>
            {scenario.status === "achieved" ? `${scenario.yearsToFire}년 뒤` : "도달 어려움"}
          </strong>
          <p>
            {scenario.retirementInvestableAssets === null
              ? "100년 제한 안에서 FIRE 목표 자산에 도달하지 못합니다."
              : `은퇴 시 투자 가능 자산 ${formatMoney(scenario.retirementInvestableAssets)}`}
          </p>
        </article>
      ))}
    </div>
  );
}

function AssetChart({ scenario }: { scenario: FireScenarioResult }) {
  const rows = scenario.projections;
  const width = 760;
  const height = 280;
  const padding = 28;
  const maxValue = Math.max(
    ...rows.flatMap((row) => [row.investableAssets, row.fireTargetAssets]),
    1,
  );
  const maxYear = Math.max(rows[rows.length - 1]?.year ?? 1, 1);

  const toPoint = (row: FireYearProjection, value: number) => {
    const x = padding + (row.year / maxYear) * (width - padding * 2);
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return `${x},${y}`;
  };

  const assetPoints = rows.map((row) => toPoint(row, row.investableAssets)).join(" ");
  const targetPoints = rows.map((row) => toPoint(row, row.fireTargetAssets)).join(" ");

  return (
    <article className="chart-card">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">CHART</p>
          <h3>연도별 자산 추이 그래프</h3>
        </div>
        <div className="legend">
          <span className="legend-asset">투자 가능 자산</span>
          <span className="legend-target">FIRE 목표 자산</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="연도별 자산 추이">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
        <polyline className="target-line" points={targetPoints} />
        <polyline className="asset-line" points={assetPoints} />
      </svg>
    </article>
  );
}

function ProjectionTable({
  title,
  rows,
  valueKey,
}: {
  title: string;
  rows: FireYearProjection[];
  valueKey: "investableAssets" | "fireTargetAssets";
}) {
  return (
    <article className="table-card">
      <h3>{title}</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>연도</th>
              <th>나이</th>
              <th>{valueKey === "investableAssets" ? "투자 가능 자산" : "FIRE 목표 자산"}</th>
              <th>연 생활비</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${valueKey}-${row.year}`}>
                <td>{row.year}년 뒤</td>
                <td>{row.age === undefined ? "-" : `${row.age}세`}</td>
                <td>{formatMoney(row[valueKey])}</td>
                <td>{formatMoney(row.annualExpenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function Fieldset({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="field-grid">{children}</div>
    </fieldset>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (value: string) => void;
}) {
  const moneyHint = suffix === "원" ? formatMoneyInputHint(value) : "";

  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          inputMode="decimal"
          value={Number.isNaN(value) ? "" : value}
          onChange={(event) => onChange(event.target.value)}
        />
        <em>{suffix}</em>
      </div>
      {moneyHint && <small>{moneyHint}</small>}
    </label>
  );
}

function presetToFormValues(values: FireInputs): FormValues {
  return {
    investableAssets: values.investableAssets,
    annualIncome: values.annualIncome,
    annualExpenses: values.annualExpenses,
    annualReturnRate: rateToPercentInput(values.annualReturnRate),
    incomeGrowthRate: rateToPercentInput(values.incomeGrowthRate),
    inflationRate: rateToPercentInput(values.inflationRate),
    targetWithdrawalRate: rateToPercentInput(values.targetWithdrawalRate),
    currentAge: values.currentAge ?? 0,
    totalAssets: values.totalAssets ?? 0,
    debt: values.debt ?? 0,
    primaryResidenceValue: values.primaryResidenceValue ?? 0,
    otherRealAssets: values.otherRealAssets ?? 0,
    annualDebtPayment: values.annualDebtPayment ?? 0,
    debtPaymentEndYear: values.debtPaymentEndYear ?? 0,
    retirementAnnualIncome: values.retirementAnnualIncome ?? 0,
    pensionAnnualIncome: values.pensionAnnualIncome ?? 0,
    pensionStartAge: values.pensionStartAge ?? 0,
  };
}

function formValuesToInputs(values: FormValues): FireInputs {
  return {
    ...values,
    currentAge: values.currentAge > 0 ? values.currentAge : undefined,
    annualReturnRate: percentInputToRate(values.annualReturnRate),
    incomeGrowthRate: percentInputToRate(values.incomeGrowthRate),
    inflationRate: percentInputToRate(values.inflationRate),
    targetWithdrawalRate: percentInputToRate(values.targetWithdrawalRate),
    pensionStartAge: values.pensionStartAge > 0 ? values.pensionStartAge : undefined,
  };
}

function formatMoney(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 100_000_000) {
    return `${sign}${formatCompact(absValue / 100_000_000)}억원`;
  }

  if (absValue >= 10_000) {
    return `${sign}${formatCompact(absValue / 10_000)}만원`;
  }

  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatMoneyInputHint(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (!Number.isFinite(value) || absValue < 10_000) {
    return "";
  }

  if (absValue >= 100_000_000) {
    return `약 ${sign}${formatCompact(absValue / 100_000_000)}억원`;
  }

  return `약 ${sign}${formatCompact(absValue / 10_000)}만원`;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: value >= 10 ? 1 : 2,
  }).format(value);
}

export default App;
