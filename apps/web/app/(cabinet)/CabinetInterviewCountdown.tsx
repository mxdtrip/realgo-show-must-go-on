"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../_api/AuthProvider";
import {
  onboardingProfileStorageKey,
  profileSettingsChangedEvent,
  profileSettingsStorageKey,
  readProfileSettings,
  type ProfileSettings,
} from "../_profile/profileSettings";

type InterviewCopy = {
  missing: string;
  past: string;
  prefix: string;
  today: string;
};

type CabinetInterviewCountdownProps = {
  copy: InterviewCopy;
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

function interviewMeta(dateValue: string, timezone: string, copy: InterviewCopy) {
  const days = daysUntil(dateValue, timezone);
  if (days === null) return `${copy.prefix} · ${copy.missing}`;
  if (days < 0) return `${copy.prefix} · ${copy.past}`;
  if (days === 0) return `${copy.prefix} · ${copy.today}`;
  return `${copy.prefix} · T−${days}d`;
}

export function CabinetInterviewCountdown({ copy }: Readonly<CabinetInterviewCountdownProps>) {
  // API-профиль — источник правды; localStorage лишь мгновенно отражает
  // локальные правки настроек до следующей загрузки пользователя.
  const { user } = useAuth();
  const userInterviewDate = user?.interview_date ? user.interview_date.slice(0, 10) : "";
  const userTimezone = user?.timezone ?? "";

  const [profile, setProfile] = useState<ProfileSettings>({
    timezone: userTimezone,
    interviewDate: userInterviewDate,
  });

  const refreshProfile = useCallback(() => {
    setProfile(readProfileSettings({ timezone: userTimezone, interviewDate: userInterviewDate }));
  }, [userInterviewDate, userTimezone]);

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

  // Без даты интервью (ни в профиле, ни в локальных настройках) бейдж не нужен.
  if (!profile.interviewDate) return null;

  return (
    <span className="cabinet-interview-countdown">
      {interviewMeta(profile.interviewDate, profile.timezone, copy)}
    </span>
  );
}
