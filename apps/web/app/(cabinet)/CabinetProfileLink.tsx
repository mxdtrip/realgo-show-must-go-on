"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  onboardingProfileStorageKey,
  profileSettingsChangedEvent,
  profileSettingsStorageKey,
  readProfileSettings,
  type ProfileSettings,
} from "../_profile/profileSettings";
import { CabinetIcon } from "./_icons";

type CabinetProfileLinkProps = {
  copy: {
    interview: {
      dayFew: string;
      dayMany: string;
      dayOne: string;
      missing: string;
      past: string;
      prefix: string;
      today: string;
    };
    menuAria: string;
    monogram: string;
    name: string;
    plan: string;
  };
  defaultInterviewDate: string;
  defaultTimezone: string;
};

function currentDateInTimezone(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return [Number(values.year), Number(values.month), Number(values.day)] as const;
  } catch {
    const today = new Date();
    return [today.getFullYear(), today.getMonth() + 1, today.getDate()] as const;
  }
}

function daysUntil(dateValue: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return null;

  const [, year, month, day] = match;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const target = Date.UTC(numericYear, numericMonth - 1, numericDay);
  const normalizedTarget = new Date(target);
  if (
    normalizedTarget.getUTCFullYear() !== numericYear ||
    normalizedTarget.getUTCMonth() !== numericMonth - 1 ||
    normalizedTarget.getUTCDate() !== numericDay
  ) {
    return null;
  }

  const [currentYear, currentMonth, currentDay] = currentDateInTimezone(timezone);
  const current = Date.UTC(currentYear, currentMonth - 1, currentDay);
  return Math.round((target - current) / 86_400_000);
}

function interviewMeta(
  dateValue: string,
  timezone: string,
  copy: CabinetProfileLinkProps["copy"]["interview"],
) {
  const days = daysUntil(dateValue, timezone);
  if (days === null) return `${copy.prefix} · ${copy.missing}`;
  if (days < 0) return `${copy.prefix} · ${copy.past}`;
  if (days === 0) return `${copy.prefix} · ${copy.today}`;

  const plural = new Intl.PluralRules("ru-RU").select(days);
  const unit = plural === "one" ? copy.dayOne : plural === "few" ? copy.dayFew : copy.dayMany;
  return `${copy.prefix} · через ${days} ${unit}`;
}

export function CabinetProfileLink({
  copy,
  defaultInterviewDate,
  defaultTimezone,
}: Readonly<CabinetProfileLinkProps>) {
  const [profile, setProfile] = useState<ProfileSettings>({
    timezone: defaultTimezone,
    interviewDate: defaultInterviewDate,
  });

  const refreshProfile = useCallback(() => {
    setProfile(readProfileSettings({ timezone: defaultTimezone, interviewDate: defaultInterviewDate }));
  }, [defaultInterviewDate, defaultTimezone]);

  useEffect(() => {
    refreshProfile();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === profileSettingsStorageKey ||
        event.key === onboardingProfileStorageKey ||
        event.key === null
      ) {
        refreshProfile();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(profileSettingsChangedEvent, refreshProfile);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(profileSettingsChangedEvent, refreshProfile);
    };
  }, [refreshProfile]);

  return (
    <Link className="cabinet-user" href="/settings" aria-label={copy.menuAria}>
      <span className="cabinet-user__avatar" aria-hidden="true">
        {copy.monogram}
      </span>
      <span className="cabinet-user__body">
        <span className="cabinet-user__name">{copy.name}</span>
        <span className="cabinet-user__meta">
          {interviewMeta(profile.interviewDate, profile.timezone, copy.interview)}
        </span>
        <span className="cabinet-user__plan">{copy.plan}</span>
      </span>
      <CabinetIcon className="cabinet-user__chevron" name="selector" />
    </Link>
  );
}
