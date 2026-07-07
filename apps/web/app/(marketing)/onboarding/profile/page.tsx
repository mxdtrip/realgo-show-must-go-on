"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const algorithmTopics = [
  { id: "arrays", label: "Arrays & Hashing" },
  { id: "two-pointers", label: "Two Pointers" },
  { id: "sliding-window", label: "Sliding Window" },
  { id: "stack", label: "Stack" },
  { id: "binary-search", label: "Binary Search" },
  { id: "linked-list", label: "Linked List" },
  { id: "trees", label: "Trees" },
  { id: "graphs", label: "Graphs" },
  { id: "heap", label: "Heap / Priority Queue" },
  { id: "backtracking", label: "Backtracking" },
  { id: "dp", label: "Dynamic Programming" },
  { id: "greedy", label: "Greedy" },
  { id: "intervals", label: "Intervals" },
  { id: "tries", label: "Tries" },
  { id: "bit", label: "Bit Manipulation" },
] as const;

type CalendarDay = {
  iso: string;
  label: number;
  weekday: string;
};

type OnboardingStep = "company" | "date" | "topics" | "goal" | "welcome";

const steps: OnboardingStep[] = ["company", "date", "topics", "goal"];
const onboardingStorageKey = "realgo:onboarding-profile:v1";

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(date: Date, locale = "ru-RU") {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}

function fullDateLabel(iso: string, locale = "ru-RU") {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function buildCalendarMonth(monthDate: Date, weekdays: readonly string[]) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const mondayBasedOffset = (firstDay.getDay() + 6) % 7;
  const days: Array<CalendarDay | null> = Array.from({ length: mondayBasedOffset }, () => null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    const weekdayIndex = (date.getDay() + 6) % 7;

    days.push({
      iso: toDateInputValue(date),
      label: day,
      weekday: weekdays[weekdayIndex] ?? "",
    });
  }

  return days;
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

export default function OnboardingProfilePage() {
  const router = useRouter();
  const { user, status } = useAuth();
  const dictionary = getDictionary();
  const copy = dictionary.onboarding.profile;

  const [companySuggestions, setCompanySuggestions] = useState<string[]>([...fallbackCompanies]);
  const [companyInput, setCompanyInput] = useState("");
  const [targetPosition, setTargetPosition] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [prepGoal, setPrepGoal] = useState("");
  const [grade, setGrade] = useState("");
  const [step, setStep] = useState<OnboardingStep>("company");
  const [customCalendarOpen, setCustomCalendarOpen] = useState(false);
  const [customMonthOffset, setCustomMonthOffset] = useState(3);
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

  const months = useMemo(() => {
    const today = new Date();
    return [0, 1, 2].map((offset) => new Date(today.getFullYear(), today.getMonth() + offset, 1));
  }, []);

  const customMonth = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + customMonthOffset, 1);
  }, [customMonthOffset]);

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
    async (topics = selectedTopics) => {
      setSaving(true);
      setSaveError("");
      try {
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        await updateProfile({
          target_company: selectedCompanies[0] ?? "",
          target_position: targetPosition.trim() || undefined,
          interview_date: selectedDate ? `${selectedDate}T09:00:00Z` : undefined,
          prep_goal: prepGoal.trim() || undefined,
          grade: grade || undefined,
          timezone,
          onboarding_completed: true,
        });
        // Topics have no backend field — keep them in localStorage.
        window.localStorage.setItem(
          onboardingStorageKey,
          JSON.stringify({ topics, savedAt: new Date().toISOString() }),
        );
        setStep("welcome");
      } catch (e) {
        setSaveError(e instanceof ApiError ? e.message : onboardingApiCopy.saveFailed);
      } finally {
        setSaving(false);
      }
    },
    [grade, prepGoal, selectedCompanies, selectedDate, selectedTopics, targetPosition],
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
      setCustomCalendarOpen(false);
      setStep("topics");
    }

    if (step === "topics") {
      setSelectedTopics([]);
      setStep("goal");
    }

    if (step === "goal") {
      setPrepGoal("");
      setGrade("");
      void saveProfile([]);
    }
  }, [saveProfile, step]);

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const renderCalendarMonth = (month: Date) => (
    <article className="onboarding-month" key={month.toISOString()}>
      <h3>{monthLabel(month)}</h3>
      <div>
        {buildCalendarMonth(month, copy.date.weekdays).map((day, index) =>
          day ? (
            <button
              className={selectedDate === day.iso ? "selected" : ""}
              key={day.iso}
              type="button"
              onClick={() => selectDate(day.iso)}
            >
              <span>{day.weekday}</span>
              <strong>{day.label}</strong>
            </button>
          ) : (
            <i aria-hidden="true" key={`${month.toISOString()}-${index}`} />
          ),
        )}
      </div>
    </article>
  );

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
                <dt>{onboardingApiCopy.summaryPosition}</dt>
                <dd>{targetPosition.trim() || summary.empty}</dd>
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
              <label className="onboarding-input">
                {onboardingApiCopy.positionLabel}
                <input
                  autoComplete="organization-title"
                  placeholder={onboardingApiCopy.positionPlaceholder}
                  value={targetPosition}
                  onChange={(event) => setTargetPosition(event.target.value)}
                />
              </label>
            </div>
          ) : null}

          {step === "date" ? (
            <div className="onboarding-main">
              <div className="onboarding-calendar" aria-label={copy.date.calendarLabel}>
                <div className="onboarding-months">{months.map((month) => renderCalendarMonth(month))}</div>
              </div>
              <div className="onboarding-custom-date">
                <button
                  className={customCalendarOpen ? "active" : ""}
                  type="button"
                  onClick={() => setCustomCalendarOpen((value) => !value)}
                >
                  {copy.date.customLabel}
                </button>
                {customCalendarOpen ? (
                  <div className="onboarding-custom-calendar">
                    <div className="onboarding-custom-calendar__head">
                      <button type="button" onClick={() => setCustomMonthOffset((value) => Math.max(3, value - 1))}>
                        ←
                      </button>
                      <span>{monthLabel(customMonth)}</span>
                      <button type="button" onClick={() => setCustomMonthOffset((value) => value + 1)}>
                        →
                      </button>
                    </div>
                    {renderCalendarMonth(customMonth)}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === "topics" ? (
            <div className="onboarding-main">
              <div className="onboarding-topics-grid" role="group" aria-label={copy.topics.fieldLabel}>
                {algorithmTopics.map((topic) => {
                  const selected = selectedTopics.includes(topic.id);

                  return (
                    <button
                      aria-pressed={selected}
                      className={selected ? "selected" : ""}
                      key={topic.id}
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                    >
                      <i aria-hidden="true" />
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
