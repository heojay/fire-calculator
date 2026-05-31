import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  FIRE_PRESETS,
  calculateFireScenarios,
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

type FormValues = {
  investableAssets: NumericFormValue;
  monthlySavings: NumericFormValue;
  monthlyExpenses: NumericFormValue;
  annualRealReturnRate: NumericFormValue;
  targetWithdrawalRate: NumericFormValue;
  currentAge: NumericFormValue;
  lifeExpectancy: NumericFormValue;
};

type NumericFormField = keyof FormValues;

const commonFields = [
  ["investableAssets", "현재 보유 자산", "원"],
  ["monthlySavings", "월 평균 저축액", "원"],
  ["monthlyExpenses", "월 평균 소비액", "원"],
  ["annualRealReturnRate", "연평균 예상 실질 수익률", "%"],
] as const;

const depletionFields = [
  ["currentAge", "현재 나이", "세"],
  ["lifeExpectancy", "기대 수명", "세"],
] as const;

const fieldHelpText: Partial<Record<NumericFormField, string>> = {
  annualRealReturnRate:
    "인플레이션을 차감한 장기 실질 수익률입니다. 별도 물가 상승률은 입력하지 않습니다.",
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
            현재 자산, 월 저축액, 월 소비액을 바탕으로 FIRE 목표 도달 시점과 기대수명까지
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
            <ModeTabs selectedMode={calculationMode} onChange={setCalculationMode} />
          </div>

          {calculationMode === "trinity" ? (
            <>
              <WithdrawalRateNote withdrawalRate={inputs.targetWithdrawalRate} />
              <SummaryGrid scenario={baseScenario} />
              <ScenarioGrid scenarios={scenarios} />
              <AssetChart scenarios={scenarios} />
            </>
          ) : (
            <DepletionSummary result={depletionResult} />
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
                valueKey="investableAssets"
              />
              <ProjectionTable
                title="FIRE 목표 자산 추이"
                rows={getTableRows(selectedScenario.projections)}
                valueKey="fireTargetAssets"
              />
            </div>
          </>
        ) : (
          <DepletionProjectionTable rows={getDepletionTableRows(depletionResult.projections)} />
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

function SummaryGrid({ scenario }: { scenario: FireScenarioResult }) {
  const items = [
    ["현재 기준 FIRE 목표 자산", formatMoney(scenario.currentFireTargetAssets)],
    ["앞으로 더 일해야 하는 기간", formatMonthsToFire(scenario)],
    ["적용된 목표 인출률", `${rateToPercentInput(scenario.inputs.targetWithdrawalRate)}%`],
    [
      "은퇴 시 예상 투자 가능 자산",
      scenario.retirementInvestableAssets === null
        ? "도달 어려움"
        : formatMoney(scenario.retirementInvestableAssets),
    ],
    [
      "현재 월 소비액",
      scenario.retirementMonthlyExpenses === null
        ? "도달 어려움"
        : `${formatMoney(scenario.retirementMonthlyExpenses)} / 월`,
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

function DepletionSummary({ result }: { result: DepletionResult }) {
  const items = [
    ["필요 최소 근로 기간", formatWorkDuration(result.monthsToWork)],
    ["은퇴 예상 나이", formatRetirementAge(result.retirementAge)],
    ["최고점 자산 규모", result.peakAssets === null ? "계산 불가" : formatMoney(result.peakAssets)],
    [
      "기대수명 시점 잔여 자산",
      result.finalAssets === null ? "계산 불가" : formatMoney(result.finalAssets),
    ],
  ];

  return (
    <>
      <div className="summary-grid depletion-grid">
        {items.map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <DepletionChart result={result} />
      <article className="chart-card model-note">
        <div>
          <p className="eyebrow">MODEL</p>
          <h3>기대수명 소진 모델</h3>
        </div>
        <p>
          근로 기간에는 매월 저축액을 더하고, 은퇴 후에는 매월 소비액을 차감합니다. 모든 월의
          자산에는 입력한 연평균 실질 수익률을 월 수익률로 환산해 적용합니다.
        </p>
      </article>
    </>
  );
}

function DepletionChart({ result }: { result: DepletionResult }) {
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

  const values = rows.map((row) => row.assets);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const valueRange = maxValue - minValue || 1;
  const maxMonth = Math.max(rows.at(-1)?.month ?? 1, 1);
  const yTicks = Array.from({ length: 4 }, (_, index) => minValue + (valueRange / 3) * index);
  const xTicks = Array.from(new Set([0, Math.round(maxMonth / 2), maxMonth]));
  const retirementMonth = result.monthsToWork;

  const toPoint = (row: DepletionProjection) => `${toX(row.month)},${toY(row.assets)}`;
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

function ScenarioGrid({ scenarios }: { scenarios: FireScenarioResult[] }) {
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
              : `은퇴 시 투자 가능 자산 ${formatMoney(scenario.retirementInvestableAssets)}`}
          </p>
        </article>
      ))}
    </div>
  );
}

function AssetChart({ scenarios }: { scenarios: FireScenarioResult[] }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const allRows = scenarios.flatMap((scenario) => scenario.projections);
  const width = isMobile ? 520 : 760;
  const height = isMobile ? 320 : 280;
  const padding = isMobile
    ? { top: 20, right: 16, bottom: 34, left: 54 }
    : { top: 24, right: 24, bottom: 44, left: 88 };
  const values = [
    ...allRows.map((row) => row.investableAssets),
    ...allRows.map((row) => row.fireTargetAssets),
  ];
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const valueRange = maxValue - minValue || 1;
  const maxMonth = Math.max(
    ...scenarios.map((scenario) => scenario.projections.at(-1)?.month ?? 1),
    1,
  );
  const yTicks = Array.from({ length: 4 }, (_, index) => minValue + (valueRange / 3) * index);
  const xTicks = Array.from(new Set([0, Math.round(maxMonth / 2), maxMonth]));

  const toPoint = (row: FireProjection, value: number) => {
    const x =
      padding.left + (row.month / maxMonth) * (width - padding.left - padding.right);
    const y =
      height -
      padding.bottom -
      ((value - minValue) / valueRange) * (height - padding.top - padding.bottom);
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
  title,
  rows,
  valueKey,
}: {
  title: string;
  rows: FireProjection[];
  valueKey: "investableAssets" | "fireTargetAssets";
}) {
  return (
    <article className="table-card">
      <h3>{title}</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>시점</th>
              <th>{valueKey === "investableAssets" ? "투자 가능 자산" : "FIRE 목표 자산"}</th>
              <th>목표 인출률</th>
              <th>월 소비액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${valueKey}-${row.month}`}>
                <td>{formatProjectionMonth(row.month)}</td>
                <td>{formatMoney(row[valueKey])}</td>
                <td>{rateToPercentInput(row.targetWithdrawalRate)}%</td>
                <td>{formatMoney(row.monthlyExpenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function DepletionProjectionTable({ rows }: { rows: DepletionProjection[] }) {
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
                <th>월 현금흐름</th>
                <th>자산</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`depletion-${row.month}`}>
                  <td>{formatProjectionMonth(row.month)}</td>
                  <td>{formatRetirementAge(row.age)}</td>
                  <td>{formatDepletionPhase(row.phase)}</td>
                  <td>{formatMoney(row.cashFlow)}</td>
                  <td>{formatMoney(row.assets)}</td>
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
    monthlySavings: values.monthlySavings,
    monthlyExpenses: values.monthlyExpenses,
    annualRealReturnRate: rateToPercentInput(values.annualRealReturnRate),
    targetWithdrawalRate: rateToPercentInput(values.targetWithdrawalRate),
    currentAge: values.currentAge,
    lifeExpectancy: values.lifeExpectancy,
  };
}

function formValuesToInputs(values: FormValues): FireInputs {
  return {
    investableAssets: normalizeFormNumber(values.investableAssets),
    monthlySavings: normalizeFormNumber(values.monthlySavings),
    monthlyExpenses: normalizeFormNumber(values.monthlyExpenses),
    annualRealReturnRate: percentInputToRate(normalizeFormNumber(values.annualRealReturnRate)),
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
