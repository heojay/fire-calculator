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
  withdrawalMode: "manual" | "auto";
  targetWithdrawalRate: number;
  currentAge: number;
  lifeExpectancy: number;
};

const requiredFields = [
  ["investableAssets", "현재 투자 가능 자산", "원"],
  ["annualIncome", "연 수입", "원"],
  ["annualExpenses", "연 생활비", "원"],
  ["annualReturnRate", "연 투자 수익률", "%"],
  ["incomeGrowthRate", "연 수입 증가율", "%"],
  ["inflationRate", "인플레이션율", "%"],
] as const;

const scenarioClassNames = ["scenario-conservative", "scenario-base", "scenario-optimistic"];
const koreaAveragePreset = FIRE_PRESETS.find((preset) => preset.id === "korea-average")!;
const fireExamplePreset = FIRE_PRESETS.find((preset) => preset.id === "fire-example")!;

function App() {
  const [formValues, setFormValues] = useState<FormValues>(() =>
    presetToFormValues(fireExamplePreset.values),
  );
  const [selectedScenarioName, setSelectedScenarioName] = useState("기본");

  const inputs = useMemo(() => formValuesToInputs(formValues), [formValues]);
  const scenarios = useMemo(() => calculateFireScenarios(inputs), [inputs]);
  const baseScenario = scenarios[1];
  const selectedScenario =
    scenarios.find((scenario) => scenario.name === selectedScenarioName) ?? baseScenario;

  const handleFieldChange = (field: keyof FormValues, value: string) => {
    setFormValues((current) => ({
      ...current,
      [field]: Number(value),
    }));
  };

  const handleWithdrawalModeChange = (enabled: boolean) => {
    setFormValues((current) => ({
      ...current,
      withdrawalMode: enabled ? "auto" : "manual",
    }));
  };

  return (
    <main>
      <header className="hero-band">
        <nav className="top-nav" aria-label="상단">
          <div className="brand">FIRE 계산기</div>
        </nav>

        <section className="hero-grid">
          <p className="eyebrow">FIRE CALCULATOR</p>
          <h1>경제적 자유까지 얼마나 걸릴까요?</h1>
          <p className="lead">
            투자 가능 자산, 수입, 생활비를 바탕으로 FIRE 도달 시점과 필요한 목표 자산을
            계산합니다.
          </p>
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
            <NumberField
              label="목표 인출률"
              suffix="%"
              value={
                formValues.withdrawalMode === "auto"
                  ? rateToPercentInput(baseScenario.projections[0].targetWithdrawalRate)
                  : formValues.targetWithdrawalRate
              }
              readOnly={formValues.withdrawalMode === "auto"}
              onChange={(value) => handleFieldChange("targetWithdrawalRate", value)}
            />
            <AutoWithdrawalSettings
              enabled={formValues.withdrawalMode === "auto"}
              currentAge={formValues.currentAge}
              lifeExpectancy={formValues.lifeExpectancy}
              appliedRate={baseScenario.projections[0].targetWithdrawalRate}
              onToggle={handleWithdrawalModeChange}
              onFieldChange={handleFieldChange}
            />
          </Fieldset>

          <ResultHero scenario={baseScenario} />
        </section>

        <section className="results-panel">
          <div className="section-heading">
            <p className="eyebrow">RESULTS</p>
            <h2>계산 결과</h2>
          </div>

          <SummaryGrid scenario={baseScenario} />
          <ScenarioGrid scenarios={scenarios} />
          <AssetChart scenarios={scenarios} />
        </section>
      </section>

      <section className="tables-band">
        <div className="section-heading">
          <p className="eyebrow">YEARLY PROJECTION</p>
          <h2>연도별 추이</h2>
        </div>
        <div className="table-actions" aria-label="연도별 추이 시나리오 선택">
          {scenarios.map((scenario) => (
            <button
              className={
                scenario.name === selectedScenario.name ? "button-primary" : "button-secondary"
              }
              key={scenario.name}
              type="button"
              onClick={() => setSelectedScenarioName(scenario.name)}
            >
              {scenario.name}
            </button>
          ))}
        </div>
        <div className="table-grid">
          <ProjectionTable
            title="연도별 투자 가능 자산 추이"
            rows={selectedScenario.projections}
            valueKey="investableAssets"
          />
          <ProjectionTable
            title="연도별 FIRE 목표 자산 추이"
            rows={selectedScenario.projections}
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
      <strong>{formatYearsToFire(scenario)}</strong>
      <span>
        {scenario.status === "achieved"
          ? "현재 입력값 기준으로 목표 자산에 도달하는 시점입니다."
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
    ["앞으로 더 일해야 하는 기간", formatYearsToFire(scenario)],
    ["적용된 목표 인출률", `${rateToPercentInput(scenario.projections[0].targetWithdrawalRate)}%`],
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
          <strong>{formatYearsToFire(scenario)}</strong>
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

function AssetChart({ scenarios }: { scenarios: FireScenarioResult[] }) {
  const allRows = scenarios.flatMap((scenario) => scenario.projections);
  const width = 760;
  const height = 280;
  const padding = { top: 24, right: 24, bottom: 44, left: 88 };
  const values = [
    ...allRows.map((row) => row.investableAssets),
    ...allRows.map((row) => row.fireTargetAssets),
  ];
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const valueRange = maxValue - minValue || 1;
  const maxYear = Math.max(
    ...scenarios.map((scenario) => scenario.projections.at(-1)?.year ?? 1),
    1,
  );
  const yTicks = Array.from({ length: 4 }, (_, index) => minValue + (valueRange / 3) * index);
  const xTicks = Array.from(new Set([0, Math.round(maxYear / 2), maxYear]));

  const toPoint = (row: FireYearProjection, value: number) => {
    const x =
      padding.left + (row.year / maxYear) * (width - padding.left - padding.right);
    const y =
      height -
      padding.bottom -
      ((value - minValue) / valueRange) * (height - padding.top - padding.bottom);
    return `${x},${y}`;
  };

  const toX = (year: number) =>
    padding.left + (year / maxYear) * (width - padding.left - padding.right);
  const toY = (value: number) =>
    height -
    padding.bottom -
    ((value - minValue) / valueRange) * (height - padding.top - padding.bottom);
  return (
    <article className="chart-card">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">CHART</p>
          <h3>연도별 자산 추이 그래프</h3>
        </div>
        <div className="legend">
          <span className="legend-conservative">보수적</span>
          <span className="legend-base">기본</span>
          <span className="legend-optimistic">낙관적</span>
          <span className="legend-target">점선: FIRE 목표 자산</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="연도별 자산 추이">
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              className="grid-line"
              x1={padding.left}
              y1={toY(tick)}
              x2={width - padding.right}
              y2={toY(tick)}
            />
            <text className="y-axis-label" x={padding.left - 12} y={toY(tick)}>
              {formatAxisMoney(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text
            className="x-axis-label"
            key={`x-${tick}`}
            x={toX(tick)}
            y={height - 12}
          >
            {tick === 0 ? "현재" : `${tick}년`}
          </text>
        ))}
        <line
          className="axis-line"
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
        />
        <line
          className="axis-line"
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
        />
        {scenarios.map((scenario) => (
          <polyline
            className={`target-line ${getScenarioLineClassName(scenario.name)}`}
            key={`${scenario.name}-target`}
            points={scenario.projections
              .map((row) => toPoint(row, row.fireTargetAssets))
              .join(" ")}
          />
        ))}
        {scenarios.map((scenario) => (
          <polyline
            className={`scenario-line ${getScenarioLineClassName(scenario.name)}`}
            key={scenario.name}
            points={scenario.projections
              .map((row) => toPoint(row, row.investableAssets))
              .join(" ")}
          />
        ))}
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
              <th>{valueKey === "investableAssets" ? "투자 가능 자산" : "FIRE 목표 자산"}</th>
              <th>목표 인출률</th>
              <th>연 생활비</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${valueKey}-${row.year}`}>
                <td>{row.year}년 뒤</td>
                <td>{formatMoney(row[valueKey])}</td>
                <td>{rateToPercentInput(row.targetWithdrawalRate)}%</td>
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

function AutoWithdrawalSettings({
  enabled,
  currentAge,
  lifeExpectancy,
  appliedRate,
  onToggle,
  onFieldChange,
}: {
  enabled: boolean;
  currentAge: number;
  lifeExpectancy: number;
  appliedRate: number;
  onToggle: (enabled: boolean) => void;
  onFieldChange: (field: keyof FormValues, value: string) => void;
}) {
  return (
    <div className="auto-withdrawal">
      <label className="toggle-field">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span>나이와 기대수명으로 자동 계산</span>
      </label>
      {enabled && (
        <div className="auto-withdrawal-fields">
          <NumberField
            label="현재 나이"
            suffix="세"
            value={currentAge}
            onChange={(value) => onFieldChange("currentAge", value)}
          />
          <NumberField
            label="기대수명"
            suffix="세"
            value={lifeExpectancy}
            onChange={(value) => onFieldChange("lifeExpectancy", value)}
          />
          <p>현재 기준 자동 인출률 {rateToPercentInput(appliedRate)}%</p>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  readOnly = false,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  readOnly?: boolean;
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
          readOnly={readOnly}
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
    withdrawalMode: values.withdrawalMode,
    targetWithdrawalRate: rateToPercentInput(values.targetWithdrawalRate),
    currentAge: values.currentAge,
    lifeExpectancy: values.lifeExpectancy,
  };
}

function formValuesToInputs(values: FormValues): FireInputs {
  return {
    ...values,
    annualReturnRate: percentInputToRate(values.annualReturnRate),
    incomeGrowthRate: percentInputToRate(values.incomeGrowthRate),
    inflationRate: percentInputToRate(values.inflationRate),
    targetWithdrawalRate: percentInputToRate(values.targetWithdrawalRate),
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

function formatYearsToFire(scenario: FireScenarioResult): string {
  if (scenario.yearsToFire === null) {
    return "도달 어려움";
  }

  if (scenario.yearsToFire === 0) {
    return "이미 도달";
  }

  return `${scenario.yearsToFire}년 뒤`;
}

function getScenarioLineClassName(name: string): string {
  if (name === "보수적") {
    return "conservative-line";
  }

  if (name === "낙관적") {
    return "optimistic-line";
  }

  return "base-line";
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

function formatAxisMoney(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 100_000_000) {
    return `${sign}${formatCompact(absValue / 100_000_000)}억`;
  }

  if (absValue >= 10_000) {
    return `${sign}${formatCompact(absValue / 10_000)}만`;
  }

  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: value >= 10 ? 1 : 2,
  }).format(value);
}

export default App;
