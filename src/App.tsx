import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  FIRE_PRESETS,
  MIN_WITHDRAWAL_RATE,
  calculateFireScenarios,
  calculateCurrentAgeFromBirthYear,
  calculateNationalPensionStartAge,
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
type ResultTab = "summary" | "monthly" | "experiments";

type FormValues = {
  investableAssets: NumericFormValue;
  monthlyIncome: NumericFormValue;
  monthlyExpenses: NumericFormValue;
  annualNominalReturnRate: NumericFormValue;
  annualInflationRate: NumericFormValue;
  annualIncomeGrowthRate: NumericFormValue;
  targetWithdrawalRate: NumericFormValue;
  birthYear: NumericFormValue;
  lifeExpectancy: NumericFormValue;
  nationalPensionMonthlyAmount: NumericFormValue;
};

type NumericFormField = keyof FormValues;
type CachedAppState = {
  version: number;
  formValues: FormValues;
  calculationMode: CalculationMode;
  valueBasis: ValueBasis;
};

type ImpactMode = "trinity" | "depletion";
type ImpactKind = "expenses" | "savings" | "return-rate";
type ImpactOption = {
  label: string;
  summaryLabel: string;
  delta: number;
};

const commonFields = [
  ["investableAssets", "현재 보유 자산", "원"],
  ["monthlyIncome", "현재 월 수입", "원"],
  ["monthlyExpenses", "월 평균 소비액", "원"],
  ["annualNominalReturnRate", "명목 연평균 투자 수익률", "%"],
  ["annualInflationRate", "연평균 물가 상승률", "%"],
  ["annualIncomeGrowthRate", "연평균 수입 증가율", "%"],
] as const;

const depletionFields = [
  ["birthYear", "출생연도", "년"],
  ["lifeExpectancy", "기대 수명", "세"],
] as const;

const pensionFields = [
  ["nationalPensionMonthlyAmount", "국민연금 예상 월 수령액", "원"],
] as const;

const fieldHelpText: Partial<Record<NumericFormField, string>> = {
  monthlyIncome: "매월 저축액은 현재 월 수입에서 월 소비액을 뺀 금액으로 계산합니다.",
  annualNominalReturnRate:
    "개인 투자자의 비용, 세금, 위험 감수 차이를 감안해 장기 기본값은 명목 5%로 둡니다.",
  annualInflationRate: "장기 계산에서는 한국은행 물가안정목표에 가까운 2%를 기본값으로 둡니다.",
  annualIncomeGrowthRate:
    "장기 임금과 소득 증가 가정은 과도하게 높이지 않고 명목 3%를 기본값으로 둡니다.",
  targetWithdrawalRate:
    "월 소비액을 FIRE 목표 자산으로 환산하는 비율입니다. 낮을수록 더 보수적인 목표 자산이 나옵니다.",
  birthYear:
    "기대수명 소진 모드에서는 출생연도로 현재 나이와 국민연금 수령 시작 나이를 계산합니다.",
  lifeExpectancy:
    "기대수명 소진 모드에서는 이 나이까지 현재 소비 수준을 유지하는 데 필요한 근로 기간을 계산합니다.",
  nationalPensionMonthlyAmount:
    "현재 가치 기준 월 예상 수령액입니다. 계산에서는 물가상승률을 반영해 명목 금액으로 환산합니다.",
};

const koreaAveragePreset = FIRE_PRESETS.find((preset) => preset.id === "korea-average")!;
const fireExamplePreset = FIRE_PRESETS.find((preset) => preset.id === "fire-example")!;
const cacheVersion = 2;
const cacheKey = "firecalc:lastState:v2";
const validCalculationModes: CalculationMode[] = ["trinity", "depletion"];
const validValueBases: ValueBasis[] = ["nominal", "present"];
const numericFormFields: NumericFormField[] = [
  "investableAssets",
  "monthlyIncome",
  "monthlyExpenses",
  "annualNominalReturnRate",
  "annualInflationRate",
  "annualIncomeGrowthRate",
  "targetWithdrawalRate",
  "birthYear",
  "lifeExpectancy",
  "nationalPensionMonthlyAmount",
];
const expenseImpactOptions: ImpactOption[] = [
  { label: "월 소비 -50만원", summaryLabel: "월 소비 -50만원이면", delta: -500_000 },
  { label: "월 소비 +50만원", summaryLabel: "월 소비 +50만원이면", delta: 500_000 },
  { label: "월 소비 +100만원", summaryLabel: "월 소비 +100만원이면", delta: 1_000_000 },
];
const savingsImpactOptions: ImpactOption[] = [
  { label: "월 저축 -50만원", summaryLabel: "월 저축 -50만원이면", delta: -500_000 },
  { label: "월 저축 +50만원", summaryLabel: "월 저축 +50만원이면", delta: 500_000 },
  { label: "월 저축 +100만원", summaryLabel: "월 저축 +100만원이면", delta: 1_000_000 },
];
const returnImpactOptions: ImpactOption[] = [
  { label: "수익률 -1%p", summaryLabel: "수익률 -1%p이면", delta: -0.01 },
  { label: "수익률 +1%p", summaryLabel: "수익률 +1%p이면", delta: 0.01 },
  { label: "수익률 +2%p", summaryLabel: "수익률 +2%p이면", delta: 0.02 },
];

