"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";

import { updateProfile } from "../../../_api/account";
import { useAuth } from "../../../_api/AuthProvider";
import { searchCompanies, type Company } from "../../../_api/companies";
import {
  previewRoadmap,
  saveRoadmap,
  type RoadmapPriorityMode,
  type RoadmapResponse,
} from "../../../_api/roadmap";
import { ApiError } from "../../../_api/types";
import { getDictionary, onboardingApiCopy } from "../../../_content/i18n";
import { platformOptions, type PlatformId } from "../../../_profile/platforms";

const fallbackCompanies: readonly Company[] = [
  { id: "cmp_amazon", name: "Amazon", source: "fallback" },
  { id: "cmp_apple", name: "Apple", source: "fallback" },
  { id: "cmp_bloomberg", name: "Bloomberg", source: "fallback" },
  { id: "cmp_google", name: "Google", source: "fallback" },
  { id: "cmp_meta", name: "Meta", source: "fallback" },
  { id: "cmp_microsoft", name: "Microsoft", source: "fallback" },
  { id: "cmp_netflix", name: "Netflix", source: "fallback" },
  { id: "cmp_openai", name: "OpenAI", source: "fallback" },
  { id: "cmp_uber", name: "Uber", source: "fallback" },
  { id: "cmp_yandex", name: "Yandex", source: "fallback" },
] as const;

const fallbackCompanyCodes = Object.fromEntries(
  fallbackCompanies.map((company) => [company.name.toLowerCase(), company.id]),
);

type OnboardingStep = "platform" | "company" | "date" | "roadmap" | "welcome";

