"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { updateProfile } from "../../../_api/account";
import { useAuth } from "../../../_api/AuthProvider";
import { searchCompanies } from "../../../_api/companies";
import { ApiError } from "../../../_api/types";
import { getDictionary, onboardingApiCopy } from "../../../_content/i18n";

const fallbackCompanies = [
  "Amazon",
  "Apple",
  "Bloomberg",
  "Google",
  "Meta",
  "Microsoft",
  "Netflix",
  "OpenAI",
  "Uber",
  "Yandex",
] as const;

// Координаты x/y раскидывают темы по полю: клик «притягивает» тему в центр
// (CSS-переход --topic-x/y → --topic-center-x/y).
const algorithmTopics = [
  { id: "arrays", label: "Arrays & Hashing", x: 8, y: 16 },
  { id: "two-pointers", label: "Two Pointers", x: 72, y: 12 },
  { id: "sliding-window", label: "Sliding Window", x: 5, y: 42 },
  { id: "stack", label: "Stack", x: 78, y: 38 },
  { id: "binary-search", label: "Binary Search", x: 13, y: 72 },
  { id: "linked-list", label: "Linked List", x: 70, y: 68 },
  { id: "trees", label: "Trees", x: 23, y: 9 },
  { id: "graphs", label: "Graphs", x: 82, y: 82 },
  { id: "heap", label: "Heap / Priority Queue", x: 2, y: 88 },
  { id: "backtracking", label: "Backtracking", x: 84, y: 58 },
  { id: "dp", label: "Dynamic Programming", x: 16, y: 55 },
  { id: "greedy", label: "Greedy", x: 75, y: 24 },
  { id: "intervals", label: "Intervals", x: 27, y: 84 },
  { id: "tries", label: "Tries", x: 63, y: 7 },
  { id: "bit", label: "Bit Manipulation", x: 88, y: 6 },
] as const;

type OnboardingStep = "company" | "date" | "topics" | "goal" | "welcome";

const steps: OnboardingStep[] = ["company", "date", "topics", "goal"];
const onboardingStorageKey = "realgo:onboarding-profile:v1";

const WHEEL_ITEM_HEIGHT = 44;

