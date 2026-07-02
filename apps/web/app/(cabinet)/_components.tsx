import type { ReactNode } from "react";

import { CabinetIcon } from "./_icons";

export function CabinetPanel({
  eyebrow,
  title,
  meta,
  children,
}: Readonly<{
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <section className="cabinet-panel">
      <div className="cabinet-panel__head">
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {meta ?? null}
      </div>
      {children}
    </section>
  );
}

/** Tiny inline sparkline; renders nothing for fewer than two points. */
export function Sparkline({
  data,
  width = 64,
  height = 20,
  className,
}: Readonly<{
  data: readonly number[];
  width?: number;
  height?: number;
  className?: string;
}>) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((value, index) => {
      const x = index * step;
      const y = height - 2 - ((value - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

export type MetricTone = "default" | "accent" | "success" | "warning";
export type MetricDeltaTone = "up" | "down" | "warn" | "flat";

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
  tooltip,
  delta,
  deltaTone = "flat",
  series,
}: Readonly<{
  label: string;
  value: string;
  hint: string;
  tone?: MetricTone;
  icon?: string;
  tooltip?: string;
  delta?: string;
  deltaTone?: MetricDeltaTone;
  series?: readonly number[];
}>) {
  return (
    <article className={`metric-card metric-card--${tone}`} tabIndex={tooltip ? 0 : undefined}>
      <div className="metric-card__top">
        {icon ? <CabinetIcon name={icon} /> : null}
        <span>{label}</span>
      </div>
      <div className="metric-card__value">
        <strong>{value}</strong>
        {delta ? (
          <span className={`metric-card__delta metric-card__delta--${deltaTone}`}>{delta}</span>
        ) : null}
      </div>
      <p>{hint}</p>
      {series ? <Sparkline className="metric-card__spark" data={series} /> : null}
      {tooltip ? (
        <span className="metric-card__tip" role="tooltip">
          {tooltip}
        </span>
      ) : null}
    </article>
  );
}

export function ProgressBar({
  value,
  label,
  tone = "default",
}: Readonly<{
  value: number;
  label?: string;
  tone?: "default" | "warning" | "danger";
}>) {
  return (
    <div
      className={tone === "default" ? "progress-line" : `progress-line progress-line--${tone}`}
      aria-label={label}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

export function StatusPill({
  children,
  tone = "default",
}: Readonly<{
  children: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}>) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}

/** Contribution-style activity heatmap: columns are weeks, rows are weekdays. */
export function ActivityHeatmap({
  weeks,
  ariaLabel,
  footLeft,
  scaleLess,
  scaleMore,
}: Readonly<{
  weeks: readonly (readonly number[])[];
  ariaLabel: string;
  footLeft: string;
  scaleLess: string;
  scaleMore: string;
}>) {
  const lastWeek = weeks.length - 1;
  const lastDay = (weeks[lastWeek]?.length ?? 1) - 1;

  return (
    <>
      <div className="heatmap" role="img" aria-label={ariaLabel}>
        {weeks.map((week, weekIndex) => (
          <div className="heatmap__week" key={weekIndex}>
            {week.map((level, dayIndex) => {
              const isToday = weekIndex === lastWeek && dayIndex === lastDay;
              const levelClass = level > 0 ? ` heatmap__cell--${level}` : "";
              return (
                <i
                  className={`heatmap__cell${levelClass}${isToday ? " heatmap__cell--today" : ""}`}
                  key={dayIndex}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="heatmap-foot">
        <span>{footLeft}</span>
        <span className="heatmap-foot__scale">
          {scaleLess}
          <i style={{ background: "rgba(255, 255, 255, 0.045)" }} />
          <i style={{ background: "rgba(56, 139, 253, 0.22)" }} />
          <i style={{ background: "rgba(56, 139, 253, 0.42)" }} />
          <i style={{ background: "rgba(56, 139, 253, 0.68)" }} />
          <i style={{ background: "var(--accent-bright)" }} />
          {scaleMore}
        </span>
      </div>
    </>
  );
}
