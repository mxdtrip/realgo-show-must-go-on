"use client";

// Страница паттерна (семейства атласа): чёрный «читальный» холст с
// фиксированными секциями. Тексты берутся из _content/pattern-profiles.ts;
// незаполненная секция показывает заглушку, список подпаттернов — из API.

import Link from "next/link";
import type { ReactNode } from "react";

import type { NodeDetail } from "../../../../_api/atlas";
import { patternProfiles } from "../../../../_content/pattern-profiles";
import type { getDictionary } from "../../../../_content/i18n";

type ProfileCopy = ReturnType<typeof getDictionary>["cabinet"]["pages"]["atlasNode"]["profile"];

export function PatternProfile({
  detail,
  copy,
}: Readonly<{ detail: NodeDetail; copy: ProfileCopy }>) {
  const content = patternProfiles[detail.code] ?? {};
  const recognize = content.recognize?.length
    ? content.recognize
    : detail.recognition_symptoms;
  const subs = detail.subpatterns ?? [];

  return (
    <article className="pattern-profile">
      <header className="pattern-profile__hero">
        <span className="pattern-profile__code">
          {copy.eyebrow} // {detail.code}
        </span>
        <h1>{detail.name}</h1>
        {detail.description ? (
          <p className="pattern-profile__lead">{detail.description}</p>
        ) : null}
      </header>

      <ProfileSection
        title={copy.sections.what.title}
        empty={!content.what?.length}
        pendingNote={copy.sections.what.pending}
        pendingBadge={copy.pendingBadge}
      >
        {content.what?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </ProfileSection>

      <ProfileSection
        title={copy.sections.recognize.title}
        hint={copy.sections.recognize.hint}
        empty={recognize.length === 0}
        pendingNote={copy.sections.recognize.pending}
        pendingBadge={copy.pendingBadge}
      >
        <ul className="pattern-profile__list pattern-profile__list--cues">
          {recognize.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection
        title={copy.sections.mechanics.title}
        hint={copy.sections.mechanics.hint}
        empty={!content.mechanics?.length}
        pendingNote={copy.sections.mechanics.pending}
        pendingBadge={copy.pendingBadge}
      >
        <ul className="pattern-profile__list pattern-profile__list--mechanics">
          {content.mechanics?.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection
        title={copy.sections.misfits.title}
        hint={copy.sections.misfits.hint}
        empty={!content.misfits?.length}
        pendingNote={copy.sections.misfits.pending}
        pendingBadge={copy.pendingBadge}
      >
        <ul className="pattern-profile__list pattern-profile__list--misfits">
          {content.misfits?.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection
        title={copy.subpatterns.title}
        hint={copy.subpatterns.hint}
        empty={subs.length === 0}
        pendingNote={copy.subpatterns.empty}
        pendingBadge={copy.pendingBadge}
      >
        <ul className="pattern-profile__subs">
          {subs.map((sub, position) => (
            <li key={sub.code}>
              <Link href={`/patterns/${sub.code}`}>
                <span className="pattern-profile__sub-head">
                  <span className="pattern-profile__sub-index">
                    {String(position + 1).padStart(2, "0")}
                  </span>
                  <span className="pattern-profile__sub-arrow" aria-hidden="true">
                    →
                  </span>
                </span>
                <span className="pattern-profile__sub-name">{sub.name}</span>
                <span
                  className={
                    content.subpatternNotes?.[sub.code]
                      ? "pattern-profile__sub-note"
                      : "pattern-profile__sub-note is-pending"
                  }
                >
                  {content.subpatternNotes?.[sub.code] ?? copy.subpatterns.notePending}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </ProfileSection>
    </article>
  );
}

export function ProfileSection({
  title,
  hint,
  empty,
  pendingNote,
  pendingBadge,
  children,
}: Readonly<{
  title: string;
  hint?: string;
  empty: boolean;
  pendingNote: string;
  pendingBadge: string;
  children: ReactNode;
}>) {
  return (
    <section className="pattern-profile__section">
      <header className="pattern-profile__rail">
        <h2>{title}</h2>
        {hint ? <p>{hint}</p> : null}
      </header>
      <div className="pattern-profile__body">
        {empty ? (
          <p className="pattern-profile__pending">
            <span>{pendingBadge}</span>
            {pendingNote}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
