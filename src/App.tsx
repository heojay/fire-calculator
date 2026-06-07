import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent,
  ReactNode,
  RefObject,
} from "react";
import seoPages from "./seoPages.json";
import {
  FIRE_PRESETS,
  MIN_WITHDRAWAL_RATE,
  calculateFireScenarios,
  calculateNationalPensionStartAge,
  calculatePresentValue,
  calculateYearsToWork,
  inferBirthYearFromCurrentAge,
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
type SeoGuidePage = (typeof seoPages)[number];
type GuideTableData = {
  caption: string;
  headers: string[];
  rows: string[][];
};

type FormValues = {
  investableAssets: NumericFormValue;
  monthlyIncome: NumericFormValue;
  monthlyExpenses: NumericFormValue;
  retirementMonthlyExpenses: NumericFormValue;
  annualNominalReturnRate: NumericFormValue;
  annualInflationRate: NumericFormValue;
  annualIncomeGrowthRate: NumericFormValue;
  targetWithdrawalRate: NumericFormValue;
  currentAge: NumericFormValue;
  childIndependenceAge: NumericFormValue;
  childMonthlyExpenseReduction: NumericFormValue;
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
type InitialAppState = CachedAppState & {
  activeResultTab: ResultTab;
};

type ImpactMode = "trinity" | "depletion";
type ExperimentAdjustmentKey = keyof ExperimentAdjustments;
type ExperimentAdjustments = {
  monthlySavingsDelta: number;
  retirementMonthlyExpensesDelta: number;
  oneTimeSpendingDelta: number;
  annualReturnRateDelta: number;
};
type ChartPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
type ChartPoint = {
  x: number;
  y: number;
};
type TopNavAction =
  | {
      type: "link";
      label: string;
      href: string;
    }
  | {
      type: "button";
      label: string;
      onClick: () => void;
      buttonRef?: RefObject<HTMLButtonElement | null>;
    };

const coreFields = [
  ["investableAssets", "현재 투자자산", "원"],
  ["monthlyIncome", "월 수입", "원"],
  ["monthlyExpenses", "월 소비", "원"],
  ["retirementMonthlyExpenses", "은퇴 후 월 지출", "원"],
] as const;

const advancedAssumptionFields = [
  ["annualNominalReturnRate", "기대수익률", "%"],
  ["annualInflationRate", "연평균 물가 상승률", "%"],
  ["annualIncomeGrowthRate", "연평균 수입 증가율", "%"],
] as const;

const lifestyleFields = [
  ["childIndependenceAge", "자녀 독립 나이", "세"],
  ["childMonthlyExpenseReduction", "독립 후 줄어드는 월 소비", "원"],
] as const;

const depletionFields = [
  ["currentAge", "현재 나이", "세"],
  ["lifeExpectancy", "기대수명", "세"],
] as const;

const pensionFields = [
  ["nationalPensionMonthlyAmount", "국민연금 예상 월 수령액", "원"],
] as const;

const fieldHelpText: Partial<Record<NumericFormField, string>> = {
  monthlyIncome: "매월 저축액은 현재 월 수입에서 월 소비액을 뺀 금액으로 계산합니다.",
  monthlyExpenses:
    "근로 중 월 저축액을 계산할 때 쓰는 현재 월 소비액입니다. 은퇴 후 월 지출은 별도로 입력합니다.",
  retirementMonthlyExpenses:
    "오늘 돈 가치 기준 은퇴 후 월 지출입니다. 목표 자산과 은퇴 후 현금흐름 계산에 사용합니다.",
  annualNominalReturnRate:
    "개인 투자자의 비용, 세금, 위험 감수 차이를 감안해 장기 기본값은 5%로 둡니다.",
  annualInflationRate: "장기 계산에서는 한국은행 물가안정목표에 가까운 2%를 기본값으로 둡니다.",
  annualIncomeGrowthRate:
    "장기 임금과 소득 증가 가정은 과도하게 높이지 않고 3%를 기본값으로 둡니다.",
  targetWithdrawalRate:
    "은퇴 후 자산에서 매년 꺼내 쓸 비율입니다. 낮을수록 필요한 자산이 더 커집니다.",
  currentAge:
    "기대수명 방식, 자녀 독립 시점, 국민연금 수령 시작 나이, 월별 추이의 나이를 계산할 때 쓰는 기준입니다.",
  childIndependenceAge:
    "자녀가 독립할 때의 내 나이입니다. 0을 입력하면 자녀 독립에 따른 소비 감소를 반영하지 않습니다.",
  childMonthlyExpenseReduction:
    "자녀가 독립한 뒤 줄어드는 월 소비 금액입니다. 근로 중 소비와 은퇴 후 월 지출에서 함께 차감합니다.",
  lifeExpectancy:
    "기대수명 방식에서는 이 나이까지 생활비를 감당하는 데 필요한 근로 기간을 계산합니다.",
  nationalPensionMonthlyAmount:
    "오늘 돈 가치 기준 월 예상 수령액입니다. 계산에서는 물가상승률을 반영해 미래 금액으로 환산합니다.",
};

const fireExamplePreset = FIRE_PRESETS.find((preset) => preset.id === "fire-example")!;
const cacheVersion = 5;
const cacheKey = "firecalc:lastState:v5";
const validCalculationModes: CalculationMode[] = ["trinity", "depletion"];
const validValueBases: ValueBasis[] = ["nominal", "present"];
const validResultTabs: ResultTab[] = ["summary", "monthly", "experiments"];
const resultTabOptions = [
  ["summary", "상세 지표"],
  ["monthly", "월별 추이"],
  ["experiments", "가정 비교"],
] as const;
const calculationModeOptions = [
  ["trinity", "목표인출율"],
  ["depletion", "기대수명 방식"],
] as const;
const valueBasisOptions = [
  ["nominal", "미래 금액 기준"],
  ["present", "오늘 돈 가치 기준"],
] as const;
const numericFormFields: NumericFormField[] = [
  "investableAssets",
  "monthlyIncome",
  "monthlyExpenses",
  "retirementMonthlyExpenses",
  "annualNominalReturnRate",
  "annualInflationRate",
  "annualIncomeGrowthRate",
  "targetWithdrawalRate",
  "currentAge",
  "childIndependenceAge",
  "childMonthlyExpenseReduction",
  "lifeExpectancy",
  "nationalPensionMonthlyAmount",
];
const initialExperimentAdjustments: ExperimentAdjustments = {
  monthlySavingsDelta: 0,
  retirementMonthlyExpensesDelta: 0,
  oneTimeSpendingDelta: 0,
  annualReturnRateDelta: 0,
};
const monthlyExperimentStep = 500_000;
const annualReturnRateExperimentStep = 0.01;
const siteOrigin = "https://fire.heojay.dev";
const siteName = "FIRE 계산기";
const guideListPath = "/guides/";
const guideListTitle = "경제적 자립 계산 가이드 | FIRE 계산기";
const guideListDescription =
  "4% 룰, FIRE 유형, 은퇴 생활비, 목표 자산 계산법 등 FIRE 계산기를 이해하는 데 필요한 가이드를 모아 봅니다.";
const oneTimeSpendingSteps = [
  ["100만원", 1_000_000],
  ["1000만원", 10_000_000],
  ["1억원", 100_000_000],
] as const;

function App() {
  if (isGuideListPath()) {
    return <GuideListPage />;
  }

  const guidePage = getGuidePageFromPath();

  if (guidePage) {
    return <GuidePage page={guidePage} />;
  }

  return <CalculatorApp />;
}

function TopNav({
  brandHref,
  actions,
}: {
  brandHref?: string;
  actions: TopNavAction[];
}) {
  const brandClassName = "top-nav-brand top-nav-control";

  return (
    <nav className="top-nav" aria-label="상단">
      {brandHref ? (
        <a className={brandClassName} href={brandHref}>
          FIRE 계산기
        </a>
      ) : (
        <div className={brandClassName}>FIRE 계산기</div>
      )}
      <div className="top-nav-actions">
        {actions.map((action) =>
          action.type === "link" ? (
            <a className="top-nav-action top-nav-control" href={action.href} key={action.label}>
              {action.label}
            </a>
          ) : (
            <button
              className="top-nav-action top-nav-control"
              key={action.label}
              ref={action.buttonRef}
              type="button"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ),
        )}
      </div>
    </nav>
  );
}

function CalculatorApp() {
  const [initialState] = useState(loadInitialAppState);
  const [calculationMode, setCalculationMode] = useState<CalculationMode>(
    initialState.calculationMode,
  );
  const [valueBasis, setValueBasis] = useState<ValueBasis>(initialState.valueBasis);
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>(initialState.activeResultTab);
  const [formValues, setFormValues] = useState<FormValues>(initialState.formValues);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    syncViewStateToUrl({ activeResultTab, calculationMode, valueBasis });
  }, [activeResultTab, calculationMode, valueBasis]);

  const handleFieldChange = (field: NumericFormField, value: string) => {
    setFormValues((current) => ({
      ...current,
      [field]: value === "" ? "" : Number(value),
    }));
  };

  return (
    <>
      <a className="skip-link" href="#calculator-content">
        본문으로 건너뛰기
      </a>
      <main id="calculator-content">
      <header className="hero-band">
        <TopNav
          actions={[
            { type: "link", label: "가이드", href: guideListPath },
            {
              type: "button",
              label: "계산 기준",
              buttonRef: helpButtonRef,
              onClick: () => setIsHelpOpen(true),
            },
          ]}
        />

        <section className="hero-grid" aria-labelledby="calculator-title">
          <h1 className="hero-title" id="calculator-title">
            몇 년 더 일하면 경제적 자립이 가능할까?
          </h1>
          <p className="lead">
            월 소득, 생활비, 투자자산을 입력하면 예상 FIRE 시점을 계산합니다.
          </p>
        </section>
      </header>

        <section
          aria-labelledby="calculator-title"
          className="content-grid"
        >
          <section className="input-panel">
            <ModeTabs selectedMode={calculationMode} onChange={setCalculationMode} />

            <Fieldset title="핵심 입력">
              {coreFields.map(([field, label, suffix]) => (
                <NumberField
                  field={field}
                  key={field}
                  label={label}
                  suffix={suffix}
                  value={formValues[field]}
                  helpText={fieldHelpText[field]}
                  onChange={(value) => handleFieldChange(field, value)}
                />
              ))}
            </Fieldset>

            <AdvancedFieldset title="고급 옵션">
              {advancedAssumptionFields.map(([field, label, suffix]) => (
                <NumberField
                  field={field}
                  key={field}
                  label={label}
                  suffix={suffix}
                  value={formValues[field]}
                  helpText={fieldHelpText[field]}
                  onChange={(value) => handleFieldChange(field, value)}
                />
              ))}
            </AdvancedFieldset>

            {calculationMode === "trinity" && (
              <AdvancedFieldset title="목표인출율 옵션">
                <NumberField
                  field="targetWithdrawalRate"
                  label="목표인출율"
                  suffix="%"
                  value={formValues.targetWithdrawalRate}
                  helpText={fieldHelpText.targetWithdrawalRate}
                  onChange={(value) => handleFieldChange("targetWithdrawalRate", value)}
                />
              </AdvancedFieldset>
            )}

            {calculationMode === "depletion" && (
              <AdvancedFieldset title="기대수명 방식 옵션">
                {depletionFields.map(([field, label, suffix]) => (
                  <NumberField
                    field={field}
                    key={field}
                    label={label}
                    suffix={suffix}
                    value={formValues[field]}
                    helpText={fieldHelpText[field]}
                    onChange={(value) => handleFieldChange(field, value)}
                  />
                ))}
                {lifestyleFields.map(([field, label, suffix]) => (
                  <NumberField
                    field={field}
                    key={field}
                    label={label}
                    suffix={suffix}
                    value={formValues[field]}
                    helpText={fieldHelpText[field]}
                    onChange={(value) => handleFieldChange(field, value)}
                  />
                ))}
                {pensionFields.map(([field, label, suffix]) => (
                  <NumberField
                    field={field}
                    key={field}
                    label={label}
                    suffix={suffix}
                    value={formValues[field]}
                    helpText={fieldHelpText[field]}
                    onChange={(value) => handleFieldChange(field, value)}
                  />
                ))}
                <PensionStartAgeNote currentAge={normalizeFormNumber(formValues.currentAge)} />
              </AdvancedFieldset>
            )}
          </section>

          <section className="results-panel">
            <div className="section-heading results-heading">
              <div>
                <h2>계산 결과</h2>
              </div>
              <div className="results-controls">
                <ValueBasisTabs selectedBasis={valueBasis} onChange={setValueBasis} />
              </div>
            </div>

            <ResultSnapshot
              mode={calculationMode}
              inputs={inputs}
              scenario={baseScenario}
              depletionResult={depletionResult}
              valueBasis={valueBasis}
            />

            <ResultTabs selectedTab={activeResultTab} onChange={setActiveResultTab} />

            {activeResultTab === "summary" && (
              <ResultTabPanel tab="summary">
                {calculationMode === "trinity" ? (
                  <SummaryGrid scenario={baseScenario} valueBasis={valueBasis} />
                ) : (
                  <DepletionSummary
                    annualInflationRate={inputs.annualInflationRate}
                    result={depletionResult}
                    valueBasis={valueBasis}
                  />
                )}
              </ResultTabPanel>
            )}

            {activeResultTab === "monthly" && (
              <ResultTabPanel tab="monthly">
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
                        title="경제적 자립 목표 자산 추이"
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
              </ResultTabPanel>
            )}

            {activeResultTab === "experiments" && (
              <ResultTabPanel tab="experiments">
                <ImpactSection
                  inputs={inputs}
                  mode={calculationMode === "trinity" ? "trinity" : "depletion"}
                />
              </ResultTabPanel>
            )}

            <ResultCaution />
          </section>
        </section>

      <footer className="site-footer">
        만든 사람{" "}
        <a href="https://heojay.dev" target="_blank" rel="noreferrer">
          heojay.dev
        </a>
      </footer>

      {isHelpOpen && (
        <HelpDialog
          onClose={() => {
            setIsHelpOpen(false);
            window.setTimeout(() => helpButtonRef.current?.focus(), 0);
          }}
        />
      )}
      </main>
    </>
  );
}

