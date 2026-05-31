import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  FIRE_PRESETS,
  calculateFireScenarios,
  calculatePresentValue,
  calculateYearsToWork,
  percentInputToRate,
  rateToPercentInput,
  type DepletionProjection,
  type DepletionResult,
  type FireInputs,
  type FireProjection,
  type FireScenarioResult,
} from "./fireCalculator";

type NumericFormValue = number | "";
type CalculationMode = "trinity" | "depletion";
type ValueBasis = "nominal" | "present";

type FormValues = {
  investableAssets: NumericFormValue;
  monthlyIncome: NumericFormValue;
  monthlyExpenses: NumericFormValue;
  annualNominalReturnRate: NumericFormValue;
  annualInflationRate: NumericFormValue;
  annualIncomeGrowthRate: NumericFormValue;
  targetWithdrawalRate: NumericFormValue;
  currentAge: NumericFormValue;
  lifeExpectancy: NumericFormValue;
};

type NumericFormField = keyof FormValues;

const commonFields = [
  ["investableAssets", "현재 보유 자산", "원"],
  ["monthlyIncome", "현재 월 수입", "원"],
  ["monthlyExpenses", "월 평균 소비액", "원"],
  ["annualNominalReturnRate", "명목 연평균 투자 수익률", "%"],
  ["annualInflationRate", "연평균 물가 상승률", "%"],
  ["annualIncomeGrowthRate", "연평균 수입 증가율", "%"],
] as const;

const depletionFields = [
  ["currentAge", "현재 나이", "세"],
  ["lifeExpectancy", "기대 수명", "세"],
] as const;

const fieldHelpText: Partial<Record<NumericFormField, string>> = {
  monthlyIncome: "매월 저축액은 현재 월 수입에서 월 소비액을 뺀 금액으로 계산합니다.",
  annualNominalReturnRate:
    "물가 상승률을 차감하지 않은 명목 기준 장기 투자 수익률입니다.",
  annualInflationRate: "월 소비액은 12개월마다 이 비율만큼 복리로 증가합니다.",
  annualIncomeGrowthRate: "월 수입은 12개월마다 이 비율만큼 복리로 증가합니다.",
  targetWithdrawalRate:
    "월 소비액을 FIRE 목표 자산으로 환산하는 비율입니다. 낮을수록 더 보수적인 목표 자산이 나옵니다.",
  lifeExpectancy:
    "기대수명 소진 모드에서는 이 나이까지 현재 소비 수준을 유지하는 데 필요한 근로 기간을 계산합니다.",
};

const scenarioClassNames = ["scenario-conservative", "scenario-base", "scenario-optimistic"];
const koreaAveragePreset = FIRE_PRESETS.find((preset) => preset.id === "korea-average")!;
const fireExamplePreset = FIRE_PRESETS.find((preset) => preset.id === "fire-example")!;

