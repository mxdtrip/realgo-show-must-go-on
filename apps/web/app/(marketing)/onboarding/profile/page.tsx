"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
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
  date: Date;
  iso: string;
  label: number;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(date: Date, locale = "ru-RU") {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}

function buildCalendarMonth(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const mondayBasedOffset = (firstDay.getDay() + 6) % 7;
  const days: Array<CalendarDay | null> = Array.from({ length: mondayBasedOffset }, () => null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    days.push({
      date,
      iso: toDateInputValue(date),
      label: day,
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
  return positions[index % positions.length];
}

export default function OnboardingProfilePage() {
  const router = useRouter();
  const copy = getDictionary().onboarding.profile;
  const [companies, setCompanies] = useState<string[]>([...fallbackCompanies]);
  const [company, setCompany] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const months = useMemo(() => {
    const today = new Date();
    return [0, 1, 2].map((offset) => new Date(today.getFullYear(), today.getMonth() + offset, 1));
  }, []);

  const suggestions = useMemo(() => {
    const query = company.trim().toLowerCase();
    if (query.length < 2) return [];
    return companies
      .filter((item) => item.toLowerCase().includes(query))
      .slice(0, 6);
  }, [companies, company]);

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

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      window.localStorage.setItem(
        "engram:onboarding-profile:v1",
        JSON.stringify({
          company: company.trim(),
          interviewDate: customDate.trim() || selectedDate,
          topics: selectedTopics,
          savedAt: new Date().toISOString(),
        }),
      );
      router.push("/dashboard");
    },
    [company, customDate, router, selectedDate, selectedTopics],
  );

  return (
    <main className="onboarding-page">
      <div className="onboarding-glow" aria-hidden="true" />

      <form className="onboarding-card" onSubmit={handleSubmit}>
        <header className="onboarding-head">
          <a className="site-brand" href="/">
            {getDictionary().common.brand}
          </a>
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </header>

        <section className="onboarding-section onboarding-company">
          <div className="onboarding-section__copy">
            <span>01</span>
            <h2>{copy.company.title}</h2>
            <p>{copy.company.description}</p>
          </div>
          <label className="onboarding-input">
            {copy.company.label}
            <input
              autoComplete="organization"
              list="engram-company-suggestions"
              placeholder={copy.company.placeholder}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
          </label>
          <datalist id="engram-company-suggestions">
            {suggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          {suggestions.length > 0 ? (
            <div className="company-suggestions" aria-label={copy.company.suggestionsLabel}>
              {suggestions.map((item) => (
                <button key={item} type="button" onClick={() => setCompany(item)}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          <button className="onboarding-skip" type="button" onClick={() => setCompany("")}>
            {copy.skip}
          </button>
        </section>

        <section className="onboarding-section onboarding-date">
          <div className="onboarding-section__copy">
            <span>02</span>
            <h2>{copy.date.title}</h2>
            <p>{copy.date.description}</p>
          </div>
          <div className="onboarding-calendar" aria-label={copy.date.calendarLabel}>
            <div className="onboarding-weekdays">
              {copy.date.weekdays.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="onboarding-months">
              {months.map((month) => (
                <article className="onboarding-month" key={month.toISOString()}>
                  <h3>{monthLabel(month)}</h3>
                  <div>
                    {buildCalendarMonth(month).map((day, index) =>
                      day ? (
                        <button
                          className={selectedDate === day.iso ? "selected" : ""}
                          key={day.iso}
                          type="button"
                          onClick={() => {
                            setSelectedDate(day.iso);
                            setCustomDate("");
                          }}
                        >
                          {day.label}
                        </button>
                      ) : (
                        <span aria-hidden="true" key={`${month.toISOString()}-${index}`} />
                      ),
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <label className="onboarding-input">
            {copy.date.customLabel}
            <input
              placeholder={copy.date.customPlaceholder}
              value={customDate}
              onChange={(event) => {
                setCustomDate(event.target.value);
                setSelectedDate("");
              }}
            />
          </label>
          <button
            className="onboarding-skip"
            type="button"
            onClick={() => {
              setSelectedDate("");
              setCustomDate("");
            }}
          >
            {copy.skip}
          </button>
        </section>

        <section className="onboarding-section onboarding-topics">
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
          <button className="onboarding-skip" type="button" onClick={() => setSelectedTopics([])}>
            {copy.skip}
          </button>
        </section>

        <footer className="onboarding-actions">
          <button type="button" onClick={() => router.push("/dashboard")}>
            {copy.finish.skipAll}
          </button>
          <button type="submit">{copy.finish.continue}</button>
        </footer>
      </form>
    </main>
  );
}