const steps: OnboardingStep[] = ["platform", "company", "date", "roadmap"];
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
  const drag = useRef<{ startY: number; startScrollTop: number; moved: boolean } | null>(null);
  // dragging — кнопка мыши физически зажата (курсор grabbing, снап выключен);
  // momentum — инерция докатывает колесо после отпускания (снап выключен,
  // но курсор уже обычный — рука пользователя ни на чём не «висит»).
  const [dragging, setDragging] = useState(false);
  const [momentum, setMomentum] = useState(false);
  // Последние точки движения (время + Y) — на них считаем скорость в момент
  // отпускания, чтобы после резкого протягивания колесо докатилось по инерции,
  // а не встало ровно там, где отпустили палец/кнопку мыши.
  const velocitySamples = useRef<{ time: number; y: number }[]>([]);
  const momentumFrame = useRef(0);

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

  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current);
      cancelAnimationFrame(momentumFrame.current);
    },
    [],
  );

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

  // Тач/трекпад скроллят колесо нативно, но у мыши нет жеста «свайп» —
  // без этого перетащить колесо можно только по одному клику на пункт.
  // Pointer Events покрывают мышь и тач одним кодом; сам скролл (снап,
  // settle-таймер) остаётся в handleScroll, drag просто двигает scrollTop.
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return; // тач уже скроллится нативно
    const el = listRef.current;
    if (!el) return;
    cancelAnimationFrame(momentumFrame.current);
    setMomentum(false);
    drag.current = { startY: event.clientY, startScrollTop: el.scrollTop, moved: false };
    velocitySamples.current = [{ time: performance.now(), y: event.clientY }];
    el.setPointerCapture(event.pointerId);
    setDragging(true);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const el = listRef.current;
    const state = drag.current;
    if (!el || !state) return;
    // pointerup/pointercancel не всегда долетают (отпустили за пределами
    // окна и т.п.) — buttons===0 значит кнопка уже не зажата, самолечим
    // застрявший drag, а не тащим колесо от простого движения курсора.
    if (event.buttons !== 1) {
      drag.current = null;
      setDragging(false);
      return;
    }
    const delta = event.clientY - state.startY;
    if (Math.abs(delta) > 3) state.moved = true;
    el.scrollTop = state.startScrollTop - delta;

    const now = performance.now();
    velocitySamples.current.push({ time: now, y: event.clientY });
    // Скорость нужна только по самому концу протягивания — старые точки
    // (>100мс) выкидываем, иначе долгое неспешное движение перед резким
    // финальным броском смажет расчёт инерции.
    velocitySamples.current = velocitySamples.current.filter((sample) => now - sample.time <= 100);
  }, []);

  // Инерция после резкого протягивания: докатываем колесо по скорости в
  // момент отпускания и гасим её экспоненциально, как нативный momentum-скролл.
  const runMomentum = useCallback(
    (initialVelocity: number) => {
      const el = listRef.current;
      if (!el) return;
      let velocity = initialVelocity; // px/ms, знак — направление scrollTop
      let lastTime = performance.now();

      const step = () => {
        const now = performance.now();
        const dt = now - lastTime;
        lastTime = now;

        const maxScroll = el.scrollHeight - el.clientHeight;
        el.scrollTop = Math.max(0, Math.min(maxScroll, el.scrollTop + velocity * dt));
        velocity *= Math.pow(0.995, dt);

        const atBound = el.scrollTop <= 0 || el.scrollTop >= maxScroll;
        if (Math.abs(velocity) < 0.02 || atBound) {
          setMomentum(false);
          return;
        }
        momentumFrame.current = requestAnimationFrame(step);
      };

      setMomentum(true);
      momentumFrame.current = requestAnimationFrame(step);
    },
    [],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag.current) return;
      listRef.current?.releasePointerCapture(event.pointerId);
      drag.current = null;
      setDragging(false);

      const samples = velocitySamples.current;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last && first ? last.time - first.time : 0;
      if (last && first && dt > 0) {
        const velocity = -(last.y - first.y) / dt; // знак: см. scrollTop = startScrollTop - delta
        if (Math.abs(velocity) > 0.05) runMomentum(velocity);
      }
    },
    [runMomentum],
  );

  return (
    <div className="onboarding-wheel" role="listbox" aria-label={ariaLabel}>
      <div className="onboarding-wheel__band" aria-hidden="true" />
      <div
        className={[
          "onboarding-wheel__list",
          dragging ? "is-dragging" : "",
          !dragging && momentum ? "is-momentum" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        ref={listRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="option"
            aria-selected={item.key === value}
            className={item.key === centered ? "is-active" : undefined}
            onClick={() => {
              if (drag.current?.moved) return;
              onChange(item.key);
            }}
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

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | "">("");
  const [companySuggestions, setCompanySuggestions] = useState<Company[]>([...fallbackCompanies]);
  const [companyCodesByName, setCompanyCodesByName] = useState<Record<string, string>>(fallbackCompanyCodes);
  const [companyInput, setCompanyInput] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [priorityMode, setPriorityMode] = useState<RoadmapPriorityMode>("balanced");
  const [step, setStep] = useState<OnboardingStep>("platform");
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
  const targetCompany = companyInput.trim();
  const targetCompanyCode = companyCodesByName[targetCompany.toLowerCase()] ?? "";
  const currentStepHasValue =
    (step === "platform" && selectedPlatform.length > 0) ||
    (step === "company" && targetCompany.length > 0) ||
    (step === "date" && selectedDate.length > 0) ||
    step === "roadmap";

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
    const query = companyInput.trim().toLowerCase();
    if (query.length < 2) return [];
    return companySuggestions
      .filter((item) => item.name.toLowerCase().includes(query) && item.name.toLowerCase() !== query)
      .slice(0, 6);
  }, [companySuggestions, companyInput]);

  // Debounced company autocomplete from the backend API.
  useEffect(() => {
    const query = companyInput.trim();
    if (query.trim().length < 2) {
      setCompanySuggestions([...fallbackCompanies]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await searchCompanies(query.trim(), controller.signal, 8);
        if (!controller.signal.aborted) {
          setCompanySuggestions(results);
          setCompanyCodesByName((current) => ({
            ...current,
            ...Object.fromEntries(results.map((company) => [company.name.toLowerCase(), company.id])),
          }));
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

  const [roadmapResult, setRoadmapResult] = useState<RoadmapResponse | null>(null);
  const [roadmapLoadState, setRoadmapLoadState] = useState<"idle" | "loading" | "loaded" | "error">(
    "idle",
  );
  const previewWeeks = roadmapResult?.weeks ?? [];
  const previewTopicsCount = roadmapResult?.selectedCount ?? 0;
  const weeksCount = roadmapResult?.horizonWeeks ?? 4;

  // Роадмап тянет реальные релевантные компании субпаттерны из атласа,
  // поэтому пересчитываем при входе на шаг и при смене входных данных.
  useEffect(() => {
    if (step !== "roadmap") return;
    const controller = new AbortController();
    setRoadmapLoadState("loading");
    previewRoadmap(
      {
        companyCode: targetCompanyCode,
        companyName: targetCompany,
        interviewDate: selectedDate || null,
        priorityMode,
        preserveProgress: false,
      },
      controller.signal,
    )
      .then((result) => {
        setRoadmapResult(result);
        setPriorityMode(result.priorityMode);
        setRoadmapLoadState("loaded");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setRoadmapLoadState("error");
      });
    return () => controller.abort();
  }, [priorityMode, selectedDate, step, targetCompany, targetCompanyCode]);

  const saveProfile = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const result = await saveRoadmap({
        companyCode: targetCompanyCode,
        companyName: targetCompany,
        interviewDate: selectedDate || null,
        priorityMode,
        preserveProgress: false,
      });

      // Persist every client-side prerequisite before committing
      // onboarding_completed on the server. A failed roadmap request can now
      // be retried without the auth guard skipping this page on reload.
      window.localStorage.setItem(
        onboardingStorageKey,
        JSON.stringify({
          platform: selectedPlatform || null,
          interviewDate: selectedDate || null,
          targetCompany: targetCompany || null,
          targetCompanyCode: targetCompanyCode || null,
          priorityMode,
          savedAt: new Date().toISOString(),
        }),
      );

      await updateProfile({
        target_company: targetCompany,
        interview_date: selectedDate ? `${selectedDate}T09:00:00Z` : undefined,
        platform: selectedPlatform || undefined,
        timezone,
        onboarding_completed: true,
      });
      setRoadmapResult(result);
      setStep("welcome");
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : onboardingApiCopy.saveFailed);
    } finally {
      setSaving(false);
    }
  }, [priorityMode, selectedDate, selectedPlatform, targetCompany, targetCompanyCode]);

  const goNext = useCallback(() => {
    if (step === "platform") {
      setStep("company");
      return;
    }

    if (step === "company") {
      setStep("date");
      return;
    }

    if (step === "date") {
      setStep("roadmap");
      return;
    }

    // step === "roadmap" → save and transition to welcome on success.
    void saveProfile();
  }, [saveProfile, step]);

  const goBack = useCallback(() => {
    if (step === "company") setStep("platform");
    if (step === "date") setStep("company");
    if (step === "roadmap") setStep("date");
  }, [step]);

  const skipCurrent = useCallback(() => {
    if (step === "platform") {
      setSelectedPlatform("");
      setStep("company");
    }

    if (step === "company") {
      setCompanyInput("");
      setStep("date");
    }

    if (step === "date") {
      setSelectedDate("");
      setStep("roadmap");
    }

    if (step === "roadmap") {
      void saveProfile();
    }
  }, [saveProfile, step]);

  // While auth status is being determined, render nothing.
  if (status === "loading") {
    return null;
  }

  if (step === "welcome") {
    const summary = copy.welcome.summary;
    const platformLabel = platformOptions.find((item) => item.id === selectedPlatform)?.label;

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
                <dt>{summary.platform}</dt>
                <dd>{platformLabel ?? summary.empty}</dd>
              </div>
              <div>
                <dt>{summary.companies}</dt>
                <dd>{targetCompany || summary.empty}</dd>
              </div>
              <div>
                <dt>{summary.date}</dt>
                <dd>{selectedDate ? fullDateLabel(selectedDate) : summary.empty}</dd>
              </div>
              <div>
                <dt>{summary.roadmap}</dt>
                <dd>
                  {previewWeeks.length > 0
                    ? `${previewWeeks.length} ${copy.roadmap.previewWeeksUnit}`
                    : summary.empty}
                </dd>
              </div>
              <div>
                <dt>{summary.priority}</dt>
                <dd>{copy.roadmap.modes[priorityMode].title}</dd>
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
  const visiblePriorityModes =
    roadmapResult?.availableModes ??
    (["balanced", "easy_first", ...(targetCompany ? ["company_frequency"] : [])] as RoadmapPriorityMode[]);

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
            <h2>{copy[step].title}</h2>
            <p>{copy[step].description}</p>
          </aside>

          {step === "platform" ? (
            <div className="onboarding-main">
              <div className="onboarding-platform-field" role="radiogroup" aria-label={copy.platform.fieldLabel}>
                {platformOptions.map((platform) => (
                  <button
                    aria-pressed={selectedPlatform === platform.id}
                    className={selectedPlatform === platform.id ? "selected" : ""}
                    key={platform.id}
                    role="radio"
                    aria-checked={selectedPlatform === platform.id}
                    style={{ "--platform-color": platform.color } as CSSProperties}
                    type="button"
                    onClick={() => setSelectedPlatform(platform.id)}
                  >
                    {platform.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
              {targetCompany ? (
                <div className="selected-companies" aria-label={copy.company.selectedLabel}>
                  <button type="button" onClick={() => setCompanyInput("")}>
                    {targetCompany}
                    <span>×</span>
                  </button>
                </div>
              ) : null}
              {suggestions.length > 0 ? (
                <div className="company-suggestions" aria-label={copy.company.suggestionsLabel}>
                  {suggestions.map((item) => (
                    <button key={item.id} type="button" onClick={() => setCompanyInput(item.name)}>
                      {item.name}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="onboarding-hint">{copy.company.skipHint}</p>
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

          {step === "roadmap" ? (
            <div className="onboarding-main">
              <section className="onboarding-priority" aria-label={copy.roadmap.priorityLabel}>
                <div className="onboarding-priority__head">
                  <strong>{copy.roadmap.priorityLabel}</strong>
                  <span>{copy.roadmap.priorityChangeLater}</span>
                </div>
                <div className="onboarding-priority__options">
                  {visiblePriorityModes.map((mode) => (
                    <button
                      aria-pressed={priorityMode === mode}
                      className={priorityMode === mode ? "selected" : ""}
                      key={mode}
                      type="button"
                      onClick={() => setPriorityMode(mode)}
                    >
                      <strong>{copy.roadmap.modes[mode].title}</strong>
                      {mode === "balanced" ? <em>{copy.roadmap.recommended}</em> : null}
                    </button>
                  ))}
                </div>
                <p>{copy.roadmap.modes[priorityMode].description}</p>
              </section>
              <p className="onboarding-wheels-result">
                {copy.roadmap.horizonLabel}: <em>{weeksCount} {copy.roadmap.previewWeeksUnit}</em>
              </p>
              {roadmapLoadState === "loading" ? (
                <p className="onboarding-hint">{copy.roadmap.previewLoading}</p>
              ) : roadmapLoadState === "error" ? (
                <p className="onboarding-save-error" role="alert">{copy.roadmap.previewError}</p>
              ) : !roadmapResult || roadmapResult.selectedCount === 0 ? (
                <div className="onboarding-roadmap-empty">
                  <strong>{copy.roadmap.noPoolTitle}</strong>
                  <p>{copy.roadmap.noPoolDescription}</p>
                </div>
              ) : (
                <div className="onboarding-roadmap-preview" aria-label={copy.roadmap.previewLabel}>
                  <div className="onboarding-roadmap-preview__head">
                    <span className="onboarding-roadmap-preview__count">
                      <em>{previewWeeks.length}</em> {copy.roadmap.previewWeeksUnit}
                    </span>
                    <span className="onboarding-roadmap-preview__count">
                      <em>{previewTopicsCount}</em> {copy.roadmap.previewTopicsUnit}
                    </span>
                    {roadmapResult.reserveCount > 0 ? (
                      <span className="onboarding-roadmap-preview__count">
                        <em>{roadmapResult.reserveCount}</em> {copy.roadmap.previewReserveUnit}
                      </span>
                    ) : null}
                  </div>
                  <ol className="onboarding-roadmap-preview__list">
                    {previewWeeks.slice(0, 8).map((week, index) => (
                      <li key={week.id}>
                        <span className="onboarding-roadmap-preview__num">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong>{week.title}</strong>
                          <span>{week.focus}</span>
                        </div>
                      </li>
                    ))}
                    {previewWeeks.length > 8 ? (
                      <li className="onboarding-roadmap-preview__more">
                        +{previewWeeks.length - 8} {copy.roadmap.previewWeeksUnit}
                      </li>
                    ) : null}
                  </ol>
                </div>
              )}
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
            {step !== "platform" ? (
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
