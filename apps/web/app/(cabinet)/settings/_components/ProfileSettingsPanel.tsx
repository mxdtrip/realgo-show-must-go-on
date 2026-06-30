"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  readProfileSettings,
  writeProfileSettings,
  type ProfileSettings,
} from "../../../_profile/profileSettings";
import { StatusPill } from "../../_components";

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

type ProfileSettingsPanelProps = {
  copy: {
    email: string;
    emailLabel: string;
    interviewDate: string;
    interviewDateLabel: string;
    plan: string;
    planLabel: string;
    quickSetup: string;
    save: string;
    saved: string;
    timezone: string;
    timezoneLabel: string;
    timezonePlaceholder: string;
  };
};

export function ProfileSettingsPanel({ copy }: Readonly<ProfileSettingsPanelProps>) {
  const defaults = useMemo(
    () => ({ timezone: copy.timezone, interviewDate: copy.interviewDate }),
    [copy.interviewDate, copy.timezone],
  );
  const [profile, setProfile] = useState<ProfileSettings>(defaults);
  const [didSave, setDidSave] = useState(false);

  useEffect(() => {
    setProfile(readProfileSettings(defaults));
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
    writeProfileSettings(nextProfile);

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
        <div>
          <button disabled={!profile.timezone.trim()} type="submit">
            {copy.save}
          </button>
          <Link href="/onboarding/profile">{copy.quickSetup}</Link>
        </div>
        <small aria-live="polite">{didSave ? copy.saved : ""}</small>
      </div>
    </form>
  );
}
