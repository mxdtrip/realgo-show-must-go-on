"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { getDictionary } from "../../../_content/i18n";

const companiesEndpoint = "https://api.github.com/repos/liquidslr/leetcode-company-wise-problems/contents?ref=main";

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

type CompanyApiItem = {
  name?: string;
  type?: string;
};

type CalendarDay = {
  iso: string;
  label: number;
  weekday: string;
};

type OnboardingStep = "company" | "date" | "topics" | "welcome";

const steps: OnboardingStep[] = ["company", "date", "topics"];
const onboardingStorageKey = "engram:onboarding-profile:v1";

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(date: Date, locale = "ru-RU") {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
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

export default function OnboardingProfilePage() {
  const router = useRouter();
  const dictionary = getDictionary();
  const copy = dictionary.onboarding.profile;
  const [companies, setCompanies] = useState<string[]>([...fallbackCompanies]);
  const [companyInput, setCompanyInput] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [step, setStep] = useState<OnboardingStep>("company");
  const [customCalendarOpen, setCustomCalendarOpen] = useState(false);
  const [customMonthOffset, setCustomMonthOffset] = useState(3);

  const currentStepIndex = Math.max(0, steps.indexOf(step));
  const selectedCompanies = useMemo(() => splitCompanies(companyInput), [companyInput]);

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
    return companies
      .filter((item) => item.toLowerCase().includes(query) && !used.has(item.toLowerCase()))
      .slice(0, 6);
  }, [companies, companyInput, selectedCompanies]);

  useEffect(() => {
    let ignore = false;

    async function loadCompanies() {
      try {
        const response = await fetch(companiesEndpoint);
        if (!response.ok) return;
        const data = (await response.json()) as CompanyApiItem[];
        const names = data
          .filter((item) => item.type === "dir" && typeof item.name === "string")
          .map((item) => item.name as string)
          .sort((first, second) => first.localeCompare(second));

        if (!ignore && names.length > 0) {
          setCompanies(names);
        }
      } catch {
        // Fallback companies keep the mock onboarding usable offline.
      }
    }

    void loadCompanies();
    return () => {
      ignore = true;
    };
  }, []);

  const toggleTopic = useCallback((topicId: string) => {
    setSelectedTopics((current) =>
      current.includes(topicId) ? current.filter((item) => item !== topicId) : [...current, topicId],
    );
  }, []);

  const saveProfile = useCallback(
    (topics = selectedTopics) => {
      window.localStorage.setItem(
        onboardingStorageKey,
        JSON.stringify({
          companies: selectedCompanies,
          interviewDate: selectedDate,
          topics,
          savedAt: new Date().toISOString(),
        }),
      );
    },
    [selectedCompanies, selectedDate, selectedTopics],
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

    saveProfile();
    setStep("welcome");
  }, [saveProfile, step]);

  const goBack = useCallback(() => {
    if (step === "date") setStep("company");
    if (step === "topics") setStep("date");
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
      saveProfile([]);
      setStep("welcome");
    }
  }, [saveProfile, step]);

  const skipAll = useCallback(() => {
    window.localStorage.setItem(
      onboardingStorageKey,
      JSON.stringify({
        companies: [],
        interviewDate: "",
        topics: [],
        savedAt: new Date().toISOString(),
      }),
    );
    setStep("welcome");
  }, []);

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

  if (step === "welcome") {
    return (
      <main className="onboarding-page onboarding-page--welcome">
        <div className="onboarding-glow" aria-hidden="true" />
        <div className="onboarding-welcome-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <section className="onboarding-welcome">
          <a className="site-brand" href="/">
            {dictionary.common.brand}
          </a>
          <span>{copy.welcome.eyebrow}</span>
          <h1>{copy.welcome.title}</h1>
          <p>{copy.welcome.description}</p>
          <button type="button" onClick={() => router.push("/dashboard")}>
            {copy.welcome.action}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-glow" aria-hidden="true" />

      <section className="onboarding-card" aria-live="polite">
        <header className="onboarding-head">
          <a className="site-brand" href="/">
            {dictionary.common.brand}
          </a>
          <div className="onboarding-progress">
            <span>{copy.stepLabel} {currentStepIndex + 1} / {steps.length}</span>
            <div>
              {steps.map((item, index) => (
                <i className={index <= currentStepIndex ? "active" : ""} key={item} />
              ))}
            </div>
          </div>
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </header>

        {step === "company" ? (
          <section className="onboarding-section onboarding-section--active onboarding-company">
            <div className="onboarding-section__copy">
              <span>01</span>
              <h2>{copy.company.title}</h2>
              <p>{copy.company.description}</p>
            </div>
            <div className="onboarding-step-main">
              <label className="onboarding-input">
                {copy.company.label}
                <input
                  autoComplete="organization"
                  list="engram-company-suggestions"
                  placeholder={copy.company.placeholder}
                  value={companyInput}
                  onChange={(event) => setCompanyInput(event.target.value)}
                />
              </label>
              <datalist id="engram-company-suggestions">
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
          </section>
        ) : null}

        {step === "date" ? (
          <section className="onboarding-section onboarding-section--active onboarding-date">
            <div className="onboarding-section__copy">
              <span>02</span>
              <h2>{copy.date.title}</h2>
              <p>{copy.date.description}</p>
            </div>
            <div className="onboarding-step-main">
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
          </section>
        ) : null}

        {step === "topics" ? (
          <section className="onboarding-section onboarding-section--active onboarding-topics">
            <div className="onboarding-section__copy">
              <span>03</span>
              <h2>{copy.topics.title}</h2>
              <p>{copy.topics.description}</p>
            </div>

            <div className="onboarding-topic-field" aria-label={copy.topics.fieldLabel}>
              <div className="onboarding-topic-center">
                <span>{selectedTopics.length > 0 ? copy.topics.selected : copy.topics.empty}</span>
              </div>
              {algorithmTopics.map((topic) => {
                const selectedIndex = selectedTopics.indexOf(topic.id);
                const selected = selectedIndex >= 0;
                const [centerX, centerY] = selected ? getCenterPosition(selectedIndex) : [50, 50];

                return (
                  <button
                    className={selected ? "selected" : ""}
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
          </section>
        ) : null}

        <footer className="onboarding-actions">
          <div>
            {step !== "company" ? (
              <button type="button" onClick={goBack}>
                {copy.back}
              </button>
            ) : null}
            <button type="button" onClick={skipAll}>
              {copy.finish.skipAll}
            </button>
          </div>
          <div>
            <button type="button" onClick={skipCurrent}>
              {copy.skip}
            </button>
            <button type="button" onClick={goNext}>
              {step === "topics" ? copy.finish.complete : copy.next}
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