function GuideListPage() {
  useEffect(() => {
    applyGuideListMetadata();
  }, []);

  return (
    <>
      <a className="skip-link" href="#guide-list-content">
        본문으로 건너뛰기
      </a>
      <main className="guide-page" id="guide-list-content">
        <header className="guide-hero">
          <TopNav
            brandHref="/"
            actions={[{ type: "link", label: "계산기 열기", href: "/" }]}
          />

          <div className="guide-hero-grid">
            <div className="guide-hero-copy">
              <h1 className="hero-title">경제적 자립 계산 가이드</h1>
              <p className="lead">
                4% 룰, FIRE 유형, 은퇴 생활비, 목표 자산 계산법처럼 계산 결과를
                해석할 때 필요한 글을 한곳에 모았습니다.
              </p>
            </div>
          </div>
        </header>

        <section className="guide-list-section" aria-labelledby="guide-list-title">
          <div className="guide-link-heading">
            <h2 id="guide-list-title">전체 가이드</h2>
          </div>
          <div className="guide-link-grid guide-list-grid">
            {seoPages.map((page) => (
              <a className="guide-link-card guide-list-card" href={page.path} key={page.slug}>
                <span className="guide-card-kicker">가이드</span>
                <strong>{page.h1}</strong>
                <p>{page.description}</p>
              </a>
            ))}
          </div>
        </section>

        <footer className="site-footer">
          만든 사람{" "}
          <a href="https://heojay.dev" target="_blank" rel="noreferrer">
            heojay.dev
          </a>
        </footer>
      </main>
    </>
  );
}

