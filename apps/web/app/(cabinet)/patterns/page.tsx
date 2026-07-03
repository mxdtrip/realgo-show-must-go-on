import Link from "next/link";

import { CabinetPanel, ProgressBar } from "../_components";
import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import { strongPatterns, weakPatterns } from "../_mock";

type Pattern = {
  name: string;
  code: string;
  confidence: number;
  trend: number;
  signal: string;
};

export default function PatternsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.patterns;

  const weak = [...weakPatterns].sort((a, b) => a.confidence - b.confidence);
  const strong = [...strongPatterns].sort((a, b) => b.confidence - a.confidence);
  const needAttention = weak.filter((pattern) => pattern.confidence < 60).length;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <div className="cabinet-page-head__actions">
          <div>
            <Link className="cabinet-cta" href="/cards/session">
              {copy.common.startSession}
              <CabinetIcon name="arrow" />
            </Link>
          </div>
          <span className="cabinet-next-hint">
            <em>{needAttention}</em> {page.summaryUnit}
          </span>
        </div>
      </section>

      <div className="cabinet-grid">
        <CabinetPanel
          eyebrow={page.weakColumnEyebrow}
          title={page.weakColumnTitle}
          meta={<span className="cabinet-panel__meta">{weak.length} patterns</span>}
        >
          <div className="pattern-stack">
            {weak.map((pattern) => (
              <WeakCard key={pattern.name} pattern={pattern} page={page} />
            ))}
          </div>
        </CabinetPanel>

        <CabinetPanel
          eyebrow={page.strongColumnEyebrow}
          title={page.strongColumnTitle}
          meta={<span className="cabinet-panel__meta">{strong.length} patterns</span>}
        >
          <div className="pattern-stack">
            {strong.length === 0 ? (
              <article>
                <p>{page.strongEmpty}</p>
              </article>
            ) : (
              strong.map((pattern) => (
                <StrongCard key={pattern.name} pattern={pattern} page={page} />
              ))
            )}
          </div>
        </CabinetPanel>
      </div>
    </main>
  );
}

function WeakCard({
  pattern,
  page,
}: Readonly<{ pattern: Pattern; page: ReturnType<typeof getDictionary>["cabinet"]["pages"]["patterns"] }>) {
  const severe = pattern.confidence < 45;
  const trendUp = pattern.trend > 0;
  return (
    <article>
      <div>
        <strong>
          <Link href={`/patterns/${pattern.code}`}>{pattern.name}</Link>
        </strong>
        <span className={severe ? "confidence--danger" : "confidence--warning"}>
          {pattern.confidence}%
        </span>
      </div>
      <ProgressBar
        value={pattern.confidence}
        tone={severe ? "danger" : "warning"}
        label={`${pattern.name} confidence`}
      />
      <p>{pattern.signal}</p>
      <span className={`pattern-card__trend ${trendUp ? "is-up" : "is-down"}`}>
        {trendUp ? `+${pattern.trend}` : `−${-pattern.trend}`} {page.weeklyLabel}
      </span>
    </article>
  );
}

function StrongCard({
  pattern,
  page,
}: Readonly<{ pattern: Pattern; page: ReturnType<typeof getDictionary>["cabinet"]["pages"]["patterns"] }>) {
  const trendUp = pattern.trend >= 0;
  return (
    <article>
      <div>
        <strong>
          <Link href={`/patterns/${pattern.code}`}>{pattern.name}</Link>
        </strong>
        <span className="confidence--accent">{pattern.confidence}%</span>
      </div>
      <ProgressBar value={pattern.confidence} label={`${pattern.name} confidence`} />
      <p>{pattern.signal}</p>
      <span className={`pattern-card__trend ${trendUp ? "is-up" : "is-down"}`}>
        {trendUp ? `+${pattern.trend}` : `−${-pattern.trend}`} {page.weeklyLabel}
      </span>
    </article>
  );
}
