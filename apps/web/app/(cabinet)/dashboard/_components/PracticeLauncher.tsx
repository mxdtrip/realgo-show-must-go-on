"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getCardSession } from "../../../_api/cards";
import { getPractice } from "../../../_api/practice";
import { CabinetIcon } from "../../_icons";

export type PracticeLauncherCopy = Readonly<{
  eyebrow: string;
  title: string;
  metaUnits: Readonly<{ subpatterns: string; cards: string; minutes: string }>;
  emptyTitle: string;
  emptyMeta: string;
  start: string;
}>;

/** Дашборд-версия лаунчера практики: те же цифры, которые увидит
    /cards/session?scope=practice (перенесено сюда с шапки /cards). */
export function PracticeLauncher({ copy }: Readonly<{ copy: PracticeLauncherCopy }>) {
  const [practice, setPractice] = useState<{
    subpatterns: number;
    cards: number;
    minutes: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getPractice(controller.signal),
      getCardSession({ scope: "practice" }, controller.signal),
    ])
      .then(([practiceSet, session]) => {
        setPractice({
          subpatterns: practiceSet.subpatterns.length,
          cards: session.cards.length,
          minutes: session.estimatedMinutes,
        });
      })
      .catch(() => {
        // Лаунчер показывает пустое состояние.
      });
    return () => controller.abort();
  }, []);

  const hasPractice = practice !== null && practice.subpatterns > 0;

  return (
    <aside className="next-up">
      <div className="next-up__body">
        <span className="next-up__eyebrow">{copy.eyebrow}</span>
        <strong className="next-up__title">{hasPractice ? copy.title : copy.emptyTitle}</strong>
        <span className="next-up__meta">
          {hasPractice && practice
            ? `${practice.subpatterns} ${copy.metaUnits.subpatterns} · ${practice.cards} ${copy.metaUnits.cards} · ~${practice.minutes} ${copy.metaUnits.minutes}`
            : copy.emptyMeta}
        </span>
      </div>
      <div className="next-up__actions">
        {hasPractice ? (
          <Link className="cabinet-cta" href="/cards/session?scope=practice">
            {copy.start}
            <CabinetIcon name="arrow" />
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