function App() {
  const [calculationMode, setCalculationMode] = useState<CalculationMode>("trinity");
  const [valueBasis, setValueBasis] = useState<ValueBasis>("nominal");
  const [formValues, setFormValues] = useState<FormValues>(() =>
    presetToFormValues(fireExamplePreset.values),
  );
  const [selectedScenarioName, setSelectedScenarioName] = useState("기본");

  const inputs = useMemo(() => formValuesToInputs(formValues), [formValues]);
  const scenarios = useMemo(() => calculateFireScenarios(inputs), [inputs]);
  const depletionResult = useMemo(() => calculateYearsToWork(inputs), [inputs]);
  const baseScenario = scenarios[1];
  const selectedScenario =
    scenarios.find((scenario) => scenario.name === selectedScenarioName) ?? baseScenario;

  const handleFieldChange = (field: NumericFormField, value: string) => {
    setFormValues((current) => ({
      ...current,
      [field]: value === "" ? "" : Number(value),
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
            현재 자산, 월 수입, 월 소비액을 바탕으로 FIRE 목표 도달 시점과 기대수명까지
            버티기 위한 최소 근로 기간을 계산합니다.
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

          <Fieldset title="공통 입력">
            {commonFields.map(([field, label, suffix]) => (
              <NumberField
                key={field}
                label={label}
                suffix={suffix}
                value={formValues[field]}
                helpText={fieldHelpText[field]}
                onChange={(value) => handleFieldChange(field, value)}
              />
            ))}
          </Fieldset>

          {calculationMode === "trinity" && (
            <Fieldset title="목표 인출률 입력">
              <NumberField
                label="목표 인출률"
                suffix="%"
                value={formValues.targetWithdrawalRate}
                helpText={fieldHelpText.targetWithdrawalRate}
                onChange={(value) => handleFieldChange("targetWithdrawalRate", value)}
              />
            </Fieldset>
          )}

          {calculationMode === "depletion" && (
            <Fieldset title="기대수명 입력">
              {depletionFields.map(([field, label, suffix]) => (
                <NumberField
                  key={field}
                  label={label}
                  suffix={suffix}
                  value={formValues[field]}
                  helpText={fieldHelpText[field]}
                  onChange={(value) => handleFieldChange(field, value)}
                />
              ))}
            </Fieldset>
          )}

          <ResultHero
            mode={calculationMode}
            scenario={baseScenario}
            depletionResult={depletionResult}
          />
        </section>

        <section className="results-panel">
          <div className="section-heading results-heading">
            <div>
              <p className="eyebrow">RESULTS</p>
              <h2>계산 결과</h2>
            </div>
            <div className="results-controls">
              <ValueBasisTabs selectedBasis={valueBasis} onChange={setValueBasis} />
              <ModeTabs selectedMode={calculationMode} onChange={setCalculationMode} />
            </div>
          </div>

          {calculationMode === "trinity" ? (
            <>
              <WithdrawalRateNote withdrawalRate={inputs.targetWithdrawalRate} />
              <SummaryGrid scenario={baseScenario} valueBasis={valueBasis} />
              <ScenarioGrid scenarios={scenarios} valueBasis={valueBasis} />
              <AssetChart scenarios={scenarios} valueBasis={valueBasis} />
            </>
          ) : (
            <DepletionSummary
              annualInflationRate={inputs.annualInflationRate}
              result={depletionResult}
              valueBasis={valueBasis}
            />
          )}
        </section>
      </section>

      <section className="tables-band">
        <div className="section-heading">
          <p className="eyebrow">MONTHLY PROJECTION</p>
          <h2>월별 추이</h2>
        </div>
        {calculationMode === "trinity" ? (
          <>
            <div className="table-actions" aria-label="월별 추이 시나리오 선택">
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
                title="투자 가능 자산 추이"
                rows={getTableRows(selectedScenario.projections)}
                annualInflationRate={selectedScenario.inputs.annualInflationRate}
                valueBasis={valueBasis}
                valueKey="investableAssets"
              />
              <ProjectionTable
                title="FIRE 목표 자산 추이"
                rows={getTableRows(selectedScenario.projections)}
                annualInflationRate={selectedScenario.inputs.annualInflationRate}
                valueBasis={valueBasis}
                valueKey="fireTargetAssets"
              />
            </div>
          </>
        ) : (
          <DepletionProjectionTable
            annualInflationRate={inputs.annualInflationRate}
            rows={getDepletionTableRows(depletionResult.projections)}
            valueBasis={valueBasis}
          />
        )}
      </section>
    </main>
  );
}

function ModeTabs({
  selectedMode,
  onChange,
}: {
  selectedMode: CalculationMode;
  onChange: (mode: CalculationMode) => void;
}) {
  const tabs = [
    ["trinity", "목표 인출률"],
    ["depletion", "기대수명 소진"],
  ] as const;

  return (
    <div className="mode-tabs" role="tablist" aria-label="계산 모드">
      {tabs.map(([mode, label]) => (
        <button
          aria-selected={selectedMode === mode}
          className={selectedMode === mode ? "mode-tab mode-tab-active" : "mode-tab"}
          key={mode}
          role="tab"
          type="button"
          onClick={() => onChange(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ValueBasisTabs({
  selectedBasis,
  onChange,
}: {
  selectedBasis: ValueBasis;
  onChange: (basis: ValueBasis) => void;
}) {
  const tabs = [
    ["nominal", "명목 기준"],
    ["present", "현재 가치"],
  ] as const;

  return (
    <div className="mode-tabs value-basis-tabs" role="tablist" aria-label="금액 표시 기준">
      {tabs.map(([basis, label]) => (
        <button
          aria-selected={selectedBasis === basis}
          className={selectedBasis === basis ? "mode-tab mode-tab-active" : "mode-tab"}
          key={basis}
          role="tab"
          type="button"
          onClick={() => onChange(basis)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ResultHero({
  mode,
  scenario,
  depletionResult,
}: {
  mode: CalculationMode;
  scenario: FireScenarioResult;
  depletionResult: DepletionResult;
}) {
  if (mode === "depletion") {
    return (
      <aside className="hero-card depletion-hero-card">
        <p className="card-label">기대수명까지 버티기 위한 최소 근로 기간</p>
        <strong>{formatWorkRequirementSentence(depletionResult)}</strong>
        <span>{formatDepletionStatus(depletionResult)}</span>
      </aside>
    );
  }

  return (
    <aside className="hero-card">
      <p className="card-label">경제적 자유 도달 시점</p>
      <strong>{formatMonthsToFire(scenario)}</strong>
      <span>
        {scenario.status === "achieved"
          ? "현재 입력값 기준으로 목표 자산에 도달하는 시점입니다."
          : "100년 안에 목표 자산에 도달하지 못합니다."}
      </span>
    </aside>
  );
}

function WithdrawalRateNote({ withdrawalRate }: { withdrawalRate: number }) {
  return (
    <article className="chart-card model-note">
      <div>
        <p className="eyebrow">MODEL</p>
        <h3>목표 인출률 모델</h3>
      </div>
      <p>
        입력한 목표 인출률로 현재 월 소비액을 감당할 FIRE 목표 자산을 계산합니다. 흔히
        언급되는 4% 법칙은 트리니티 연구에서 알려진 30년 은퇴 기간 기준 참고값입니다. 조기
        은퇴처럼 은퇴 기간이 길수록 3~3.5%처럼 더 보수적으로 잡는 경우가 많습니다.
      </p>
      <strong>현재 적용 인출률 {rateToPercentInput(withdrawalRate)}%</strong>
    </article>
  );
}

function SummaryGrid({
  scenario,
  valueBasis,
}: {
  scenario: FireScenarioResult;
  valueBasis: ValueBasis;
}) {
  const retirementMonth = scenario.monthsToFire ?? 0;
  const retirementFirstExpenseMonth = scenario.monthsToFire === null ? 0 : scenario.monthsToFire + 1;
  const formatScenarioMoney = (value: number, month: number) =>
    formatMoney(toDisplayMoney(value, scenario.inputs.annualInflationRate, month, valueBasis));
  const items = [
    ["현재 FIRE 목표 자산", formatScenarioMoney(scenario.currentFireTargetAssets, 0)],
    ["앞으로 더 일해야 하는 기간", formatMonthsToFire(scenario)],
    ["적용된 목표 인출률", `${rateToPercentInput(scenario.inputs.targetWithdrawalRate)}%`],
    [
      basisLabel("은퇴 시 필요 FIRE 목표 자산", valueBasis),
      scenario.retirementFireTargetAssets === null
        ? "도달 어려움"
        : formatScenarioMoney(scenario.retirementFireTargetAssets, retirementMonth),
    ],
    [
      basisLabel("은퇴 시 예상 투자 가능 자산", valueBasis),
      scenario.retirementInvestableAssets === null
        ? "도달 어려움"
        : formatScenarioMoney(scenario.retirementInvestableAssets, retirementMonth),
    ],
    [
      basisLabel("은퇴 후 첫 달 예상 생활비", valueBasis),
      scenario.retirementMonthlyExpenses === null
        ? "도달 어려움"
        : `${formatScenarioMoney(
            scenario.retirementFirstMonthExpenses ?? scenario.retirementMonthlyExpenses,
            retirementFirstExpenseMonth,
          )} / 월`,
    ],
    [
      basisLabel("은퇴 후 안전 인출 가능 금액", valueBasis),
      scenario.retirementSafeWithdrawalAmount === null
        ? "도달 어려움"
        : `${formatScenarioMoney(scenario.retirementSafeWithdrawalAmount, retirementMonth)} / 년`,
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

function DepletionSummary({
  annualInflationRate,
  result,
  valueBasis,
}: {
  annualInflationRate: number;
  result: DepletionResult;
  valueBasis: ValueBasis;
}) {
  const peakMonth = getDepletionPeakMonth(result);
  const retirementFirstExpenseMonth =
    result.monthsToWork === null ? 0 : result.monthsToWork + 1;
  const formatDepletionMoney = (value: number, month: number) =>
    formatMoney(toDisplayMoney(value, annualInflationRate, month, valueBasis));
  const items = [
    ["필요 최소 근로 기간", formatWorkDuration(result.monthsToWork)],
    ["은퇴 예상 나이", formatRetirementAge(result.retirementAge)],
    [
      basisLabel("은퇴 후 첫 달 예상 생활비", valueBasis),
      result.retirementFirstMonthExpenses === null
        ? "계산 불가"
        : `${formatDepletionMoney(result.retirementFirstMonthExpenses, retirementFirstExpenseMonth)} / 월`,
    ],
    [
      basisLabel("최고점 자산 규모", valueBasis),
      result.peakAssets === null || peakMonth === null
        ? "계산 불가"
        : formatDepletionMoney(result.peakAssets, peakMonth),
    ],
    [
      basisLabel("기대수명 시점 잔여 자산", valueBasis),
      result.finalAssets === null
        ? "계산 불가"
        : formatDepletionMoney(result.finalAssets, result.totalMonths),
    ],
  ];

  return (
    <>
      <article className="chart-card model-note">
        <div>
          <p className="eyebrow">MODEL</p>
          <h3>기대수명 소진 모델</h3>
        </div>
        <p>
          근로 기간에는 월 수입에서 월 소비액을 뺀 금액을 더하고, 은퇴 후에는 월 소비액을
          차감합니다. 월 수입과 소비액은 매년 입력한 증가율을 반영합니다.
        </p>
      </article>
      <div className="summary-grid depletion-grid">
        {items.map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <DepletionChart
        annualInflationRate={annualInflationRate}
        result={result}
        valueBasis={valueBasis}
      />
    </>
  );
}

function DepletionChart({
  annualInflationRate,
  result,
  valueBasis,
}: {
  annualInflationRate: number;
  result: DepletionResult;
  valueBasis: ValueBasis;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const rows = result.projections;
  const width = isMobile ? 360 : 760;
  const height = isMobile ? 300 : 280;
  const padding = isMobile
    ? { top: 20, right: 16, bottom: 36, left: 54 }
    : { top: 24, right: 24, bottom: 44, left: 88 };

  if (rows.length === 0) {
    return (
      <article className="chart-card">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">CHART</p>
            <h3>기대수명 자산 추이 그래프</h3>
          </div>
        </div>
        <p className="empty-chart-message">기대 수명이 현재 나이보다 커야 그래프를 표시할 수 있습니다.</p>
      </article>
    );
  }

  const rowAssets = (row: DepletionProjection) =>
    toDisplayMoney(row.assets, annualInflationRate, row.month, valueBasis);
  const values = rows.map(rowAssets);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const valueRange = maxValue - minValue || 1;
  const maxMonth = Math.max(rows.at(-1)?.month ?? 1, 1);
  const yTicks = Array.from({ length: 4 }, (_, index) => minValue + (valueRange / 3) * index);
  const xTicks = Array.from(new Set([0, Math.round(maxMonth / 2), maxMonth]));
  const retirementMonth = result.monthsToWork;

  const toPoint = (row: DepletionProjection) => `${toX(row.month)},${toY(rowAssets(row))}`;
  const toX = (month: number) =>
    padding.left + (month / maxMonth) * (width - padding.left - padding.right);
  const toY = (value: number) =>
    height -
    padding.bottom -
    ((value - minValue) / valueRange) * (height - padding.top - padding.bottom);

  return (
    <article className="chart-card">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">CHART</p>
          <h3>기대수명 자산 추이 그래프</h3>
        </div>
        <div className="legend">
          <span className="legend-base">자산 추이</span>
          <span className="legend-retirement">은퇴 시점</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="기대수명 자산 추이">
        {yTicks.map((tick) => (
          <g key={`depletion-y-${tick}`}>
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
            key={`depletion-x-${tick}`}
            x={toX(tick)}
            y={height - 12}
          >
            {tick === 0 ? "현재" : formatProjectionMonth(tick)}
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
        {retirementMonth !== null && (
          <line
            className="retirement-line"
            x1={toX(retirementMonth)}
            y1={padding.top}
            x2={toX(retirementMonth)}
            y2={height - padding.bottom}
          />
        )}
        <polyline className="scenario-line base-line" points={rows.map(toPoint).join(" ")} />
      </svg>
    </article>
  );
}

function ScenarioGrid({
  scenarios,
  valueBasis,
}: {
  scenarios: FireScenarioResult[];
  valueBasis: ValueBasis;
}) {
  return (
    <div className="scenario-grid">
      {scenarios.map((scenario, index) => (
        <article className={`scenario-card ${scenarioClassNames[index]}`} key={scenario.name}>
          <span>{scenario.description}</span>
          <h3>{scenario.name} 시나리오</h3>
          <strong>{formatMonthsToFire(scenario)}</strong>
          <p>
            {scenario.retirementInvestableAssets === null
              ? "100년 제한 안에서 FIRE 목표 자산에 도달하지 못합니다."
              : `은퇴 시 투자 가능 자산 ${formatMoney(
                  toDisplayMoney(
                    scenario.retirementInvestableAssets,
                    scenario.inputs.annualInflationRate,
                    scenario.monthsToFire ?? 0,
                    valueBasis,
                  ),
                )}`}
          </p>
        </article>
      ))}
    </div>
  );
}

function AssetChart({
  scenarios,
  valueBasis,
}: {
  scenarios: FireScenarioResult[];
  valueBasis: ValueBasis;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const allRows = scenarios.flatMap((scenario) => scenario.projections);
  const width = isMobile ? 520 : 760;
  const height = isMobile ? 320 : 280;
  const padding = isMobile
    ? { top: 20, right: 16, bottom: 34, left: 54 }
    : { top: 24, right: 24, bottom: 44, left: 88 };
  const values = scenarios.flatMap((scenario) =>
    scenario.projections.flatMap((row) => [
      toDisplayMoney(
        row.investableAssets,
        scenario.inputs.annualInflationRate,
        row.month,
        valueBasis,
      ),
      toDisplayMoney(
        row.fireTargetAssets,
        scenario.inputs.annualInflationRate,
        row.month,
        valueBasis,
      ),
    ]),
  );
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const valueRange = maxValue - minValue || 1;
  const maxMonth = Math.max(
    ...scenarios.map((scenario) => scenario.projections.at(-1)?.month ?? 1),
    1,
  );
  const yTicks = Array.from({ length: 4 }, (_, index) => minValue + (valueRange / 3) * index);
  const xTicks = Array.from(new Set([0, Math.round(maxMonth / 2), maxMonth]));

  const toPoint = (scenario: FireScenarioResult, row: FireProjection, value: number) => {
    const displayValue = toDisplayMoney(
      value,
      scenario.inputs.annualInflationRate,
      row.month,
      valueBasis,
    );
    const x =
      padding.left + (row.month / maxMonth) * (width - padding.left - padding.right);
    const y =
      height -
      padding.bottom -
      ((displayValue - minValue) / valueRange) * (height - padding.top - padding.bottom);
    return `${x},${y}`;
  };

  const toX = (month: number) =>
    padding.left + (month / maxMonth) * (width - padding.left - padding.right);
  const toY = (value: number) =>
    height -
    padding.bottom -
    ((value - minValue) / valueRange) * (height - padding.top - padding.bottom);
  return (
    <article className="chart-card">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">CHART</p>
          <h3>월별 자산 추이 그래프</h3>
        </div>
        <div className="legend">
          <span className="legend-conservative">보수적</span>
          <span className="legend-base">기본</span>
          <span className="legend-optimistic">낙관적</span>
          <span className="legend-target">점선: FIRE 목표 자산</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="월별 자산 추이">
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
            {tick === 0 ? "현재" : formatProjectionMonth(tick)}
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
              .map((row) => toPoint(scenario, row, row.fireTargetAssets))
              .join(" ")}
          />
        ))}
        {scenarios.map((scenario) => (
          <polyline
            className={`scenario-line ${getScenarioLineClassName(scenario.name)}`}
            key={scenario.name}
            points={scenario.projections
              .map((row) => toPoint(scenario, row, row.investableAssets))
              .join(" ")}
          />
        ))}
      </svg>
    </article>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);

    const updateMatches = () => setMatches(mediaQueryList.matches);
    updateMatches();

    mediaQueryList.addEventListener("change", updateMatches);
    return () => mediaQueryList.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

function ProjectionTable({
  annualInflationRate,
  title,
  rows,
  valueBasis,
  valueKey,
}: {
  annualInflationRate: number;
  title: string;
  rows: FireProjection[];
  valueBasis: ValueBasis;
  valueKey: "investableAssets" | "fireTargetAssets";
}) {
  const moneyHeader =
    valueKey === "investableAssets" ? "투자 가능 자산" : "FIRE 목표 자산";

  return (
    <article className="table-card">
      <h3>{title}</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>시점</th>
              <th>{basisLabel(moneyHeader, valueBasis)}</th>
              <th>목표 인출률</th>
              <th>{basisLabel("월 소비액", valueBasis)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${valueKey}-${row.month}`}>
                <td>{formatProjectionMonth(row.month)}</td>
                <td>
                  {formatMoney(
                    toDisplayMoney(row[valueKey], annualInflationRate, row.month, valueBasis),
                  )}
                </td>
                <td>{rateToPercentInput(row.targetWithdrawalRate)}%</td>
                <td>
                  {formatMoney(
                    toDisplayMoney(
                      row.monthlyExpenses,
                      annualInflationRate,
                      row.month,
                      valueBasis,
                    ),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function DepletionProjectionTable({
  annualInflationRate,
  rows,
  valueBasis,
}: {
  annualInflationRate: number;
  rows: DepletionProjection[];
  valueBasis: ValueBasis;
}) {
  return (
    <div className="table-grid single-table-grid">
      <article className="table-card">
        <h3>기대수명 자산 추이</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>시점</th>
                <th>나이</th>
                <th>상태</th>
                <th>{basisLabel("월 현금흐름", valueBasis)}</th>
                <th>{basisLabel("월 생활비", valueBasis)}</th>
                <th>{basisLabel("자산", valueBasis)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`depletion-${row.month}`}>
                  <td>{formatProjectionMonth(row.month)}</td>
                  <td>{formatRetirementAge(row.age)}</td>
                  <td>{formatDepletionPhase(row.phase)}</td>
                  <td>
                    {formatMoney(
                      toDisplayMoney(row.cashFlow, annualInflationRate, row.month, valueBasis),
                    )}
                  </td>
                  <td>
                    {formatMoney(
                      toDisplayMoney(
                        row.monthlyExpenses,
                        annualInflationRate,
                        row.month,
                        valueBasis,
                      ),
                    )}
                  </td>
                  <td>
                    {formatMoney(
                      toDisplayMoney(row.assets, annualInflationRate, row.month, valueBasis),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
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
  helpText,
  onChange,
}: {
  label: string;
  suffix: string;
  value: NumericFormValue;
  helpText?: string;
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  const inputValue = typeof value === "number" && !Number.isNaN(value) ? value : "";
  const moneyHint = suffix === "원" && typeof value === "number" ? formatMoneyInputHint(value) : "";

  return (
    <div className="number-field">
      <div className="number-field-label">
        <label htmlFor={inputId}>{label}</label>
        {helpText && (
          <span className="field-help">
            <button type="button" aria-label={`${label} 설명`} className="field-help-trigger">
              ?
            </button>
            <span className="field-tooltip" role="tooltip">
              {helpText}
            </span>
          </span>
        )}
      </div>
      <div className="number-field-control">
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
        />
        <em>{suffix}</em>
      </div>
      {moneyHint && <small>{moneyHint}</small>}
    </div>
  );
}

function presetToFormValues(values: FireInputs): FormValues {
  return {
    investableAssets: values.investableAssets,
    monthlyIncome: values.monthlyIncome,
    monthlyExpenses: values.monthlyExpenses,
    annualNominalReturnRate: rateToPercentInput(values.annualNominalReturnRate),
    annualInflationRate: rateToPercentInput(values.annualInflationRate),
    annualIncomeGrowthRate: rateToPercentInput(values.annualIncomeGrowthRate),
    targetWithdrawalRate: rateToPercentInput(values.targetWithdrawalRate),
    currentAge: values.currentAge,
    lifeExpectancy: values.lifeExpectancy,
  };
}

function formValuesToInputs(values: FormValues): FireInputs {
  return {
    investableAssets: normalizeFormNumber(values.investableAssets),
    monthlyIncome: normalizeFormNumber(values.monthlyIncome),
    monthlyExpenses: normalizeFormNumber(values.monthlyExpenses),
    annualNominalReturnRate: percentInputToRate(normalizeFormNumber(values.annualNominalReturnRate)),
    annualInflationRate: percentInputToRate(normalizeFormNumber(values.annualInflationRate)),
    annualIncomeGrowthRate: percentInputToRate(normalizeFormNumber(values.annualIncomeGrowthRate)),
    targetWithdrawalRate: percentInputToRate(normalizeFormNumber(values.targetWithdrawalRate)),
    currentAge: normalizeFormNumber(values.currentAge),
    lifeExpectancy: normalizeFormNumber(values.lifeExpectancy),
  };
}

function normalizeFormNumber(value: NumericFormValue): number {
  return value === "" ? 0 : value;
}

function getTableRows(rows: FireProjection[]): FireProjection[] {
  const lastMonth = rows.at(-1)?.month ?? 0;
  return rows.filter((row) => row.month % 12 === 0 || row.month === lastMonth);
}

function getDepletionTableRows(rows: DepletionProjection[]): DepletionProjection[] {
  const lastMonth = rows.at(-1)?.month ?? 0;
  const retirementMonth = rows.findIndex((row, index) => {
    const previousRow = rows[index - 1];
    return row.phase === "retired" && previousRow?.phase === "working";
  });
  const keyMonths = new Set([0, lastMonth]);

  if (retirementMonth >= 0) {
    keyMonths.add(retirementMonth);
  }

  return rows.filter((row) => row.month % 12 === 0 || keyMonths.has(row.month));
}

function getDepletionPeakMonth(result: DepletionResult): number | null {
  if (result.peakAssets === null || result.monthsToWork === null) {
    return result.status === "already-sufficient" ? 0 : null;
  }

  return result.projections
    .filter((row) => row.month <= result.monthsToWork!)
    .reduce<DepletionProjection | null>((peakRow, row) => {
      if (!peakRow || row.assets > peakRow.assets) {
        return row;
      }

      return peakRow;
    }, null)?.month ?? null;
}

function toDisplayMoney(
  value: number,
  annualInflationRate: number,
  month: number,
  valueBasis: ValueBasis,
): number {
  if (valueBasis === "nominal") {
    return value;
  }

  return calculatePresentValue(value, annualInflationRate, month);
}

function basisLabel(label: string, valueBasis: ValueBasis): string {
  return `${label} (${valueBasis === "nominal" ? "명목" : "현재 가치"})`;
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

function formatMonthsToFire(scenario: FireScenarioResult): string {
  if (scenario.monthsToFire === null) {
    return "도달 어려움";
  }

  if (scenario.monthsToFire === 0) {
    return "이미 도달";
  }

  return `${formatWorkDuration(scenario.monthsToFire)} 뒤`;
}

function formatWorkRequirementSentence(result: DepletionResult): string {
  if (result.status === "invalid-time-horizon") {
    return "계산할 기간이 없습니다.";
  }

  if (result.status === "not-achievable" || result.monthsToWork === null) {
    return "현재 조건으로는 어렵습니다.";
  }

  return `앞으로 ${formatWorkDuration(result.monthsToWork)} 더 일해야 합니다.`;
}

function formatDepletionStatus(result: DepletionResult): string {
  if (result.status === "already-sufficient") {
    return "현재 자산만으로도 기대수명까지 현재 소비 수준을 유지할 수 있습니다.";
  }

  if (result.status === "achievable") {
    return "기대수명 시점에 자산이 0 이상이 되는 가장 빠른 은퇴 시점입니다.";
  }

  if (result.status === "invalid-time-horizon") {
    return "기대 수명이 현재 나이보다 커야 합니다.";
  }

  return "기대수명까지 계속 일해도 현재 소비 수준을 유지하기 어렵습니다.";
}

function formatWorkDuration(months: number | null): string {
  if (months === null) {
    return "계산 불가";
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) {
    return `${remainingMonths}개월`;
  }

  if (remainingMonths === 0) {
    return `${years}년`;
  }

  return `${years}년 ${remainingMonths}개월`;
}

function formatRetirementAge(age: number | null): string {
  if (age === null) {
    return "계산 불가";
  }

  const years = Math.floor(age);
  const months = Math.round((age - years) * 12);

  if (months === 0) {
    return `${years}세`;
  }

  return `${years}세 ${months}개월`;
}

function formatDepletionPhase(phase: DepletionProjection["phase"]): string {
  return phase === "working" ? "근로" : "은퇴";
}

function formatProjectionMonth(month: number): string {
  if (month === 0) {
    return "현재";
  }

  return `${formatWorkDuration(month)} 뒤`;
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