function App() {
  const [initialState] = useState(loadCachedAppState);
  const [calculationMode, setCalculationMode] = useState<CalculationMode>(
    initialState.calculationMode,
  );
  const [valueBasis, setValueBasis] = useState<ValueBasis>(initialState.valueBasis);
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>("summary");
  const [formValues, setFormValues] = useState<FormValues>(initialState.formValues);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const inputs = useMemo(() => formValuesToInputs(formValues), [formValues]);
  const scenarios = useMemo(() => calculateFireScenarios(inputs), [inputs]);
  const depletionResult = useMemo(() => calculateYearsToWork(inputs), [inputs]);
  const baseScenario = scenarios[1];

  useEffect(() => {
    saveCachedAppState({
      version: cacheVersion,
      formValues,
      calculationMode,
      valueBasis,
    });
  }, [calculationMode, formValues, valueBasis]);

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
          <button className="help-button" type="button" onClick={() => setIsHelpOpen(true)}>
            도움말
          </button>
        </nav>

        <section className="hero-grid">
          <p className="eyebrow">FIRE CALCULATOR</p>
          <h1 className="hero-title">경제적 자유까지 얼마나 걸릴까요?</h1>
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
            <>
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
              <Fieldset title="국민연금 입력">
                {pensionFields.map(([field, label, suffix]) => (
                  <NumberField
                    key={field}
                    label={label}
                    suffix={suffix}
                    value={formValues[field]}
                    helpText={fieldHelpText[field]}
                    onChange={(value) => handleFieldChange(field, value)}
                  />
                ))}
                <PensionStartAgeNote birthYear={normalizeFormNumber(formValues.birthYear)} />
              </Fieldset>
            </>
          )}
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

          <ResultHero
            mode={calculationMode}
            scenario={baseScenario}
            depletionResult={depletionResult}
          />

          <ResultTabs selectedTab={activeResultTab} onChange={setActiveResultTab} />

          {activeResultTab === "summary" && (
            <div className="result-tab-panel" role="tabpanel">
              {calculationMode === "trinity" ? (
                <>
                  <WithdrawalRateNote withdrawalRate={inputs.targetWithdrawalRate} />
                  <SummaryGrid scenario={baseScenario} valueBasis={valueBasis} />
                </>
              ) : (
                <DepletionSummary
                  annualInflationRate={inputs.annualInflationRate}
                  result={depletionResult}
                  valueBasis={valueBasis}
                />
              )}
            </div>
          )}

          {activeResultTab === "monthly" && (
            <div className="result-tab-panel" role="tabpanel">
              {calculationMode === "trinity" ? (
                <>
                  <AssetChart scenario={baseScenario} valueBasis={valueBasis} />
                  <div className="table-grid">
                    <ProjectionTable
                      title="투자 가능 자산 추이"
                      rows={getTableRows(baseScenario.projections)}
                      annualInflationRate={baseScenario.inputs.annualInflationRate}
                      valueBasis={valueBasis}
                      valueKey="investableAssets"
                    />
                    <ProjectionTable
                      title="FIRE 목표 자산 추이"
                      rows={getTableRows(baseScenario.projections)}
                      annualInflationRate={baseScenario.inputs.annualInflationRate}
                      valueBasis={valueBasis}
                      valueKey="fireTargetAssets"
                    />
                  </div>
                </>
              ) : (
                <>
                  <DepletionChart
                    annualInflationRate={inputs.annualInflationRate}
                    result={depletionResult}
                    valueBasis={valueBasis}
                  />
                  <DepletionProjectionTable
                    annualInflationRate={inputs.annualInflationRate}
                    rows={getDepletionTableRows(depletionResult.projections)}
                    valueBasis={valueBasis}
                  />
                </>
              )}
            </div>
          )}

          {activeResultTab === "experiments" && (
            <div className="result-tab-panel" role="tabpanel">
              <ImpactSection
                inputs={inputs}
                mode={calculationMode === "trinity" ? "trinity" : "depletion"}
              />
            </div>
          )}
        </section>
      </section>

      <footer className="site-footer">
        만든 사람{" "}
        <a href="https://heojay.dev" target="_blank" rel="noreferrer">
          heojay.dev
        </a>
      </footer>

      {isHelpOpen && <HelpDialog onClose={() => setIsHelpOpen(false)} />}
    </main>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  return (
    <div className="help-overlay" onClick={onClose}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="help-dialog"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="help-dialog-header">
          <div>
            <p className="eyebrow">HELP</p>
            <h2 id={titleId}>도움말</h2>
          </div>
          <button
            aria-label="도움말 닫기"
            className="help-close-button"
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <nav className="help-toc" aria-label="도움말 목차">
          <a href="#help-formulas">1. 주요 계산식</a>
          <a href="#help-value-basis">2. 명목 기준과 현재 가치</a>
          <a href="#help-withdrawal-rate">3. 목표 인출률 방식</a>
          <a href="#help-depletion">4. 기대수명 소진 방식</a>
          <a href="#help-pension">5. 국민연금 입력 기준</a>
          <a href="#help-experiments">6. 가정 바꿔보기</a>
          <a href="#help-limitations">7. 계산기의 한계</a>
        </nav>

        <div className="help-content">
          <HelpSection id="help-formulas" title="1. 주요 계산식">
            <p>월 저축액은 월 수입에서 월 소비를 뺀 금액입니다.</p>
            <FormulaBlock label="월 저축액">월 저축액 = 월 수입 - 월 소비</FormulaBlock>
            <p>은퇴 전 월별 자산은 월 수익률과 월 저축액을 반영해 계산합니다.</p>
            <FormulaBlock label="월별 자산 변화">
              다음 달 자산 = 현재 자산 × (1 + 월 수익률) + 월 저축액
            </FormulaBlock>
            <p>은퇴 후에는 월 저축액 대신 생활비 인출과 국민연금 수령액을 반영합니다.</p>
            <FormulaBlock label="은퇴 후 자산">
              은퇴 후 자산 = 현재 자산 × (1 + 월 수익률) - 월 소비 + 국민연금
            </FormulaBlock>
            <p>목표 인출률 방식의 필요 자산은 연간 소비액을 목표 인출률로 나눕니다.</p>
            <FormulaBlock label="목표 자산">
              필요 자산 = 연간 소비액 ÷ 목표 인출률
            </FormulaBlock>
            <p>
              예를 들어 월 소비가 400만 원이고 목표 인출률이 3.5%라면 4,800만 원 ÷
              0.035 = 약 13.7억 원입니다.
            </p>
            <FormulaBlock label="월 소비 증가에 따른 추가 필요 자산">
              추가 필요 자산 = 추가 월 소비액 × 12 ÷ 목표 인출률
            </FormulaBlock>
            <p>
              예를 들어 월 소비가 50만 원 늘고 목표 인출률이 3.5%라면 600만 원 ÷
              0.035 = 약 1.7억 원입니다.
            </p>
          </HelpSection>

          <HelpSection id="help-value-basis" title="2. 명목 기준과 현재 가치">
            <p>명목 기준은 미래 시점에 실제로 필요한 금액입니다.</p>
            <p>현재 가치는 미래 금액을 오늘 돈의 가치로 환산한 금액입니다.</p>
            <dl className="help-definition-list">
              <div>
                <dt>명목 기준</dt>
                <dd>미래에 실제 필요한 금액</dd>
              </div>
              <div>
                <dt>현재 가치</dt>
                <dd>오늘 돈 기준으로 환산한 금액</dd>
              </div>
            </dl>
            <p>
              예를 들어 20년 후 20억 원이 필요하더라도, 물가상승률을 반영하면 오늘 돈
              가치로는 더 낮게 보일 수 있습니다.
            </p>
          </HelpSection>

          <HelpSection id="help-withdrawal-rate" title="3. 목표 인출률 방식">
            <p>
              목표 인출률 방식은 은퇴 후 매년 자산의 일정 비율을 꺼내 쓴다고 가정해 필요한
              자산을 계산합니다.
            </p>
            <FormulaBlock label="목표 인출률 방식">
              필요 자산 = 연간 소비액 ÷ 목표 인출률
            </FormulaBlock>
            <p>인출률이 낮을수록 더 보수적인 계산입니다.</p>
            <ul>
              <li>4.0%: 연 생활비의 25배 필요</li>
              <li>3.5%: 연 생활비의 약 28.6배 필요</li>
              <li>3.0%: 연 생활비의 약 33.3배 필요</li>
            </ul>
            <p>
              이 방식은 단순하고 직관적이지만, 국민연금이나 은퇴 후 현금흐름을 세밀하게
              반영하기는 어렵습니다.
            </p>
          </HelpSection>

          <HelpSection id="help-depletion" title="4. 기대수명 소진 방식">
            <p>
              기대수명 소진 방식은 은퇴 후 자산을 영원히 유지한다고 보지 않고, 기대수명까지
              자산이 버틸 수 있는지를 계산합니다.
            </p>
            <p>
              은퇴 전에는 저축으로 자산을 늘리고, 은퇴 후에는 생활비를 인출합니다.
              국민연금이 있다면 특정 나이 이후의 현금흐름으로 반영합니다.
            </p>
            <dl className="help-definition-list">
              <div>
                <dt>은퇴 전</dt>
                <dd>자산 증가 + 저축</dd>
              </div>
              <div>
                <dt>은퇴 후</dt>
                <dd>자산 증가 - 생활비 + 국민연금</dd>
              </div>
            </dl>
            <p>
              목표 인출률 방식보다 현실적인 시뮬레이션에 가깝지만, 기대수명보다 오래 살거나
              수익률이 낮아지면 결과가 달라질 수 있습니다.
            </p>
          </HelpSection>

          <HelpSection id="help-pension" title="5. 국민연금 입력 기준">
            <p>국민연금 월 예상액은 현재 가치 기준으로 입력하세요.</p>
            <p>
              예를 들어 65세 이후 받을 국민연금이 오늘 돈 가치로 월 100만 원 정도라고
              예상된다면, 100만 원을 입력하면 됩니다.
            </p>
            <p>미래 수령 시점의 명목 금액은 물가상승률을 반영해 자동으로 계산됩니다.</p>
            <dl className="help-definition-list">
              <div>
                <dt>입력값</dt>
                <dd>오늘 돈 가치 기준 국민연금</dd>
              </div>
              <div>
                <dt>계산값</dt>
                <dd>미래 시점의 명목 국민연금</dd>
              </div>
            </dl>
            <p>미래에 받을 명목 금액을 그대로 입력하면 결과가 과대평가될 수 있습니다.</p>
          </HelpSection>

          <HelpSection id="help-experiments" title="6. 가정 바꿔보기">
            <p>
              가정 바꿔보기는 현재 입력값은 그대로 두고, 특정 조건만 바꿨을 때 결과가 얼마나
              달라지는지 비교하는 기능입니다.
            </p>
            <p>예를 들어 다음과 같은 질문을 확인할 수 있습니다.</p>
            <ul>
              <li>월 소비가 50만 원 늘면 은퇴가 얼마나 늦어질까?</li>
              <li>월 저축을 100만 원 늘리면 은퇴가 얼마나 빨라질까?</li>
              <li>수익률이 1%p 달라지면 결과가 얼마나 바뀔까?</li>
            </ul>
            <p>이 값은 실제 입력값에 저장되지 않고, 비교 계산에만 사용됩니다.</p>
          </HelpSection>

          <HelpSection id="help-limitations" title="7. 계산기의 한계">
            <p>이 계산기는 입력한 가정을 바탕으로 한 추정 도구입니다.</p>
            <p>
              실제 결과는 투자수익률, 물가상승률, 세금, 건강보험료, 주거비, 자녀 교육비,
              국민연금 제도 변화, 예상보다 긴 수명 등에 따라 달라질 수 있습니다.
            </p>
            <p>
              특히 수익률은 매년 일정하지 않고, 은퇴 직후 큰 하락장이 오면 자산 소진 속도가
              빨라질 수 있습니다.
            </p>
            <p>
              따라서 계산 결과는 확정적인 은퇴 가능 시점이 아니라, 소비·저축·투자 가정이
              장기적으로 어떤 차이를 만드는지 확인하는 참고값으로 봐주세요.
            </p>
          </HelpSection>
        </div>
      </section>
    </div>
  );
}

