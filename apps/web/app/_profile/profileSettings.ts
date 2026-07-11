"use client";

import type { PlatformId } from "./platforms";

export const profileSettingsStorageKey = "realgo:profile-settings:v1";
export const onboardingProfileStorageKey = "realgo:onboarding-profile:v1";
export const profileSettingsChangedEvent = "realgo:profile-settings-changed";

export type ProfileSettings = {
  timezone: string;
  interviewDate: string;
  platform: PlatformId | "";
};

function parseStoredProfile(raw: string | null): Partial<ProfileSettings> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return {
      timezone: typeof parsed.timezone === "string" ? parsed.timezone : undefined,
      interviewDate: typeof parsed.interviewDate === "string" ? parsed.interviewDate : undefined,
      platform: typeof parsed.platform === "string" ? (parsed.platform as PlatformId) : undefined,
    };
  } catch {
    return {};
  }
}

export function readProfileSettings(defaults: ProfileSettings): ProfileSettings {
  if (typeof window === "undefined") return defaults;

  const stored = parseStoredProfile(window.localStorage.getItem(profileSettingsStorageKey));
  const onboarding = parseStoredProfile(window.localStorage.getItem(onboardingProfileStorageKey));

  return {
    timezone: stored.timezone?.trim() || defaults.timezone,
    interviewDate: stored.interviewDate ?? onboarding.interviewDate ?? defaults.interviewDate,
    platform: stored.platform ?? onboarding.platform ?? defaults.platform,
  };
}

export function writeProfileSettings(settings: ProfileSettings) {
  window.localStorage.setItem(profileSettingsStorageKey, JSON.stringify(settings));

  const onboardingRaw = window.localStorage.getItem(onboardingProfileStorageKey);
  if (onboardingRaw) {
    try {
      const onboarding = JSON.parse(onboardingRaw) as Record<string, unknown>;
      window.localStorage.setItem(
        onboardingProfileStorageKey,
        JSON.stringify({
          ...onboarding,
          interviewDate: settings.interviewDate,
          platform: settings.platform,
        }),
      );
    } catch {
      // Keep profile settings usable even if an old onboarding mock is malformed.
    }
  }

  window.dispatchEvent(new Event(profileSettingsChangedEvent));
}