function GuidePage({ page }: { page: SeoGuidePage }) {
  useEffect(() => {
    applyPageMetadata(page);
  }, [page]);

  return (
    <>
      <a className="skip-link" href="#guide-content">
        본문으로 건너뛰기
      </a>
      <main className="guide-page" id="guide-content">
        <header className="guide-hero">
          <TopNav
            brandHref="/"
            actions={[
              { type: "link", label: "가이드", href: guideListPath },
              { type: "link", label: "계산기 열기", href: "/" },
            ]}
          />

          <div className="guide-hero-grid">
            <div className="guide-hero-copy">
              <h1 className="hero-title">{page.h1}</h1>
              <p className="lead">{page.lead}</p>
            </div>
          </div>
        </header>

        <section className="guide-summary" aria-label="핵심 요약">
          {page.summary.map((item, index) => (
            <article className="guide-summary-item" key={item}>
              <span aria-hidden="true">{index + 1}</span>
              <p>{item}</p>
            </article>
          ))}
        </section>

        <div className="guide-layout">
          <article className="guide-article">
            {page.sections.map((section) => (
              <section className="guide-section" key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {hasGuideTable(section) && <GuideTable table={section.table} />}
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="guide-section guide-faq">
              <h2>자주 묻는 질문</h2>
              {page.faq.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </section>
          </article>

          <aside className="guide-aside" aria-label="관련 도구">
            <div>
              <h2>내 조건으로 다시 계산하기</h2>
              <p>
                현재 보유 자산, 월 수입, 은퇴 후 지출, 국민연금 예상액을 입력해
                경제적 자립까지의 거리를 확인하세요.
              </p>
            </div>
            <a className="button-primary" href="/">
              FIRE 계산기 사용하기
            </a>
          </aside>
        </div>

        <SeoGuideLinks currentPath={page.path} />

        <footer className="site-footer">
          만든 사람{" "}
          <a href="https://heojay.dev" target="_blank" rel="noreferrer">
            heojay.dev
          </a>
        </footer>
      </main>
    </>
  );
}

function SeoGuideLinks({ currentPath }: { currentPath?: string }) {
  const [linkedPage] = useState(() => getRandomGuidePage(currentPath));

  return (
    <section className="guide-link-section" aria-labelledby="guide-link-title">
      <div className="guide-link-heading">
        <h2 id="guide-link-title">경제적 자립 계산 가이드</h2>
      </div>
      <div className="guide-link-feature">
        {linkedPage && (
          <a className="guide-link-card" href={linkedPage.path}>
            <span className="guide-card-kicker">추천 가이드</span>
            <strong>{linkedPage.h1}</strong>
            <p>{linkedPage.description}</p>
          </a>
        )}
        <a className="button-secondary guide-more-link" href={guideListPath}>
          더보기
        </a>
      </div>
    </section>
  );
}

function hasGuideTable(
  section: SeoGuidePage["sections"][number],
): section is SeoGuidePage["sections"][number] & { table: GuideTableData } {
  return "table" in section && Boolean(section.table);
}

function GuideTable({ table }: { table: GuideTableData }) {
  return (
    <div className="guide-table-scroll">
      <table className="guide-table">
        <caption>{table.caption}</caption>
        <thead>
          <tr>
            {table.headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) => (
                <td key={`${table.headers[index] ?? index}-${cell}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getRandomGuidePage(currentPath?: string): SeoGuidePage | null {
  const linkedPages = seoPages.filter(
    (page) => normalizePathname(page.path) !== normalizePathname(currentPath ?? ""),
  );

  if (linkedPages.length === 0) {
    return null;
  }

  return linkedPages[Math.floor(Math.random() * linkedPages.length)];
}

function isGuideListPath(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return normalizePathname(window.location.pathname) === guideListPath;
}

function getGuidePageFromPath(): SeoGuidePage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const pathname = normalizePathname(window.location.pathname);

  return seoPages.find((page) => normalizePathname(page.path) === pathname) ?? null;
}

function normalizePathname(pathname: string): string {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function applyPageMetadata(page: SeoGuidePage) {
  const canonicalUrl = `${siteOrigin}${page.path}`;

  document.title = page.title;
  setMeta("name", "description", page.description);
  setCanonical(canonicalUrl);
  setMeta("property", "og:type", "article");
  setMeta("property", "og:url", canonicalUrl);
  setMeta("property", "og:title", page.title);
  setMeta("property", "og:description", page.description);
  setMeta("property", "og:image", `${siteOrigin}/og-image.png`);
  setMeta("property", "og:image:alt", page.h1);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", page.title);
  setMeta("name", "twitter:description", page.description);
  setMeta("name", "twitter:image", `${siteOrigin}/twitter-image.png`);
  setMeta("name", "twitter:image:alt", page.h1);
  setJsonLd(createGuideJsonLd(page));
}

function applyGuideListMetadata() {
  const canonicalUrl = `${siteOrigin}${guideListPath}`;

  document.title = guideListTitle;
  setMeta("name", "description", guideListDescription);
  setCanonical(canonicalUrl);
  setMeta("property", "og:type", "website");
  setMeta("property", "og:url", canonicalUrl);
  setMeta("property", "og:title", guideListTitle);
  setMeta("property", "og:description", guideListDescription);
  setMeta("property", "og:image", `${siteOrigin}/og-image.png`);
  setMeta("property", "og:image:alt", "경제적 자립 계산 가이드");
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", guideListTitle);
  setMeta("name", "twitter:description", guideListDescription);
  setMeta("name", "twitter:image", `${siteOrigin}/twitter-image.png`);
  setMeta("name", "twitter:image:alt", "경제적 자립 계산 가이드");
  setJsonLd(createGuideListJsonLd());
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }

  meta.content = content;
}

function setCanonical(href: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }

  canonical.href = href;
}

function setJsonLd(data: unknown) {
  const scriptId = "page-json-ld";
  let script = document.head.querySelector<HTMLScriptElement>(`#${scriptId}`);

  if (!script) {
    script = document.createElement("script");
    script.id = scriptId;
    script.type = "application/ld+json";
    document.head.append(script);
  }

  script.textContent = JSON.stringify(data);
}

function createGuideJsonLd(page: SeoGuidePage) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteOrigin}${page.path}#faq`,
    name: page.title,
    description: page.description,
    url: `${siteOrigin}${page.path}`,
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function createGuideListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteOrigin}${guideListPath}#guides`,
    name: guideListTitle,
    description: guideListDescription,
    url: `${siteOrigin}${guideListPath}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: seoPages.map((page, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteOrigin}${page.path}`,
        name: page.h1,
      })),
    },
  };
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
            <h2 id={titleId}>계산 기준 도움말</h2>
          </div>
          <button
            aria-label="계산 기준 도움말 닫기"
            className="help-close-button"
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <nav className="help-toc" aria-label="계산 기준 도움말 목차">
          <a href="#help-formulas">1. 주요 계산식</a>
          <a href="#help-value-basis">2. 미래 금액과 오늘 돈 가치</a>
          <a href="#help-withdrawal-rate">3. 목표인출율</a>
          <a href="#help-depletion">4. 기대수명 방식</a>
          <a href="#help-pension">5. 국민연금 입력 기준</a>
          <a href="#help-experiments">6. 가정 비교</a>
          <a href="#help-limitations">7. 계산기의 한계</a>
        </nav>

        <div className="help-content">
          <HelpSection id="help-formulas" title="1. 주요 계산식">
            <p>월 저축액은 월 수입에서 현재 월 소비액을 뺀 금액입니다.</p>
            <FormulaBlock label="월 저축액">
              월 저축액 = 월 수입 - 현재 월 소비액
            </FormulaBlock>
            <p>은퇴 전 월별 자산은 월 수익률과 월 저축액을 반영해 계산합니다.</p>
            <FormulaBlock label="월별 자산 변화">
              다음 달 자산 = 현재 자산 × (1 + 월 수익률) + 월 저축액
            </FormulaBlock>
            <p>
              은퇴 후에는 월 저축액 대신 은퇴 후 월 지출과 국민연금 수령액을 반영합니다.
            </p>
            <FormulaBlock label="은퇴 후 자산">
              은퇴 후 자산 = 현재 자산 × (1 + 월 수익률) - 은퇴 후 월 지출 + 국민연금
            </FormulaBlock>
            <p>목표인출율 방식의 필요 자산은 은퇴 후 연간 지출을 목표인출율로 나눕니다.</p>
            <FormulaBlock label="목표 자산">
              필요 자산 = 은퇴 후 월 지출 × 12 ÷ 목표인출율
            </FormulaBlock>
            <p>
              예를 들어 은퇴 후 월 지출이 400만 원이고 목표인출율이 3.5%라면 4,800만 원 ÷
              0.035 = 약 13.7억 원입니다.
            </p>
            <FormulaBlock label="은퇴 후 월 지출 증가에 따른 추가 필요 자산">
              추가 필요 자산 = 추가 은퇴 후 월 지출 × 12 ÷ 목표인출율
            </FormulaBlock>
            <p>
              예를 들어 은퇴 후 월 지출이 50만 원 늘고 목표인출율이 3.5%라면 600만 원 ÷
              0.035 = 약 1.7억 원입니다.
            </p>
          </HelpSection>

          <HelpSection id="help-value-basis" title="2. 미래 금액과 오늘 돈 가치">
            <p>미래 금액 기준은 미래 시점에 실제로 필요한 금액입니다.</p>
            <p>오늘 돈 가치 기준은 미래 금액을 오늘 돈의 가치로 환산한 금액입니다.</p>
            <dl className="help-definition-list">
              <div>
                <dt>미래 금액</dt>
                <dd>미래에 실제 필요한 금액</dd>
              </div>
              <div>
                <dt>오늘 돈 가치</dt>
                <dd>오늘 돈 기준으로 환산한 금액</dd>
              </div>
            </dl>
            <p>
              예를 들어 20년 후 20억 원이 필요하더라도, 물가상승률을 반영하면 오늘 돈
              가치로는 더 낮게 보일 수 있습니다.
            </p>
          </HelpSection>

          <HelpSection id="help-withdrawal-rate" title="3. 목표인출율">
            <p>
              목표인출율은 은퇴 후 매년 자산의 일정 비율을 꺼내 쓴다고 가정해 은퇴 후
              월 지출을 감당하는 데 필요한 자산을 계산합니다.
            </p>
            <FormulaBlock label="목표인출율">
              필요 자산 = 은퇴 후 월 지출 × 12 ÷ 목표인출율
            </FormulaBlock>
            <p>목표인출율이 낮을수록 더 보수적인 계산입니다.</p>
            <ul>
              <li>4.0%: 연간 지출의 25배 필요</li>
              <li>3.5%: 연간 지출의 약 28.6배 필요</li>
              <li>3.0%: 연간 지출의 약 33.3배 필요</li>
            </ul>
            <p>
              이 방식은 단순하고 직관적이지만, 국민연금이나 은퇴 후 현금흐름을 세밀하게
              반영하기는 어렵습니다.
            </p>
            <p>
              이 방식의 그래프는 최대 50년까지 표시합니다. 목표 자산을 달성한
              뒤에는 근로소득과 국민연금 없이 투자 수익률과 은퇴 후 월 지출만 반영한 자산
              추이를 이어서 보여줍니다.
            </p>
          </HelpSection>

          <HelpSection id="help-depletion" title="4. 기대수명 방식">
            <p>
              기대수명 방식은 은퇴 후 자산을 영원히 유지한다고 보지 않고, 기대수명까지
              자산이 유지되는지를 계산합니다.
            </p>
            <p>
              은퇴 전에는 현재 소비를 제외한 저축으로 자산을 늘리고, 은퇴 후에는 은퇴 후
              월 지출을 인출합니다.
              국민연금이 있다면 특정 나이 이후의 현금흐름으로 반영합니다.
            </p>
            <p>
              계산 기간과 그래프의 나이는 현재 나이를 공통 기준으로 씁니다. 국민연금
              수령 시작 나이는 현재 나이로 출생연도를 유추해 적용합니다.
            </p>
            <p>
              자녀 독립 나이와 독립 후 줄어드는 월 소비를 입력하면, 그 나이 이후 현재
              월 소비액과 은퇴 후 월 지출에서 같은 금액을 차감합니다.
            </p>
            <dl className="help-definition-list">
              <div>
                <dt>은퇴 전</dt>
                <dd>자산 증가 + 저축</dd>
              </div>
              <div>
                <dt>은퇴 후</dt>
                <dd>자산 증가 - 은퇴 후 월 지출 + 국민연금</dd>
              </div>
              <div>
                <dt>자녀 독립 나이</dt>
                <dd>자녀가 독립할 때의 내 나이</dd>
              </div>
              <div>
                <dt>줄어드는 월 소비</dt>
                <dd>오늘 돈 가치 기준 월 지출 감소액</dd>
              </div>
            </dl>
            <p>
              생활 변화 감소액은 물가상승률을 반영해 미래 명목 금액으로 환산합니다. 자녀
              독립 나이를 0으로 두면 이 가정은 반영하지 않습니다.
            </p>
            <p>
              목표인출율 방식보다 현실적인 시뮬레이션에 가깝지만, 기대수명보다 오래 살거나
              수익률이 낮아지면 결과가 달라질 수 있습니다.
            </p>
          </HelpSection>

          <HelpSection id="help-pension" title="5. 국민연금 입력 기준">
            <p>국민연금 월 예상액은 오늘 돈 가치 기준으로 입력하세요.</p>
            <p>
              국민연금 수령 시작 나이는 현재 나이로 출생연도를 유추한 뒤 출생연도별
              노령연금 지급개시연령 기준으로 계산합니다.
            </p>
            <p>
              예를 들어 65세 이후 받을 국민연금이 오늘 돈 가치로 월 100만 원 정도라고
              예상된다면, 100만 원을 입력하면 됩니다.
            </p>
            <p>미래 수령 시점의 명목 금액은 물가상승률을 반영해 자동으로 계산됩니다.</p>
            <dl className="help-definition-list">
              <div>
                <dt>입력 기준</dt>
                <dd>오늘 돈 가치 기준 국민연금</dd>
              </div>
              <div>
                <dt>계산값</dt>
                <dd>미래 시점의 국민연금</dd>
              </div>
            </dl>
            <p>미래에 받을 명목 금액을 그대로 입력하면 결과가 과대평가될 수 있습니다.</p>
          </HelpSection>

          <HelpSection id="help-experiments" title="6. 가정 비교">
            <p>
              가정 비교는 현재 조건을 저장하지 않고, 여러 조건을 동시에 조정했을 때
              결과가 얼마나 달라지는지 비교하는 기능입니다.
            </p>
            <p>예를 들어 다음과 같은 질문을 확인할 수 있습니다.</p>
            <ul>
              <li>월 저축액을 50만 원 단위로 조정하면 결과가 얼마나 달라질까?</li>
              <li>은퇴 후 월 지출을 50만 원 단위로 조정하면 결과가 얼마나 달라질까?</li>
              <li>일회성 지출을 선택한 단위로 반영하면 결과가 얼마나 달라질까?</li>
              <li>연평균 투자 수익률을 1%p 단위로 조정하면 결과가 얼마나 달라질까?</li>
            </ul>
            <p>비교 가정은 실제 조건에 저장되지 않고, 비교 계산에만 사용됩니다.</p>
          </HelpSection>

          <HelpSection id="help-limitations" title="7. 계산기의 한계">
            <p>이 계산기는 입력한 가정을 바탕으로 한 추정 도구입니다.</p>
            <p>
              실제 결과는 투자수익률, 물가상승률, 세금, 건강보험료, 주거비, 자녀 교육비의
              세부 변화, 국민연금 제도 변화, 예상보다 긴 수명 등에 따라 달라질 수 있습니다.
            </p>
            <p>
              특히 수익률은 매년 일정하지 않고, 은퇴 직후 큰 하락장이 오면 자산 소진 속도가
              빨라질 수 있습니다.
            </p>
            <p>
              따라서 계산 결과는 확정적인 은퇴일이 아니라, 소비·저축·투자 가정이
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
  return (
    <div
      className="result-tabs"
      role="tablist"
      aria-label="결과 탭"
      onKeyDown={(event) =>
        handleRovingTabKey(event, validResultTabs, selectedTab, onChange)
      }
    >
      {resultTabOptions.map(([tab, label]) => (
        <button
          aria-controls={getResultPanelId(tab)}
          aria-selected={selectedTab === tab}
          className={selectedTab === tab ? "result-tab result-tab-active" : "result-tab"}
          id={getResultTabId(tab)}
          key={tab}
          role="tab"
          tabIndex={selectedTab === tab ? 0 : -1}
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
  return (
    <div
      className="mode-tabs"
      role="tablist"
      aria-label="계산 모드"
      onKeyDown={(event) =>
        handleRovingTabKey(event, validCalculationModes, selectedMode, onChange)
      }
    >
      {calculationModeOptions.map(([mode, label]) => (
        <button
          aria-selected={selectedMode === mode}
          className={selectedMode === mode ? "mode-tab mode-tab-active" : "mode-tab"}
          key={mode}
          role="tab"
          tabIndex={selectedMode === mode ? 0 : -1}
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
  return (
    <div
      className="mode-tabs value-basis-tabs"
      role="tablist"
      aria-label="금액 표시 기준"
      onKeyDown={(event) =>
        handleRovingTabKey(event, validValueBases, selectedBasis, onChange)
      }
    >
      {valueBasisOptions.map(([basis, label]) => (
        <button
          aria-selected={selectedBasis === basis}
          className={selectedBasis === basis ? "mode-tab mode-tab-active" : "mode-tab"}
          key={basis}
          role="tab"
          tabIndex={selectedBasis === basis ? 0 : -1}
          type="button"
          onClick={() => onChange(basis)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ResultTabPanel({ children, tab }: { children: ReactNode; tab: ResultTab }) {
  return (
    <div
      aria-labelledby={getResultTabId(tab)}
      className="result-tab-panel"
      id={getResultPanelId(tab)}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

function getResultTabId(tab: ResultTab): string {
  return `result-tab-${tab}`;
}

function getResultPanelId(tab: ResultTab): string {
  return `result-panel-${tab}`;
}

function handleRovingTabKey<T extends string>(
  event: ReactKeyboardEvent<HTMLDivElement>,
  options: readonly T[],
  selectedValue: T,
  onChange: (value: T) => void,
) {
  const keyOffset: Partial<Record<string, number>> = {
    ArrowLeft: -1,
    ArrowUp: -1,
    ArrowRight: 1,
    ArrowDown: 1,
  };
  const currentIndex = options.indexOf(selectedValue);
  const offset = keyOffset[event.key];
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : offset === undefined
          ? -1
          : (currentIndex + offset + options.length) % options.length;

  if (nextIndex < 0) {
    return;
  }

  event.preventDefault();
  onChange(options[nextIndex]);
  event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
}

function ResultSnapshot({
  mode,
  inputs,
  scenario,
  depletionResult,
  valueBasis,
}: {
  mode: CalculationMode;
  inputs: FireInputs;
  scenario: FireScenarioResult;
  depletionResult: DepletionResult;
  valueBasis: ValueBasis;
}) {
  const monthlySavings = inputs.monthlyIncome - inputs.monthlyExpenses;
  const targetMonth =
    mode === "depletion" ? (getDepletionPeakMonth(depletionResult) ?? 0) : 0;
  const targetAssets =
    mode === "depletion"
      ? (depletionResult.peakAssets ?? depletionResult.finalAssets ?? scenario.currentFireTargetAssets)
      : scenario.currentFireTargetAssets;
  const displayTargetAssets = toDisplayMoney(
    targetAssets,
    inputs.annualInflationRate,
    targetMonth,
    valueBasis,
  );
  const targetProgress = targetAssets <= 0 ? 100 : (inputs.investableAssets / targetAssets) * 100;
  const timing = mode === "depletion" ? formatDepletionTiming(depletionResult) : formatMonthsToFire(scenario);
  const retirementAge =
    mode === "depletion"
      ? depletionResult.retirementAge
      : scenario.monthsToFire === null
        ? null
        : inputs.currentAge + scenario.monthsToFire / 12;
  const statusText = formatResultStatus({
    mode,
    scenario,
    depletionResult,
    retirementAge,
  });
  const assumptionText = `연 ${formatPercentRate(
    inputs.annualNominalReturnRate,
  )} 수익률, 매달 ${formatMoney(monthlySavings)} 저축, 은퇴 후 월 ${formatMoney(
    inputs.retirementMonthlyExpenses,
  )} 지출 기준`;
  const interpretationText = formatResultInterpretation({
    mode,
    inputs,
    targetAssets,
    targetProgress,
    scenario,
    depletionResult,
  });
  const metrics = [
    ["필요 자산", formatMoney(displayTargetAssets)],
    ["매달 남는 돈", `${formatMoney(monthlySavings)} / 월`],
    ["목표까지 채운 비율", formatProgressPercent(targetProgress)],
    ["은퇴 예상 나이", formatRetirementAge(retirementAge)],
  ];

  return (
    <aside className="result-snapshot" aria-label="핵심 계산 결과" aria-live="polite">
      <div className="result-snapshot-main">
        <p className="card-label">예상 FIRE 시점</p>
        <strong>{timing}</strong>
        <span>{statusText}</span>
      </div>
      <p className="result-assumption">{assumptionText}</p>
      <dl className="result-snapshot-grid">
        {metrics.map(([label, value]) => (
          <div className="snapshot-metric" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="result-interpretation">{interpretationText}</p>
    </aside>
  );
}

function formatResultStatus({
  depletionResult,
  mode,
  retirementAge,
  scenario,
}: {
  depletionResult: DepletionResult;
  mode: CalculationMode;
  retirementAge: number | null;
  scenario: FireScenarioResult;
}): string {
  if (mode === "depletion") {
    if (depletionResult.status === "invalid-time-horizon") {
      return "기대수명이 현재 나이보다 커야 계산할 수 있습니다.";
    }

    if (depletionResult.status === "not-achievable") {
      return "입력한 조건에서는 정해진 나이까지 자산을 유지하기 어렵습니다.";
    }

    return `현재 조건을 유지하면 ${formatRetirementAge(retirementAge)}에 경제적 자립이 가능합니다.`;
  }

  if (scenario.status === "not-achieved") {
    return "현재 조건으로는 50년 안에 목표 자산에 도달하기 어렵습니다.";
  }

  if (scenario.monthsToFire === 0) {
    return "이미 현재 자산이 경제적 자립 목표를 충족합니다.";
  }

  return `현재 조건을 유지하면 ${formatRetirementAge(retirementAge)}에 경제적 자립이 가능합니다.`;
}

function formatResultInterpretation({
  depletionResult,
  inputs,
  mode,
  scenario,
  targetAssets,
  targetProgress,
}: {
  depletionResult: DepletionResult;
  inputs: FireInputs;
  mode: CalculationMode;
  scenario: FireScenarioResult;
  targetAssets: number;
  targetProgress: number;
}): string {
  if (mode === "depletion") {
    if (depletionResult.status === "invalid-time-horizon") {
      return "현재 나이보다 높은 기대수명을 입력하면 자산이 유지되는 은퇴 시점을 다시 계산합니다.";
    }

    if (depletionResult.status === "not-achievable") {
      return "저축액을 늘리거나 은퇴 후 지출을 낮추면 기대수명 방식의 결과가 개선됩니다.";
    }

    return `은퇴 전에는 매달 ${formatMoney(
      inputs.monthlyIncome - inputs.monthlyExpenses,
    )}을 더하고, 은퇴 후에는 생활비와 국민연금을 반영해 기대수명까지 자산이 0 아래로 내려가지 않는 시점을 찾았습니다.`;
  }

  if (scenario.status === "not-achieved") {
    return `현재 자산은 목표의 ${formatProgressPercent(
      targetProgress,
    )}입니다. 저축액, 수익률, 은퇴 후 지출 가정을 바꾸면 도달 가능성을 비교할 수 있습니다.`;
  }

  return `필요 자산은 ${formatMoney(targetAssets)}이고 현재 자산은 목표의 ${formatProgressPercent(
    targetProgress,
  )}입니다. 부족한 차이를 매달 저축액과 투자수익으로 메우는 시점을 계산했습니다.`;
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
    ["현재 필요한 자산", formatScenarioMoney(scenario.currentFireTargetAssets, 0)],
    ["목표인출율", `${rateToPercentInput(scenario.inputs.targetWithdrawalRate)}%`],
    [
      basisLabel("은퇴 시 필요한 자산", valueBasis),
      scenario.retirementFireTargetAssets === null
        ? "기준 충족 어려움"
        : formatScenarioMoney(scenario.retirementFireTargetAssets, retirementMonth),
    ],
    [
      basisLabel("은퇴 시 예상 투자 가능 자산", valueBasis),
      scenario.retirementInvestableAssets === null
        ? "기준 충족 어려움"
        : formatScenarioMoney(scenario.retirementInvestableAssets, retirementMonth),
    ],
    [
      basisLabel("은퇴 후 첫 달 예상 지출", valueBasis),
      scenario.retirementMonthlyExpenses === null
        ? "기준 충족 어려움"
        : `${formatScenarioMoney(
            scenario.retirementFirstMonthExpenses ?? scenario.retirementMonthlyExpenses,
            retirementFirstExpenseMonth,
          )} / 월`,
    ],
    [
      basisLabel("은퇴 후 안전 인출 가능 금액", valueBasis),
      scenario.retirementSafeWithdrawalAmount === null
        ? "기준 충족 어려움"
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
  const [adjustments, setAdjustments] = useState<ExperimentAdjustments>(
    initialExperimentAdjustments,
  );
  const [oneTimeSpendingStep, setOneTimeSpendingStep] = useState<number>(
    oneTimeSpendingSteps[0][1],
  );
  const timingLabel =
    mode === "trinity" ? "경제적 자립 시점" : "기대수명 기준 자립 가능 은퇴 시점";
  const hasAdjustments = hasExperimentAdjustments(adjustments);
  const changedInputs = useMemo(
    () => applyExperimentAdjustments(inputs, adjustments),
    [adjustments, inputs],
  );
  const impact = useMemo(
    () => calculateImpact(mode, inputs, changedInputs),
    [changedInputs, inputs, mode],
  );
  const baseMonthlySavings = inputs.monthlyIncome - inputs.monthlyExpenses;
  const changedMonthlySavings = changedInputs.monthlyIncome - changedInputs.monthlyExpenses;

  const updateAdjustment = (key: ExperimentAdjustmentKey, delta: number) => {
    setAdjustments((current) => ({
      ...current,
      [key]: current[key] + delta,
    }));
  };

  return (
    <section className="chart-card impact-section" aria-labelledby="impact-section-title">
      <div className="impact-heading">
        <div>
          <h3 id="impact-section-title">가정 비교</h3>
          <p>
            현재 조건은 저장하지 않고, 여러 가정을 함께 조정했을 때 {timingLabel}이
            얼마나 달라지는지 비교합니다.
          </p>
        </div>
        <button
          className="button-secondary impact-reset-button"
          disabled={!hasAdjustments}
          type="button"
          onClick={() => setAdjustments(initialExperimentAdjustments)}
        >
          초기화
        </button>
      </div>

      <div className="impact-layout">
        <div className="impact-controls" aria-label="가정 조정">
          <ImpactStepper
            description="월 저축액을 50만 원 단위로 조정해 비교합니다."
            decrementLabel="월 저축액 50만 원 줄이기"
            incrementLabel="월 저축액 50만 원 늘리기"
            label="월 저축액"
            value={adjustments.monthlySavingsDelta}
            valueLabel={formatSignedMoney(adjustments.monthlySavingsDelta)}
            onDecrement={() => updateAdjustment("monthlySavingsDelta", -monthlyExperimentStep)}
            onIncrement={() => updateAdjustment("monthlySavingsDelta", monthlyExperimentStep)}
          />
          <ImpactStepper
            description="은퇴 후 월 지출을 50만 원 단위로 조정해 비교합니다."
            decrementLabel="은퇴 후 월 지출 50만 원 줄이기"
            incrementLabel="은퇴 후 월 지출 50만 원 늘리기"
            label="은퇴 후 월 지출"
            value={adjustments.retirementMonthlyExpensesDelta}
            valueLabel={formatSignedMoney(adjustments.retirementMonthlyExpensesDelta)}
            onDecrement={() =>
              updateAdjustment("retirementMonthlyExpensesDelta", -monthlyExperimentStep)
            }
            onIncrement={() =>
              updateAdjustment("retirementMonthlyExpensesDelta", monthlyExperimentStep)
            }
          />
          <OneTimeSpendingControl
            selectedStep={oneTimeSpendingStep}
            value={adjustments.oneTimeSpendingDelta}
            onChangeStep={setOneTimeSpendingStep}
            onDecrement={() => updateAdjustment("oneTimeSpendingDelta", -oneTimeSpendingStep)}
            onIncrement={() => updateAdjustment("oneTimeSpendingDelta", oneTimeSpendingStep)}
          />
          <ImpactStepper
            description="연평균 투자 수익률을 1%p 단위로 조정해 비교합니다."
            decrementLabel="연평균 투자 수익률 1%p 낮추기"
            incrementLabel="연평균 투자 수익률 1%p 높이기"
            label="연평균 투자 수익률"
            value={adjustments.annualReturnRateDelta}
            valueLabel={formatSignedPercentPoint(adjustments.annualReturnRateDelta)}
            onDecrement={() =>
              updateAdjustment("annualReturnRateDelta", -annualReturnRateExperimentStep)
            }
            onIncrement={() =>
              updateAdjustment("annualReturnRateDelta", annualReturnRateExperimentStep)
            }
          />
        </div>

        <div className="impact-result-panel" aria-live="polite">
          <div>
            <h4>종합 결과</h4>
          </div>
          <div className="impact-result-main">
            <span>{timingLabel}</span>
            <strong>
              {formatExperimentTiming(impact.baseMonths)} →{" "}
              {formatExperimentTiming(impact.changedMonths)}
            </strong>
            <em>변화: {formatImpactChange(impact.diffMonths)}</em>
          </div>
          <dl className="impact-delta-list">
            <div>
              <dt>월 저축액</dt>
              <dd>
                {formatMoney(baseMonthlySavings)} → {formatMoney(changedMonthlySavings)}
              </dd>
            </div>
            <div>
              <dt>은퇴 후 월 지출</dt>
              <dd>
                {formatMoney(inputs.retirementMonthlyExpenses)} →{" "}
                {formatMoney(changedInputs.retirementMonthlyExpenses)}
              </dd>
            </div>
            <div>
              <dt>현재 보유 자산</dt>
              <dd>
                {formatMoney(inputs.investableAssets)} →{" "}
                {formatMoney(changedInputs.investableAssets)}
              </dd>
            </div>
            <div>
              <dt>연평균 투자 수익률</dt>
              <dd>
                {formatPercentRate(inputs.annualNominalReturnRate)} →{" "}
                {formatPercentRate(changedInputs.annualNominalReturnRate)}
              </dd>
            </div>
          </dl>
          <p className="impact-note">
            적용 중인 비교 가정: {formatExperimentAdjustmentSummary(adjustments)}
          </p>
        </div>
      </div>
    </section>
  );
}

function ImpactStepper({
  description,
  decrementLabel,
  incrementLabel,
  label,
  onDecrement,
  onIncrement,
  value,
  valueLabel,
}: {
  description: string;
  decrementLabel: string;
  incrementLabel: string;
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
  value: number;
  valueLabel: string;
}) {
  return (
    <article className="impact-control-card">
      <div>
        <h4>{label}</h4>
        <p>{description}</p>
      </div>
      <div className="impact-stepper" aria-label={`${label} 조정`}>
        <button
          aria-label={decrementLabel}
          className="impact-stepper-button"
          type="button"
          onClick={onDecrement}
        >
          −
        </button>
        <output aria-label={`${label} 변화값`} className={value === 0 ? "is-zero" : undefined}>
          {valueLabel}
        </output>
        <button
          aria-label={incrementLabel}
          className="impact-stepper-button"
          type="button"
          onClick={onIncrement}
        >
          +
        </button>
      </div>
    </article>
  );
}

function OneTimeSpendingControl({
  onChangeStep,
  onDecrement,
  onIncrement,
  selectedStep,
  value,
}: {
  onChangeStep: (step: number) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  selectedStep: number;
  value: number;
}) {
  return (
    <article className="impact-control-card">
      <div>
        <h4>일회성 지출</h4>
        <p>일회성 지출을 선택한 단위로 반영해 비교합니다.</p>
      </div>
      <div className="impact-unit-tabs" aria-label="일회성 지출 조정 단위">
        {oneTimeSpendingSteps.map(([label, step]) => (
          <button
            aria-pressed={selectedStep === step}
            className={selectedStep === step ? "button-primary" : "button-secondary"}
            key={step}
            type="button"
            onClick={() => onChangeStep(step)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="impact-stepper" aria-label="일회성 지출 조정">
        <button
          aria-label={`일회성 지출 ${formatMoney(selectedStep)} 줄이기`}
          className="impact-stepper-button"
          type="button"
          onClick={onDecrement}
        >
          −
        </button>
        <output aria-label="일회성 지출 변화값" className={value === 0 ? "is-zero" : undefined}>
          {formatSignedMoney(value)}
        </output>
        <button
          aria-label={`일회성 지출 ${formatMoney(selectedStep)} 늘리기`}
          className="impact-stepper-button"
          type="button"
          onClick={onIncrement}
        >
          +
        </button>
      </div>
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
    ["은퇴 예상 나이", formatRetirementAge(result.retirementAge)],
    [
      "국민연금 수령 시작",
      result.nationalPensionStartAge === null ? "계산 불가" : `${result.nationalPensionStartAge}세`,
    ],
    [
      basisLabel("은퇴 후 첫 달 예상 지출", valueBasis),
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

function ResultCaution() {
  return (
    <aside className="result-caution" aria-label="계산 결과 참고">
      <strong>이 계산은 단순화된 시뮬레이션입니다.</strong>
      <p>
        세금, 주거비 변화, 자녀 교육비, 국민연금, 투자 손실 가능성은 별도로 고려해야
        합니다. 자세한 설명은 <a href={guideListPath}>가이드</a>에서 확인하세요.
      </p>
    </aside>
  );
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatSvgPoints(points: ChartPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function formatAreaPoints(points: ChartPoint[], baseY: number): string {
  if (points.length === 0) {
    return "";
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return `${firstPoint.x},${baseY} ${formatSvgPoints(points)} ${lastPoint.x},${baseY}`;
}

function getNearestProjectionIndex<T extends { month: number }>({
  event,
  maxMonth,
  padding,
  rows,
  svg,
  width,
}: {
  event: PointerEvent<SVGRectElement>;
  maxMonth: number;
  padding: ChartPadding;
  rows: T[];
  svg: SVGSVGElement;
  width: number;
}): number {
  const svgRect = svg.getBoundingClientRect();
  const svgX = ((event.clientX - svgRect.left) / svgRect.width) * width;
  const plotWidth = width - padding.left - padding.right;
  const progress = clampNumber((svgX - padding.left) / plotWidth, 0, 1);
  const selectedMonth = progress * maxMonth;

  return rows.reduce((nearestIndex, row, index) => {
    const nearestDistance = Math.abs(rows[nearestIndex].month - selectedMonth);
    const rowDistance = Math.abs(row.month - selectedMonth);

    return rowDistance < nearestDistance ? index : nearestIndex;
  }, 0);
}

function getTooltipLeftPercent(x: number, width: number): number {
  return clampNumber((x / width) * 100, 14, 86);
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
  const chartId = useId().replace(/:/g, "");
  const chartRef = useRef<SVGSVGElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <article className="chart-card">
        <div className="chart-heading">
          <div>
            <h3>기대수명 자산 추이 그래프</h3>
          </div>
        </div>
        <p className="empty-chart-message">기대수명이 현재 나이보다 커야 그래프를 표시할 수 있습니다.</p>
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

  const toX = (month: number) =>
    padding.left + (month / maxMonth) * (width - padding.left - padding.right);
  const toY = (value: number) =>
    height -
    padding.bottom -
    ((value - minValue) / valueRange) * (height - padding.top - padding.bottom);
  const baseY = height - padding.bottom;
  const assetPoints = rows.map((row) => ({
    x: toX(row.month),
    y: toY(rowAssets(row)),
  }));
  const activeRow = activeIndex === null ? null : rows[activeIndex];
  const activePoint = activeIndex === null ? null : assetPoints[activeIndex];
  const assetGradientId = `${chartId}-depletion-asset-gradient`;
  const areaGradientId = `${chartId}-depletion-area-gradient`;
  const glowId = `${chartId}-depletion-glow`;

  const updateActiveIndex = (event: PointerEvent<SVGRectElement>) => {
    if (!chartRef.current) {
      return;
    }

    setActiveIndex(
      getNearestProjectionIndex({
        event,
        maxMonth,
        padding,
        rows,
        svg: chartRef.current,
        width,
      }),
    );
  };

  return (
    <article className="chart-card">
      <div className="chart-heading">
        <div>
          <h3>기대수명 자산 추이 그래프</h3>
        </div>
        <div className="legend">
          <span className="legend-base">자산 추이</span>
          <span className="legend-retirement">은퇴 시점</span>
        </div>
      </div>
      <div className="interactive-chart">
        <svg
          ref={chartRef}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="기대수명 자산 추이"
        >
          <defs>
            <linearGradient
              id={assetGradientId}
              x1={padding.left}
              x2={width - padding.right}
              y1="0"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="var(--blue-info)" />
              <stop offset="58%" stopColor="var(--purple)" />
              <stop offset="100%" stopColor="var(--pink)" />
            </linearGradient>
            <linearGradient
              id={areaGradientId}
              x1="0"
              x2="0"
              y1={padding.top}
              y2={baseY}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="var(--blue-info)" stopOpacity="0.22" />
              <stop offset="78%" stopColor="var(--purple)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="var(--canvas)" stopOpacity="0" />
            </linearGradient>
            <filter id={glowId} x="-16%" y="-48%" width="132%" height="196%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix
                in="blur"
                result="glow"
                values="0 0 0 0 0.08 0 0 0 0 0.43 0 0 0 0 0.96 0 0 0 0.45 0"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
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
              textAnchor={getXAxisTextAnchor(tick, maxMonth)}
              x={toX(tick)}
              y={height - 12}
            >
              {formatProjectionMonthWithAge(tick, result.projections[0].age + tick / 12)}
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
          <polygon
            className="chart-area"
            fill={`url(#${areaGradientId})`}
            points={formatAreaPoints(assetPoints, baseY)}
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
          <polyline
            className="scenario-line chart-line-shadow"
            filter={`url(#${glowId})`}
            points={formatSvgPoints(assetPoints)}
            stroke={`url(#${assetGradientId})`}
          />
          <polyline
            className="scenario-line chart-glow-line animated-line"
            pathLength={1}
            points={formatSvgPoints(assetPoints)}
            stroke={`url(#${assetGradientId})`}
          />
          {activeRow && activePoint && (
            <g className="chart-active-layer">
              <line
                className="chart-guide-line"
                x1={activePoint.x}
                y1={padding.top}
                x2={activePoint.x}
                y2={baseY}
              />
              <circle
                className="chart-active-point"
                cx={activePoint.x}
                cy={activePoint.y}
                r={isMobile ? 5.5 : 6.5}
              />
            </g>
          )}
          <rect
            className="chart-hit-area"
            x={padding.left}
            y={padding.top}
            width={width - padding.left - padding.right}
            height={height - padding.top - padding.bottom}
            onPointerDown={updateActiveIndex}
            onPointerMove={updateActiveIndex}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") {
                setActiveIndex(null);
              }
            }}
          />
        </svg>
        {activeRow && activePoint && (
          <div
            className={`chart-tooltip ${
              activePoint.y < 86 ? "chart-tooltip-below" : ""
            }`}
            style={{
              left: `${getTooltipLeftPercent(activePoint.x, width)}%`,
              top: `${(activePoint.y / height) * 100}%`,
            }}
          >
            <p>{formatProjectionMonthWithAge(activeRow.month, activeRow.age)}</p>
            <dl>
              <div>
                <dt>자산</dt>
                <dd>{formatMoney(rowAssets(activeRow))}</dd>
              </div>
              <div>
                <dt>상태</dt>
                <dd>{formatDepletionPhase(activeRow.phase)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
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
  const chartId = useId().replace(/:/g, "");
  const chartRef = useRef<SVGSVGElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const values = useMemo(
    () =>
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
    [scenario.inputs.annualInflationRate, scenario.projections, valueBasis],
  );
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const valueRange = maxValue - minValue || 1;
  const maxMonth = Math.max(scenario.projections.at(-1)?.month ?? 1, 1);
  const yTicks = Array.from({ length: 4 }, (_, index) => minValue + (valueRange / 3) * index);
  const xTicks = Array.from(new Set([0, Math.round(maxMonth / 2), maxMonth]));

  const toX = (month: number) =>
    padding.left + (month / maxMonth) * (width - padding.left - padding.right);
  const toY = (value: number) =>
    height -
    padding.bottom -
    ((value - minValue) / valueRange) * (height - padding.top - padding.bottom);
  const baseY = height - padding.bottom;
  const getDisplayValue = (row: FireProjection, value: number) =>
    toDisplayMoney(value, scenario.inputs.annualInflationRate, row.month, valueBasis);
  const assetPoints = useMemo(
    () =>
      scenario.projections.map((row) => ({
        x: toX(row.month),
        y: toY(getDisplayValue(row, row.investableAssets)),
      })),
    [scenario.projections, valueBasis, valueRange, minValue, maxMonth, width, height],
  );
  const targetPoints = useMemo(
    () =>
      scenario.projections.map((row) => ({
        x: toX(row.month),
        y: toY(getDisplayValue(row, row.fireTargetAssets)),
      })),
    [scenario.projections, valueBasis, valueRange, minValue, maxMonth, width, height],
  );
  const activeRow = activeIndex === null ? null : scenario.projections[activeIndex];
  const activeAssetPoint = activeIndex === null ? null : assetPoints[activeIndex];
  const activeTargetPoint = activeIndex === null ? null : targetPoints[activeIndex];
  const assetGradientId = `${chartId}-asset-gradient`;
  const targetGradientId = `${chartId}-target-gradient`;
  const areaGradientId = `${chartId}-asset-area-gradient`;
  const glowId = `${chartId}-asset-glow`;

  const updateActiveIndex = (event: PointerEvent<SVGRectElement>) => {
    if (!chartRef.current) {
      return;
    }

    setActiveIndex(
      getNearestProjectionIndex({
        event,
        maxMonth,
        padding,
        rows: scenario.projections,
        svg: chartRef.current,
        width,
      }),
    );
  };

  return (
    <article className="chart-card">
      <div className="chart-heading">
        <div>
          <h3>월별 자산 추이 그래프</h3>
        </div>
        <div className="legend">
          <span className="legend-base">투자 가능 자산</span>
          <span className="legend-target">점선: 경제적 자립 목표</span>
          {scenario.monthsToFire !== null && (
            <span className="legend-retirement">세로 점선: 기준 충족</span>
          )}
        </div>
      </div>
      <div className="interactive-chart">
        <svg
          ref={chartRef}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="월별 자산 추이"
        >
          <defs>
            <linearGradient
              id={assetGradientId}
              x1={padding.left}
              x2={width - padding.right}
              y1="0"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="var(--blue-info)" />
              <stop offset="56%" stopColor="var(--purple)" />
              <stop offset="100%" stopColor="var(--pink)" />
            </linearGradient>
            <linearGradient
              id={targetGradientId}
              x1={padding.left}
              x2={width - padding.right}
              y1="0"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="var(--body-mid)" />
              <stop offset="100%" stopColor="var(--purple)" />
            </linearGradient>
            <linearGradient
              id={areaGradientId}
              x1="0"
              x2="0"
              y1={padding.top}
              y2={baseY}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="var(--blue-info)" stopOpacity="0.22" />
              <stop offset="72%" stopColor="var(--purple)" stopOpacity="0.07" />
              <stop offset="100%" stopColor="var(--canvas)" stopOpacity="0" />
            </linearGradient>
            <filter id={glowId} x="-16%" y="-48%" width="132%" height="196%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix
                in="blur"
                result="glow"
                values="0 0 0 0 0.08 0 0 0 0 0.43 0 0 0 0 0.96 0 0 0 0.45 0"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
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
              textAnchor={getXAxisTextAnchor(tick, maxMonth)}
              x={toX(tick)}
              y={height - 12}
            >
              {formatProjectionMonth(tick)}
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
          {scenario.monthsToFire !== null && (
            <line
              className="retirement-line"
              x1={toX(scenario.monthsToFire)}
              y1={padding.top}
              x2={toX(scenario.monthsToFire)}
              y2={baseY}
            />
          )}
          <polygon
            className="chart-area"
            fill={`url(#${areaGradientId})`}
            points={formatAreaPoints(assetPoints, baseY)}
          />
          <polyline
            className="target-line"
            points={formatSvgPoints(targetPoints)}
            stroke={`url(#${targetGradientId})`}
          />
          <polyline
            className="scenario-line chart-line-shadow"
            filter={`url(#${glowId})`}
            points={formatSvgPoints(assetPoints)}
            stroke={`url(#${assetGradientId})`}
          />
          <polyline
            className="scenario-line chart-glow-line animated-line"
            pathLength={1}
            points={formatSvgPoints(assetPoints)}
            stroke={`url(#${assetGradientId})`}
          />
          {activeRow && activeAssetPoint && activeTargetPoint && (
            <g className="chart-active-layer">
              <line
                className="chart-guide-line"
                x1={activeAssetPoint.x}
                y1={padding.top}
                x2={activeAssetPoint.x}
                y2={baseY}
              />
              <circle
                className="chart-target-point"
                cx={activeTargetPoint.x}
                cy={activeTargetPoint.y}
                r={isMobile ? 4.5 : 5.5}
              />
              <circle
                className="chart-active-point"
                cx={activeAssetPoint.x}
                cy={activeAssetPoint.y}
                r={isMobile ? 5.5 : 6.5}
              />
            </g>
          )}
          <rect
            className="chart-hit-area"
            x={padding.left}
            y={padding.top}
            width={width - padding.left - padding.right}
            height={height - padding.top - padding.bottom}
            onPointerDown={updateActiveIndex}
            onPointerMove={updateActiveIndex}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") {
                setActiveIndex(null);
              }
            }}
          />
        </svg>
        {activeRow && activeAssetPoint && (
          <div
            className={`chart-tooltip ${
              activeAssetPoint.y < 86 ? "chart-tooltip-below" : ""
            }`}
            style={{
              left: `${getTooltipLeftPercent(activeAssetPoint.x, width)}%`,
              top: `${(activeAssetPoint.y / height) * 100}%`,
            }}
          >
            <p>{formatProjectionMonth(activeRow.month)}</p>
            <dl>
              <div>
                <dt>투자 가능 자산</dt>
                <dd>{formatMoney(getDisplayValue(activeRow, activeRow.investableAssets))}</dd>
              </div>
              <div>
                <dt>경제적 자립 목표</dt>
                <dd>{formatMoney(getDisplayValue(activeRow, activeRow.fireTargetAssets))}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
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
    valueKey === "investableAssets" ? "투자 가능 자산" : "경제적 자립 목표 자산";

  return (
    <article className="table-card">
      <h3>{title}</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>시점</th>
              <th>{basisLabel(moneyHeader, valueBasis)}</th>
              <th>목표인출율</th>
              <th>{basisLabel("현재 월 소비액", valueBasis)}</th>
              <th>{basisLabel("은퇴 후 월 지출", valueBasis)}</th>
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
                <td>
                  {formatMoney(
                    toDisplayMoney(
                      row.retirementMonthlyExpenses,
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
                <th>{basisLabel("월 지출", valueBasis)}</th>
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

function PensionStartAgeNote({ currentAge }: { currentAge: number }) {
  const inferredBirthYear = inferBirthYearFromCurrentAge(currentAge);
  const startAge = calculateNationalPensionStartAge(inferredBirthYear);

  return (
    <p className="pension-start-note">
      현재 나이로 출생연도를 {inferredBirthYear}년생으로 유추하고, 국민연금은{" "}
      {startAge}세부터 반영합니다. 1952년 이전 60세, 1953~1956년 61세,
      1957~1960년 62세, 1961~1964년 63세, 1965~1968년 64세, 1969년 이후
      65세 기준입니다.
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

function AdvancedFieldset({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="advanced-fieldset">
      <summary>
        <span>{title}</span>
      </summary>
      <div className="field-grid advanced-field-grid">{children}</div>
    </details>
  );
}

function NumberField({
  field,
  label,
  suffix,
  value,
  helpText,
  onChange,
}: {
  field: NumericFormField;
  label: string;
  suffix: string;
  value: NumericFormValue;
  helpText?: string;
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const hintId = `${inputId}-hint`;
  const inputValue = typeof value === "number" && !Number.isNaN(value) ? value : "";
  const moneyHint = suffix === "원" && typeof value === "number" ? formatMoneyInputHint(value) : "";
  const describedBy = [helpText ? helpId : null, moneyHint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="number-field">
      <div className="number-field-label">
        <label htmlFor={inputId}>{label}</label>
        {helpText && (
          <>
            <span className="field-help">
              <button
                type="button"
                aria-describedby={helpId}
                aria-label={`${label} 설명`}
                className="field-help-trigger"
              >
                ?
              </button>
            </span>
            <span className="field-tooltip" id={helpId} role="tooltip">
              {helpText}
            </span>
          </>
        )}
      </div>
      <div className="number-field-control">
        <input
          aria-describedby={describedBy || undefined}
          autoComplete="off"
          id={inputId}
          min={getNumberFieldMin(field)}
          name={field}
          step={getNumberFieldStep(field)}
          type="number"
          inputMode="decimal"
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
        />
        {moneyHint && (
          <small className="number-field-hint" id={hintId}>
            {moneyHint}
          </small>
        )}
        <em>{suffix}</em>
      </div>
    </div>
  );
}

function presetToFormValues(values: FireInputs): FormValues {
  return {
    investableAssets: values.investableAssets,
    monthlyIncome: values.monthlyIncome,
    monthlyExpenses: values.monthlyExpenses,
    retirementMonthlyExpenses: values.retirementMonthlyExpenses,
    annualNominalReturnRate: rateToPercentInput(values.annualNominalReturnRate),
    annualInflationRate: rateToPercentInput(values.annualInflationRate),
    annualIncomeGrowthRate: rateToPercentInput(values.annualIncomeGrowthRate),
    targetWithdrawalRate: rateToPercentInput(values.targetWithdrawalRate),
    currentAge: values.currentAge,
    childIndependenceAge: values.childIndependenceAge,
    childMonthlyExpenseReduction: values.childMonthlyExpenseReduction,
    lifeExpectancy: values.lifeExpectancy,
    nationalPensionMonthlyAmount: values.nationalPensionMonthlyAmount,
  };
}

function loadInitialAppState(): InitialAppState {
  const cachedState = loadCachedAppState();

  return {
    ...cachedState,
    ...loadViewStateFromUrl(cachedState),
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

function loadViewStateFromUrl(fallbackState: CachedAppState): Pick<
  InitialAppState,
  "activeResultTab" | "calculationMode" | "valueBasis"
> {
  if (typeof window === "undefined") {
    return {
      activeResultTab: "summary",
      calculationMode: fallbackState.calculationMode,
      valueBasis: fallbackState.valueBasis,
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    activeResultTab: parseResultTab(params.get("tab")) ?? "summary",
    calculationMode: parseCalculationMode(params.get("mode")) ?? fallbackState.calculationMode,
    valueBasis: parseValueBasis(params.get("basis")) ?? fallbackState.valueBasis,
  };
}

function syncViewStateToUrl({
  activeResultTab,
  calculationMode,
  valueBasis,
}: {
  activeResultTab: ResultTab;
  calculationMode: CalculationMode;
  valueBasis: ValueBasis;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("mode", calculationMode);
  url.searchParams.set("basis", valueBasis);
  url.searchParams.set("tab", activeResultTab);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
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

function isResultTab(value: unknown): value is ResultTab {
  return typeof value === "string" && validResultTabs.includes(value as ResultTab);
}

function parseCalculationMode(value: string | null): CalculationMode | null {
  return isCalculationMode(value) ? value : null;
}

function parseValueBasis(value: string | null): ValueBasis | null {
  return isValueBasis(value) ? value : null;
}

function parseResultTab(value: string | null): ResultTab | null {
  return isResultTab(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formValuesToInputs(values: FormValues): FireInputs {
  return {
    investableAssets: normalizeFormNumber(values.investableAssets),
    monthlyIncome: normalizeFormNumber(values.monthlyIncome),
    monthlyExpenses: normalizeFormNumber(values.monthlyExpenses),
    retirementMonthlyExpenses: normalizeFormNumber(values.retirementMonthlyExpenses),
    annualNominalReturnRate: percentInputToRate(normalizeFormNumber(values.annualNominalReturnRate)),
    annualInflationRate: percentInputToRate(normalizeFormNumber(values.annualInflationRate)),
    annualIncomeGrowthRate: percentInputToRate(normalizeFormNumber(values.annualIncomeGrowthRate)),
    targetWithdrawalRate: percentInputToRate(normalizeFormNumber(values.targetWithdrawalRate)),
    currentAge: normalizeFormNumber(values.currentAge),
    childIndependenceAge: normalizeFormNumber(values.childIndependenceAge),
    childMonthlyExpenseReduction: normalizeFormNumber(values.childMonthlyExpenseReduction),
    birthYear: inferBirthYearFromCurrentAge(normalizeFormNumber(values.currentAge)),
    lifeExpectancy: normalizeFormNumber(values.lifeExpectancy),
    nationalPensionMonthlyAmount: normalizeFormNumber(values.nationalPensionMonthlyAmount),
  };
}

function normalizeFormNumber(value: NumericFormValue): number {
  return value === "" ? 0 : value;
}

function getNumberFieldMin(field: NumericFormField): number {
  if (field === "lifeExpectancy") {
    return 1;
  }

  if (field === "annualNominalReturnRate" || field === "annualInflationRate" || field === "annualIncomeGrowthRate") {
    return -99;
  }

  if (field === "targetWithdrawalRate") {
    return rateToPercentInput(MIN_WITHDRAWAL_RATE);
  }

  return 0;
}

function getNumberFieldStep(field: NumericFormField): number {
  if (
    field === "lifeExpectancy" ||
    field === "currentAge" ||
    field === "childIndependenceAge"
  ) {
    return 1;
  }

  if (
    field === "annualNominalReturnRate" ||
    field === "annualInflationRate" ||
    field === "annualIncomeGrowthRate" ||
    field === "targetWithdrawalRate"
  ) {
    return 0.1;
  }

  return 10_000;
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

function applyExperimentAdjustments(
  inputs: FireInputs,
  adjustments: ExperimentAdjustments,
): FireInputs {
  return {
    ...inputs,
    investableAssets: Math.max(inputs.investableAssets - adjustments.oneTimeSpendingDelta, 0),
    monthlyIncome: Math.max(inputs.monthlyIncome + adjustments.monthlySavingsDelta, 0),
    retirementMonthlyExpenses: Math.max(
      inputs.retirementMonthlyExpenses + adjustments.retirementMonthlyExpensesDelta,
      0,
    ),
    annualNominalReturnRate: inputs.annualNominalReturnRate + adjustments.annualReturnRateDelta,
  };
}

function hasExperimentAdjustments(adjustments: ExperimentAdjustments): boolean {
  return Object.values(adjustments).some((value) => value !== 0);
}

function formatExperimentAdjustmentSummary(adjustments: ExperimentAdjustments): string {
  if (!hasExperimentAdjustments(adjustments)) {
    return "없음";
  }

  const summaries = [
    adjustments.monthlySavingsDelta === 0
      ? null
      : `월 저축액 ${formatSignedMoney(adjustments.monthlySavingsDelta)}`,
    adjustments.retirementMonthlyExpensesDelta === 0
      ? null
      : `은퇴 후 월 지출 ${formatSignedMoney(adjustments.retirementMonthlyExpensesDelta)}`,
    adjustments.oneTimeSpendingDelta === 0
      ? null
      : `일회성 지출 ${formatSignedMoney(adjustments.oneTimeSpendingDelta)}`,
    adjustments.annualReturnRateDelta === 0
      ? null
      : `연평균 투자 수익률 ${formatSignedPercentPoint(adjustments.annualReturnRateDelta)}`,
  ].filter(Boolean);

  return summaries.join(", ");
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
  return `${label} (${valueBasis === "nominal" ? "미래 금액 기준" : "오늘 돈 가치 기준"})`;
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

function formatSignedMoney(value: number): string {
  if (value === 0) {
    return "변화 없음";
  }

  return `${value > 0 ? "+" : ""}${formatMoney(value)}`;
}

function formatPercentRate(value: number): string {
  return `${formatOneDecimal(value * 100)}%`;
}

function formatProgressPercent(value: number): string {
  return `${formatOneDecimal(Math.min(Math.max(value, 0), 100))}%`;
}

function formatSignedPercentPoint(value: number): string {
  if (value === 0) {
    return "변화 없음";
  }

  return `${value > 0 ? "+" : ""}${formatOneDecimal(value * 100)}%p`;
}

function formatMonthsToFire(scenario: FireScenarioResult): string {
  if (scenario.monthsToFire === null) {
    return "기준 충족 어려움";
  }

  if (scenario.monthsToFire === 0) {
    return "현재 기준 충족";
  }

  return `${formatWorkDuration(scenario.monthsToFire)} 뒤`;
}

function formatExperimentTiming(months: number | null): string {
  if (months === null) {
    return "기준 충족 어려움";
  }

  if (months === 0) {
    return "현재 기준 충족";
  }

  return `${formatWorkDuration(months)} 뒤`;
}

function formatImpactChange(diffMonths: number | null): string {
  if (diffMonths === null) {
    return "비교 어려움";
  }

  if (Math.abs(diffMonths) < 1) {
    return "거의 변화 없음";
  }

  const direction = diffMonths > 0 ? "더 필요" : "단축";

  return `${formatOneDecimal(Math.abs(diffMonths) / 12)}년 ${direction}`;
}

function formatDepletionTiming(result: DepletionResult): string {
  if (result.status === "invalid-time-horizon") {
    return "계산 불가";
  }

  if (result.status === "not-achievable" || result.monthsToWork === null) {
    return "기준 충족 어려움";
  }

  if (result.monthsToWork === 0) {
    return "현재 기준 충족";
  }

  return `${formatWorkDuration(result.monthsToWork)} 뒤`;
}

function formatDepletionStatus(result: DepletionResult): string {
  if (result.status === "already-sufficient") {
    return "현재 조건 기준으로 기대수명까지 자산이 유지되는 시점입니다.";
  }

  if (result.status === "achievable") {
    return "현재 조건 기준으로 기대수명까지 자산이 유지되는 시점입니다.";
  }

  if (result.status === "invalid-time-horizon") {
    return "기대수명이 현재 나이보다 커야 합니다.";
  }

  return "입력한 기대수명 범위에서는 자립 기준을 충족하기 어렵습니다.";
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

function formatProjectionMonthWithAge(month: number, age: number): string {
  return `${formatProjectionMonth(month)} (${formatRetirementAge(age)})`;
}

function getXAxisTextAnchor(month: number, maxMonth: number): "start" | "middle" | "end" {
  if (month === 0) {
    return "start";
  }

  if (month === maxMonth) {
    return "end";
  }

  return "middle";
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
    return `약 ${sign}${formatCompact(absValue / 100_000_000)}억`;
  }

  return `약 ${sign}${formatCompact(absValue / 10_000)}만`;
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