function HelpSection({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <section className="help-section" id={id}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function FormulaBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="formula-block">
      <span>{label}</span>
      <code>{children}</code>
    </div>
  );
}

function ResultTabs({
  selectedTab,
  onChange,
}: {
  selectedTab: ResultTab;
  onChange: (tab: ResultTab) => void;
}) {
  const tabs = [
    ["summary", "요약"],
    ["monthly", "월별추이"],
    ["experiments", "실험"],
  ] as const;

  return (
    <div className="result-tabs" role="tablist" aria-label="결과 탭">
      {tabs.map(([tab, label]) => (
        <button
          aria-selected={selectedTab === tab}
          className={selectedTab === tab ? "result-tab result-tab-active" : "result-tab"}
          key={tab}
          role="tab"
          type="button"
          onClick={() => onChange(tab)}
        >
          {label}
        </button>
      ))}
    </div>
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

function ImpactSection({ inputs, mode }: { inputs: FireInputs; mode: ImpactMode }) {
  return (
    <section className="chart-card impact-section" aria-labelledby="impact-section-title">
      <div className="impact-heading">
        <p className="eyebrow">EXPERIMENTS</p>
        <h3 id="impact-section-title">가정 바꿔보기</h3>
        <p>
          현재 입력값은 그대로 두고, 특정 가정만 바꿔 FIRE 시점이 얼마나 달라지는지
          비교합니다.
        </p>
      </div>
      <div className="impact-grid">
        <ImpactCard
          inputs={inputs}
          kind="expenses"
          mode={mode}
          options={expenseImpactOptions}
          title="월 소비 영향"
          description="현재 월 소비를 기준으로 FIRE 시점 변화를 비교합니다."
        />
        <ImpactCard
          inputs={inputs}
          kind="savings"
          mode={mode}
          options={savingsImpactOptions}
          title="월 저축 영향"
          description="월 저축은 현재 월 수입에서 월 소비액을 뺀 금액으로 계산합니다."
        />
        <ImpactCard
          inputs={inputs}
          kind="return-rate"
          mode={mode}
          options={returnImpactOptions}
          title="수익률 영향"
          description="명목 연평균 투자 수익률만 바꿔 비교합니다."
        />
      </div>
    </section>
  );
}

function ImpactCard({
  description,
  inputs,
  kind,
  mode,
  options,
  title,
}: {
  description: string;
  inputs: FireInputs;
  kind: ImpactKind;
  mode: ImpactMode;
  options: ImpactOption[];
  title: string;
}) {
  const [selectedDelta, setSelectedDelta] = useState<number | null>(null);
  const selectedOption = options.find((option) => option.delta === selectedDelta) ?? null;
  const impact = selectedOption
    ? calculateImpact(mode, inputs, changeImpactInputs(inputs, kind, selectedOption.delta))
    : null;

  return (
    <article className="impact-card">
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      <div className="impact-options" aria-label={`${title} 선택`}>
        {options.map((option) => (
          <button
            className={selectedDelta === option.delta ? "button-primary" : "button-secondary"}
            key={option.label}
            type="button"
            onClick={() => setSelectedDelta(option.delta)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {impact && selectedOption ? (
        <div className="impact-result">
          <strong>{selectedOption.summaryLabel}</strong>
          <span>
            {mode === "trinity" ? "FIRE 시점" : "최소 근로 기간"}:{" "}
            {formatImpactYears(impact.baseMonths)} → {formatImpactYears(impact.changedMonths)}
          </span>
          <span>변화: {formatImpactChange(impact.diffMonths)}</span>
          {kind === "expenses" && (
            <span>
              {formatRequiredAssetImpact(selectedOption.delta, inputs.targetWithdrawalRate)}
            </span>
          )}
        </div>
      ) : (
        <p className="impact-placeholder">버튼을 선택하면 기준 결과와 변경 결과를 비교합니다.</p>
      )}
    </article>
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
      "국민연금 수령 시작",
      result.nationalPensionStartAge === null ? "계산 불가" : `${result.nationalPensionStartAge}세`,
    ],
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
          차감합니다. 국민연금은 출생연도별 수령 시작 나이부터 더하고, 월 수입과 소비액은
          매년 입력한 증가율을 반영합니다.
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

function AssetChart({
  scenario,
  valueBasis,
}: {
  scenario: FireScenarioResult;
  valueBasis: ValueBasis;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const width = isMobile ? 520 : 760;
  const height = isMobile ? 320 : 280;
  const padding = isMobile
    ? { top: 20, right: 16, bottom: 34, left: 54 }
    : { top: 24, right: 24, bottom: 44, left: 88 };
  const values = scenario.projections.flatMap((row) => [
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
  ]);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const valueRange = maxValue - minValue || 1;
  const maxMonth = Math.max(scenario.projections.at(-1)?.month ?? 1, 1);
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
          <span className="legend-base">투자 가능 자산</span>
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
        <polyline
          className="target-line base-line"
          points={scenario.projections
            .map((row) => toPoint(scenario, row, row.fireTargetAssets))
            .join(" ")}
        />
        <polyline
          className="scenario-line base-line"
          points={scenario.projections
            .map((row) => toPoint(scenario, row, row.investableAssets))
            .join(" ")}
        />
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
                <th>{basisLabel("국민연금", valueBasis)}</th>
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
                        row.nationalPensionIncome,
                        annualInflationRate,
                        row.month,
                        valueBasis,
                      ),
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

function PensionStartAgeNote({ birthYear }: { birthYear: number }) {
  const currentAge = calculateCurrentAgeFromBirthYear(birthYear);
  const startAge = calculateNationalPensionStartAge(birthYear);

  return (
    <p className="pension-start-note">
      현재 나이는 {currentAge}세로 계산하고, 국민연금은 {startAge}세부터 반영합니다.
      1952년 이전 60세, 1953~1956년 61세, 1957~1960년 62세, 1961~1964년
      63세, 1965~1968년 64세, 1969년 이후 65세 기준입니다.
    </p>
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
    birthYear: values.birthYear,
    lifeExpectancy: values.lifeExpectancy,
    nationalPensionMonthlyAmount: values.nationalPensionMonthlyAmount,
  };
}

function loadCachedAppState(): CachedAppState {
  const defaultState = createDefaultAppState();

  if (typeof window === "undefined") {
    return defaultState;
  }

  try {
    const cachedState = window.localStorage.getItem(cacheKey);

    if (!cachedState) {
      return defaultState;
    }

    return normalizeCachedAppState(JSON.parse(cachedState), defaultState);
  } catch {
    return defaultState;
  }
}

function saveCachedAppState(state: CachedAppState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private browsing or restrictive browser settings.
  }
}

function createDefaultAppState(): CachedAppState {
  return {
    version: cacheVersion,
    formValues: presetToFormValues(fireExamplePreset.values),
    calculationMode: "trinity",
    valueBasis: "nominal",
  };
}

function normalizeCachedAppState(
  value: unknown,
  defaultState: CachedAppState,
): CachedAppState {
  if (!isRecord(value) || value.version !== cacheVersion) {
    return defaultState;
  }

  return {
    version: cacheVersion,
    formValues: normalizeCachedFormValues(value.formValues, defaultState.formValues),
    calculationMode: isCalculationMode(value.calculationMode)
      ? value.calculationMode
      : defaultState.calculationMode,
    valueBasis: isValueBasis(value.valueBasis) ? value.valueBasis : defaultState.valueBasis,
  };
}

function normalizeCachedFormValues(value: unknown, defaultValues: FormValues): FormValues {
  if (!isRecord(value)) {
    return defaultValues;
  }

  return numericFormFields.reduce<FormValues>(
    (formValues, field) => {
      const fieldValue = value[field];

      return {
        ...formValues,
        [field]: isNumericFormValue(fieldValue) ? fieldValue : defaultValues[field],
      };
    },
    { ...defaultValues },
  );
}

function isNumericFormValue(value: unknown): value is NumericFormValue {
  return value === "" || (typeof value === "number" && Number.isFinite(value));
}

function isCalculationMode(value: unknown): value is CalculationMode {
  return typeof value === "string" && validCalculationModes.includes(value as CalculationMode);
}

function isValueBasis(value: unknown): value is ValueBasis {
  return typeof value === "string" && validValueBases.includes(value as ValueBasis);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    birthYear: normalizeFormNumber(values.birthYear),
    lifeExpectancy: normalizeFormNumber(values.lifeExpectancy),
    nationalPensionMonthlyAmount: normalizeFormNumber(values.nationalPensionMonthlyAmount),
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

function calculateImpact(
  mode: ImpactMode,
  baseInputs: FireInputs,
  changedInputs: FireInputs,
): {
  baseMonths: number | null;
  changedMonths: number | null;
  diffMonths: number | null;
} {
  if (mode === "depletion") {
    const baseResult = calculateYearsToWork(baseInputs);
    const changedResult = calculateYearsToWork(changedInputs);

    return {
      baseMonths: baseResult.monthsToWork,
      changedMonths: changedResult.monthsToWork,
      diffMonths:
        baseResult.monthsToWork === null || changedResult.monthsToWork === null
          ? null
          : changedResult.monthsToWork - baseResult.monthsToWork,
    };
  }

  const baseResult = calculateFireScenarios(baseInputs)[1];
  const changedResult = calculateFireScenarios(changedInputs)[1];

  return {
    baseMonths: baseResult.monthsToFire,
    changedMonths: changedResult.monthsToFire,
    diffMonths:
      baseResult.monthsToFire === null || changedResult.monthsToFire === null
        ? null
        : changedResult.monthsToFire - baseResult.monthsToFire,
  };
}

function changeImpactInputs(inputs: FireInputs, kind: ImpactKind, delta: number): FireInputs {
  if (kind === "expenses") {
    return {
      ...inputs,
      monthlyExpenses: Math.max(inputs.monthlyExpenses + delta, 0),
    };
  }

  if (kind === "savings") {
    return {
      ...inputs,
      monthlyIncome: Math.max(inputs.monthlyIncome + delta, 0),
    };
  }

  return {
    ...inputs,
    annualNominalReturnRate: inputs.annualNominalReturnRate + delta,
  };
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

function formatImpactYears(months: number | null): string {
  if (months === null) {
    return "계산 불가";
  }

  return `${formatOneDecimal(months / 12)}년`;
}

function formatImpactChange(diffMonths: number | null): string {
  if (diffMonths === null) {
    return "비교 어려움";
  }

  if (Math.abs(diffMonths) < 1) {
    return "거의 변화 없음";
  }

  const direction = diffMonths > 0 ? "늦어짐" : "빨라짐";

  return `${formatOneDecimal(Math.abs(diffMonths) / 12)}년 ${direction}`;
}

function formatRequiredAssetImpact(
  monthlyExpenseDelta: number,
  targetWithdrawalRate: number,
): string {
  const requiredAssetDelta =
    (monthlyExpenseDelta * 12) / Math.max(targetWithdrawalRate, MIN_WITHDRAWAL_RATE);

  if (Math.abs(requiredAssetDelta) < 1) {
    return "추가 필요 자산: 거의 변화 없음";
  }

  if (requiredAssetDelta < 0) {
    return `필요 자산 감소: 약 ${formatMoney(Math.abs(requiredAssetDelta))}`;
  }

  return `추가 필요 자산: 약 ${formatMoney(requiredAssetDelta)}`;
}

function formatWorkRequirementSentence(result: DepletionResult): string {
  if (result.status === "invalid-time-horizon") {
    return "계산할 기간이 없습니다.";
  }

  if (result.status === "not-achievable" || result.monthsToWork === null) {
    return "현재 조건으로는 어렵습니다.";
  }

  if (result.monthsToWork === 0) {
    return "지금 은퇴하셔도 좋습니다.";
  }

  return `앞으로 ${formatWorkDuration(result.monthsToWork)} 더 일해야 합니다.`;
}

function formatDepletionStatus(result: DepletionResult): string {
  if (result.status === "already-sufficient") {
    return "현재 자산만으로도 기대수명까지 현재 소비 수준을 유지할 수 있습니다.";
  }

  if (result.status === "achievable") {
    return "기대수명까지 자산이 마이너스가 되지 않는 가장 빠른 은퇴 시점입니다.";
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

function formatOneDecimal(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value);
}

export default App;