type WheelItem = Readonly<{ key: string; label: string }>;

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fullDateLabel(iso: string, locale = "ru-RU") {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function getCenterPosition(index: number) {
  const positions = [
    [50, 47],
    [37, 42],
    [63, 42],
    [42, 57],
    [58, 57],
    [50, 32],
    [50, 66],
    [31, 54],
    [69, 54],
  ];
  return positions[index % positions.length] ?? [50, 50];
}

function splitCompanies(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function activeCompanyQuery(value: string) {
  const parts = value.split(",");
  return parts.at(-1)?.trim() ?? "";
}

function replaceActiveCompany(value: string, suggestion: string) {
  const parts = value.split(",");
  parts[parts.length - 1] = ` ${suggestion}`;
  return parts.map((part) => part.trim()).filter(Boolean).join(", ");
}

// Вертикальное «колесо»: активно значение, остановившееся по центру.
// scroll-snap держит элемент в центре, settle-таймер коммитит выбор.
function WheelColumn({
  items,
  value,
  onChange,
  ariaLabel,
}: Readonly<{
  items: readonly WheelItem[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel: string;
}>) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef(0);
  const [centered, setCentered] = useState(value);

  useEffect(() => {
    setCentered(value);
    const el = listRef.current;
    if (!el) return;
    const index = Math.max(
      0,
      items.findIndex((item) => item.key === value),
    );
    const target = index * WHEEL_ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTo({ top: target });
  }, [value, items]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const index = Math.min(
      items.length - 1,
      Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT)),
    );
    const item = items[index];
    if (item) setCentered(item.key);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (item && item.key !== value) onChange(item.key);
    }, 120);
  }, [items, onChange, value]);

  return (
    <div className="onboarding-wheel" role="listbox" aria-label={ariaLabel}>
      <div className="onboarding-wheel__band" aria-hidden="true" />
      <div className="onboarding-wheel__list" ref={listRef} onScroll={handleScroll}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="option"
            aria-selected={item.key === value}
            className={item.key === centered ? "is-active" : undefined}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingProfilePage() {
  const router = useRouter();
  const { user, status } = useAuth();
  const dictionary = getDictionary();
  const copy = dictionary.onboarding.profile;

  const [companySuggestions, setCompanySuggestions] = useState<string[]>([...fallbackCompanies]);
  const [companyInput, setCompanyInput] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [prepGoal, setPrepGoal] = useState("");
  const [grade, setGrade] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [step, setStep] = useState<OnboardingStep>("company");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Auth guard: redirect anonymous users to login, already-onboarded to
  // dashboard. `?force=1` (тест-триггер, см. хоткей `g o` в кабинете)
  // позволяет пройти онбординг повторно.
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get("force") === "1";
    if (status === "anonymous") {
      router.replace("/login");
    } else if (!forced && status === "authenticated" && user?.onboarding_completed) {
      router.replace("/dashboard");
    }
  }, [router, status, user?.onboarding_completed]);

  const currentStepIndex = Math.max(0, steps.indexOf(step));
  const selectedCompanies = useMemo(() => splitCompanies(companyInput), [companyInput]);
  const currentStepHasValue =
    (step === "company" && selectedCompanies.length > 0) ||
    (step === "date" && selectedDate.length > 0) ||
    (step === "topics" && selectedTopics.length > 0) ||
    step === "goal";

  const today = useMemo(() => new Date(), []);
  const selected = useMemo(
    () => (selectedDate ? new Date(`${selectedDate}T00:00:00`) : null),
    [selectedDate],
  );

  // Колёса всегда показывают какую-то дату в центре, поэтому при входе на шаг
  // подставляем стартовую (~2 недели), если дата ещё не выбрана.
  useEffect(() => {
    if (step !== "date" || selectedDate) return;
    const start = new Date();
    start.setDate(start.getDate() + 14);
    setSelectedDate(toDateInputValue(start));
  }, [step, selectedDate]);

  const monthItems = useMemo(() => {
    return Array.from({ length: 12 }, (_, offset) => {
      const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const name = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(date);
      const label =
        date.getFullYear() === today.getFullYear() ? name : `${name} ${date.getFullYear()}`;
      return { key: monthKeyOf(date), label };
    });
  }, [today]);

  const dayItems = useMemo(() => {
    if (!selected) return [];
    const year = selected.getFullYear();
    const month = selected.getMonth();
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    const first = isCurrentMonth ? today.getDate() : 1;
    const last = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: last - first + 1 }, (_, i) => {
      const day = first + i;
      return { key: String(day), label: String(day).padStart(2, "0") };
    });
  }, [selected, today]);

  const changeDay = useCallback(
    (key: string) => {
      if (!selected) return;
      setSelectedDate(
        toDateInputValue(new Date(selected.getFullYear(), selected.getMonth(), Number(key))),
      );
    },
    [selected],
  );

  const changeMonth = useCallback(
    (key: string) => {
      if (!selected) return;
      const [year, month] = key.split("-").map(Number);
      const isCurrentMonth = year === today.getFullYear() && month - 1 === today.getMonth();
      const minDay = isCurrentMonth ? today.getDate() : 1;
      const lastDay = new Date(year, month, 0).getDate();
      const day = Math.min(Math.max(selected.getDate(), minDay), lastDay);
      setSelectedDate(toDateInputValue(new Date(year, month - 1, day)));
    },
    [selected, today],
  );

  const suggestions = useMemo(() => {
    const query = activeCompanyQuery(companyInput).toLowerCase();
    const used = new Set(selectedCompanies.map((item) => item.toLowerCase()));
    if (query.length < 2) return [];
    return companySuggestions
      .filter((item) => item.toLowerCase().includes(query) && !used.has(item.toLowerCase()))
      .slice(0, 6);
  }, [companySuggestions, companyInput, selectedCompanies]);

  // Debounced company autocomplete from the backend API.
  useEffect(() => {
    const query = activeCompanyQuery(companyInput);
    if (query.trim().length < 2) {
      setCompanySuggestions([...fallbackCompanies]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await searchCompanies(query.trim(), controller.signal, 8);
        if (!controller.signal.aborted) {
          setCompanySuggestions(results.map((company) => company.name));
        }
      } catch {
        // Keep fallback suggestions on error.
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [companyInput]);

  const toggleTopic = useCallback((topicId: string) => {
    setSelectedTopics((current) =>
      current.includes(topicId) ? current.filter((item) => item !== topicId) : [...current, topicId],
    );
  }, []);

  const saveProfile = useCallback(
    async (topics = selectedTopics, referral = referralSource) => {
      setSaving(true);
      setSaveError("");
      try {
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        await updateProfile({
          target_company: selectedCompanies[0] ?? "",
          interview_date: selectedDate ? `${selectedDate}T09:00:00Z` : undefined,
          prep_goal: prepGoal.trim() || undefined,
          grade: grade || undefined,
          timezone,
          onboarding_completed: true,
        });
        // Topics and referral have no backend field — keep them in localStorage.
        window.localStorage.setItem(
          onboardingStorageKey,
          JSON.stringify({ topics, referral: referral || null, savedAt: new Date().toISOString() }),
        );
        setStep("welcome");
      } catch (e) {
        setSaveError(e instanceof ApiError ? e.message : onboardingApiCopy.saveFailed);
      } finally {
        setSaving(false);
      }
    },
    [grade, prepGoal, referralSource, selectedCompanies, selectedDate, selectedTopics],
  );

  const goNext = useCallback(() => {
    if (step === "company") {
      setStep("date");
      return;
    }

    if (step === "date") {
      setStep("topics");
      return;
    }

    if (step === "topics") {
      setStep("goal");
      return;
    }

    // step === "goal" → save and transition to welcome on success.
    void saveProfile();
  }, [saveProfile, step]);

  const goBack = useCallback(() => {
    if (step === "date") setStep("company");
    if (step === "topics") setStep("date");
    if (step === "goal") setStep("topics");
  }, [step]);

  const skipCurrent = useCallback(() => {
    if (step === "company") {
      setCompanyInput("");
      setStep("date");
    }

    if (step === "date") {
      setSelectedDate("");
      setStep("topics");
    }

    if (step === "topics") {
      setSelectedTopics([]);
      setStep("goal");
    }

    if (step === "goal") {
      setPrepGoal("");
      setGrade("");
      setReferralSource("");
      void saveProfile([], "");
    }
  }, [saveProfile, step]);

  // While auth status is being determined, render nothing.
  if (status === "loading") {
    return null;
  }

  if (step === "welcome") {
    const summary = copy.welcome.summary;
    const topicLabels = algorithmTopics
      .filter((topic) => selectedTopics.includes(topic.id))
      .map((topic) => topic.label);

    return (
      <main className="onboarding-page">
        <section className="onboarding-window onboarding-window--welcome">
          <header className="onboarding-titlebar">
            <a className="onboarding-path" href="/">
              ~/realgo<em>/setup</em>
            </a>
            <span className="onboarding-status">
              <i aria-hidden="true" />
              {copy.welcome.eyebrow}
            </span>
          </header>
          <div className="onboarding-welcome">
            <h1>{copy.welcome.title}</h1>
            <p>{copy.welcome.description}</p>
            <dl className="onboarding-summary">
              <div>
                <dt>{summary.companies}</dt>
                <dd>{selectedCompanies.length > 0 ? selectedCompanies.join(", ") : summary.empty}</dd>
              </div>
              <div>
                <dt>{summary.date}</dt>
                <dd>{selectedDate ? fullDateLabel(selectedDate) : summary.empty}</dd>
              </div>
              <div>
                <dt>{onboardingApiCopy.summaryGoal}</dt>
                <dd>{prepGoal.trim() || summary.empty}</dd>
              </div>
              <div>
                <dt>{onboardingApiCopy.summaryGrade}</dt>
                <dd>{grade || summary.empty}</dd>
              </div>
              <div>
                <dt>{summary.topics}</dt>
                <dd>{topicLabels.length > 0 ? topicLabels.join(", ") : summary.empty}</dd>
              </div>
            </dl>
            <button className="onboarding-primary" type="button" onClick={() => router.push("/dashboard")}>
              {copy.welcome.action}
            </button>
          </div>
        </section>
      </main>
    );
  }

  const stepTag = `${String(currentStepIndex + 1).padStart(2, "0")} / ${step}`;

  return (
    <main className="onboarding-page">
      <section className="onboarding-window" aria-live="polite">
        <header className="onboarding-titlebar">
          <a className="onboarding-path" href="/">
            ~/realgo<em>/setup</em>
          </a>
          <div
            className="onboarding-progress"
            aria-label={`${copy.stepLabel} ${currentStepIndex + 1} / ${steps.length}`}
          >
            <span>
              {copy.stepLabel} {String(currentStepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
            </span>
            <div>
              {steps.map((item, index) => (
                <i className={index <= currentStepIndex ? "active" : ""} key={item} />
              ))}
            </div>
          </div>
        </header>

        <div className="onboarding-body" key={step}>
          <aside className="onboarding-copy">
            <span className="onboarding-eyebrow">{stepTag}</span>
            {step === "goal" ? (
              <>
                <h2>{onboardingApiCopy.goal.title}</h2>
                <p>{onboardingApiCopy.goal.description}</p>
              </>
            ) : (
              <>
                <h2>{copy[step].title}</h2>
                <p>{copy[step].description}</p>
              </>
            )}
          </aside>

          {step === "company" ? (
            <div className="onboarding-main">
              <label className="onboarding-input">
                {copy.company.label}
                <input
                  autoComplete="organization"
                  list="realgo-company-suggestions"
                  placeholder={copy.company.placeholder}
                  value={companyInput}
                  onChange={(event) => setCompanyInput(event.target.value)}
                />
              </label>
              <datalist id="realgo-company-suggestions">
                {suggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              {selectedCompanies.length > 0 ? (
                <div className="selected-companies" aria-label={copy.company.selectedLabel}>
                  {selectedCompanies.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCompanyInput(selectedCompanies.filter((company) => company !== item).join(", "))}
                    >
                      {item}
                      <span>×</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {suggestions.length > 0 ? (
                <div className="company-suggestions" aria-label={copy.company.suggestionsLabel}>
                  {suggestions.map((item) => (
                    <button key={item} type="button" onClick={() => setCompanyInput(replaceActiveCompany(companyInput, item))}>
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "date" ? (
            <div className="onboarding-main">
              <div className="onboarding-wheels" role="group" aria-label={copy.date.wheelsLabel}>
                <WheelColumn
                  items={dayItems}
                  value={selected ? String(selected.getDate()) : ""}
                  onChange={changeDay}
                  ariaLabel={copy.date.dayAria}
                />
                <WheelColumn
                  items={monthItems}
                  value={selected ? monthKeyOf(selected) : ""}
                  onChange={changeMonth}
                  ariaLabel={copy.date.monthAria}
                />
              </div>
              <p className="onboarding-wheels-result">
                {copy.date.resultLabel}: <em>{selectedDate ? fullDateLabel(selectedDate) : "—"}</em>
              </p>
            </div>
          ) : null}

          {step === "topics" ? (
            <div className="onboarding-main">
              <div className="onboarding-topic-field" role="group" aria-label={copy.topics.fieldLabel}>
                <div className="onboarding-topic-center" aria-hidden="true">
                  <span>{selectedTopics.length > 0 ? copy.topics.selected : copy.topics.empty}</span>
                </div>
                {algorithmTopics.map((topic) => {
                  const selectedIndex = selectedTopics.indexOf(topic.id);
                  const isSelected = selectedIndex >= 0;
                  const [centerX, centerY] = isSelected ? getCenterPosition(selectedIndex) : [50, 50];

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={isSelected ? "selected" : ""}
                      key={topic.id}
                      style={
                        {
                          "--topic-x": `${topic.x}%`,
                          "--topic-y": `${topic.y}%`,
                          "--topic-center-x": `${centerX}%`,
                          "--topic-center-y": `${centerY}%`,
                        } as CSSProperties
                      }
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                    >
                      {topic.label}
                    </button>
                  );
                })}
              </div>
              <p className="onboarding-topics-count">
                {copy.topics.selectedCount}: <em>{String(selectedTopics.length).padStart(2, "0")}</em> /{" "}
                {String(algorithmTopics.length).padStart(2, "0")}
              </p>
            </div>
          ) : null}

          {step === "goal" ? (
            <div className="onboarding-main">
              <label className="onboarding-input">
                {onboardingApiCopy.goal.prepGoalLabel}
                <textarea
                  placeholder={onboardingApiCopy.goal.prepGoalPlaceholder}
                  rows={3}
                  value={prepGoal}
                  onChange={(event) => setPrepGoal(event.target.value)}
                />
              </label>
              <label className="onboarding-input">
                {onboardingApiCopy.goal.gradeLabel}
                <select value={grade} onChange={(event) => setGrade(event.target.value)}>
                  <option value="">—</option>
                  {onboardingApiCopy.goal.grades.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="onboarding-input">
                {onboardingApiCopy.goal.referralLabel}
                <select value={referralSource} onChange={(event) => setReferralSource(event.target.value)}>
                  <option value="">—</option>
                  {onboardingApiCopy.goal.referralOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        {saveError ? (
          <p className="onboarding-save-error" role="alert">
            {saveError}
          </p>
        ) : null}

        <footer className="onboarding-actions">
          <div>
            {step !== "company" ? (
              <button className="onboarding-ghost" type="button" onClick={goBack} disabled={saving}>
                {copy.back}
              </button>
            ) : null}
          </div>
          <div>
            <button className="onboarding-ghost" type="button" onClick={skipCurrent} disabled={saving}>
              {copy.skip}
            </button>
            <button
              className="onboarding-primary"
              disabled={!currentStepHasValue || saving}
              type="button"
              onClick={goNext}
            >
              {saving ? onboardingApiCopy.saving : copy.next}
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
