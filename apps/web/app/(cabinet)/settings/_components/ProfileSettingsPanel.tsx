"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { updateProfile } from "../../../_api/account";
import { ApiError } from "../../../_api/types";
import {
  readProfileSettings,
  writeProfileSettings,
  type ProfileSettings,
} from "../../../_profile/profileSettings";
import { platformOptions, type PlatformId } from "../../../_profile/platforms";
import { useToast } from "../../../_toast";
import { useAuth } from "../../../_api/AuthProvider";
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
    platformLabel: string;
    platformPlaceholder: string;
    plan: string;
    planLabel: string;
    quickSetup: string;
    save: string;
    saved: string;
    saveFailed: string;
    timezone: string;
    timezoneLabel: string;
    timezonePlaceholder: string;
  };
};

function inputDateFromISO(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 10);
}

function rfc3339FromInputDate(value: string) {
  if (!value) return undefined;
  return `${value}T09:00:00Z`;
}

export function ProfileSettingsPanel({ copy }: Readonly<ProfileSettingsPanelProps>) {
  const toast = useToast();
  const { user } = useAuth();
  const defaults = useMemo(
    () => ({
      timezone: user?.timezone || copy.timezone,
      interviewDate: inputDateFromISO(user?.interview_date, copy.interviewDate),
      platform: (user?.profile?.platform ?? "") as PlatformId | "",
    }),
    [copy.interviewDate, copy.timezone, user?.interview_date, user?.timezone, user?.profile?.platform],
  );
  const [profile, setProfile] = useState<ProfileSettings>(defaults);
  const [didSave, setDidSave] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfile(readProfileSettings(defaults));
  }, [defaults]);

  const update = (patch: Partial<ProfileSettings>) => {
    setDidSave(false);
    setProfile((current) => ({ ...current, ...patch }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextProfile: ProfileSettings = {
      timezone: String(formData.get("timezone") ?? "").trim(),
      interviewDate: String(formData.get("interviewDate") ?? ""),
      platform: (String(formData.get("platform") ?? "") as PlatformId | ""),
    };
    setSaving(true);
    try {
      await updateProfile({
        timezone: nextProfile.timezone,
        interview_date: rfc3339FromInputDate(nextProfile.interviewDate),
        platform: nextProfile.platform || undefined,
      });
      writeProfileSettings(nextProfile);
      setProfile(nextProfile);
      setDidSave(true);
      toast.success(copy.saved);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-list profile-settings-list" onSubmit={save}>
      <div>
        <span>{copy.emailLabel}</span>
        <strong>{user?.email ?? copy.email}</strong>
      </div>
      <label className="settings-profile-field">
        <span>{copy.timezoneLabel}</span>
        <input
          list="realgo-timezones"
          name="timezone"
          placeholder={copy.timezonePlaceholder}
          value={profile.timezone}
          onChange={(event) => update({ timezone: event.target.value })}
        />
        <datalist id="realgo-timezones">
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
      <label className="settings-profile-field">
        <span>{copy.platformLabel}</span>
        <select
          name="platform"
          value={profile.platform}
          onChange={(event) => update({ platform: event.target.value as PlatformId | "" })}
        >
          <option value="">{copy.platformPlaceholder}</option>
          {platformOptions.map((platform) => (
            <option key={platform.id} value={platform.id}>
              {platform.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span>{copy.planLabel}</span>
        <StatusPill tone="accent">{user?.plan ?? copy.plan}</StatusPill>
      </div>
      <div className="profile-settings-actions">
        <div>
          <button disabled={!profile.timezone.trim() || saving} type="submit">
            {saving ? "..." : copy.save}
          </button>
          <Link href="/onboarding/profile">{copy.quickSetup}</Link>
        </div>
        <small aria-live="polite">{didSave ? copy.saved : ""}</small>
      </div>
    </form>
  );
}
