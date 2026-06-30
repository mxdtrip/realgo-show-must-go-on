"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { StatusPill } from "../../_components";

const profileStorageKey = "engram:profile-settings:v1";
const onboardingStorageKey = "engram:onboarding-profile:v1";

const suggestedTimezones = [
  "UTC",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
] as const;

type ProfileSettings = {
  timezone: string;
  interviewDate: string;
};

type ProfileSettingsPanelProps = {
  copy: {
    email: string;
    emailLabel: string;
    interviewDate: string;
    interviewDateLabel: string;
    plan: string;
    planLabel: string;
    save: string;
    saved: string;
    timezone: string;
    timezoneLabel: string;
    timezonePlaceholder: string;
  };
};

function parseStoredProfile(raw: string | null): Partial<ProfileSettings> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return {
      timezone: typeof parsed.timezone === "string" ? parsed.timezone : undefined,
      interviewDate: typeof parsed.interviewDate === "string" ? parsed.interviewDate : undefined,
    };
  } catch {
    return {};
  }
}

export function ProfileSettingsPanel({ copy }: Readonly<ProfileSettingsPanelProps>) {
  const defaults = useMemo(
    () => ({ timezone: copy.timezone, interviewDate: copy.interviewDate }),
    [copy.interviewDate, copy.timezone],
  );
  const [profile, setProfile] = useState<ProfileSettings>(defaults);
  const [didSave, setDidSave] = useState(false);

  useEffect(() => {
    const stored = parseStoredProfile(window.localStorage.getItem(profileStorageKey));
    const onboarding = parseStoredProfile(window.localStorage.getItem(onboardingStorageKey));
    const nextProfile = {
      timezone: stored.timezone?.trim() || defaults.timezone,
      interviewDate: stored.interviewDate ?? onboarding.interviewDate ?? defaults.interviewDate,
    };

    setProfile(nextProfile);
  }, [defaults]);

  const update = (patch: Partial<ProfileSettings>) => {
    setDidSave(false);
    setProfile((current) => ({ ...current, ...patch }));
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextProfile = {
      timezone: String(formData.get("timezone") ?? "").trim(),
      interviewDate: String(formData.get("interviewDate") ?? ""),
    };
    window.localStorage.setItem(profileStorageKey, JSON.stringify(nextProfile));

    const onboardingRaw = window.localStorage.getItem(onboardingStorageKey);
    if (onboardingRaw) {
      try {
        const onboarding = JSON.parse(onboardingRaw) as Record<string, unknown>;
        window.localStorage.setItem(
          onboardingStorageKey,
          JSON.stringify({ ...onboarding, interviewDate: nextProfile.interviewDate }),
        );
      } catch {
        // Keep profile settings usable even if an old onboarding mock is malformed.
      }
    }

    setProfile(nextProfile);
    setDidSave(true);
  };

  return (
    <form className="settings-list profile-settings-list" onSubmit={save}>
      <div>
        <span>{copy.emailLabel}</span>
        <strong>{copy.email}</strong>
      </div>
      <label className="settings-profile-field">
        <span>{copy.timezoneLabel}</span>
        <input
          list="engram-timezones"
          name="timezone"
          placeholder={copy.timezonePlaceholder}
          value={profile.timezone}
          onChange={(event) => update({ timezone: event.target.value })}
        />
        <datalist id="engram-timezones">
          {suggestedTimezones.map((timezone) => (
            <option key={timezone} value={timezone} />
          ))}
        </datalist>
      </label>
      <label className="settings-profile-field">
        <span>{copy.interviewDateLabel}</span>
        <input
          name="interviewDate"
          type="date"
          value={profile.interviewDate}
          onChange={(event) => update({ interviewDate: event.target.value })}
        />
      </label>
      <div>
        <span>{copy.planLabel}</span>
        <StatusPill tone="accent">{copy.plan}</StatusPill>
      </div>
      <div className="profile-settings-actions">
        <button disabled={!profile.timezone.trim()} type="submit">
          {copy.save}
        </button>
        <small aria-live="polite">{didSave ? copy.saved : ""}</small>
      </div>
    </form>
  );
}
