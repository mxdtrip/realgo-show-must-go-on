import type { ReactNode } from "react";

export function CabinetPanel({
  eyebrow,
  title,
  children,
}: Readonly<{
  eyebrow?: string;
  title: string;
  children: ReactNode;
}>) {
  return (
    <section className="cabinet-panel">
      <div className="cabinet-panel__head">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: Readonly<{
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "accent" | "success" | "warning";
}>) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

export function ProgressBar({
  value,
  label,
}: Readonly<{
  value: number;
  label?: string;
}>) {
  return (
    <div className="progress-line" aria-label={label}>
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
