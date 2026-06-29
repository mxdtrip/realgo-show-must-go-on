"use client";

export type NotificationPermissionState = "default" | "denied" | "granted" | "unsupported";

export type NotificationSettingsState = {
  enabled: boolean;
  dailyReminder: boolean;
  cardReviewReminder: boolean;
  streakReminder: boolean;
  reminderTime: string;
};

export const notificationSettingsStorageKey = "engram:notification-settings:v1";

export const defaultNotificationSettings: NotificationSettingsState = {
  enabled: false,
  dailyReminder: true,
  cardReviewReminder: true,
  streakReminder: false,
  reminderTime: "09:00",
};

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function readNotificationSettings(): NotificationSettingsState {
  if (typeof window === "undefined") return defaultNotificationSettings;

  const raw = window.localStorage.getItem(notificationSettingsStorageKey);
  if (!raw) return defaultNotificationSettings;

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationSettingsState>;
    return {
      enabled: Boolean(parsed.enabled),
      dailyReminder:
        typeof parsed.dailyReminder === "boolean"
          ? parsed.dailyReminder
          : defaultNotificationSettings.dailyReminder,
      cardReviewReminder:
        typeof parsed.cardReviewReminder === "boolean"
          ? parsed.cardReviewReminder
          : defaultNotificationSettings.cardReviewReminder,
      streakReminder:
        typeof parsed.streakReminder === "boolean"
          ? parsed.streakReminder
          : defaultNotificationSettings.streakReminder,
      reminderTime:
        typeof parsed.reminderTime === "string" && /^\d{2}:\d{2}$/.test(parsed.reminderTime)
          ? parsed.reminderTime
          : defaultNotificationSettings.reminderTime,
    };
  } catch {
    return defaultNotificationSettings;
  }
}

export function writeNotificationSettings(settings: NotificationSettingsState) {
  window.localStorage.setItem(notificationSettingsStorageKey, JSON.stringify(settings));
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported" as const;
  const permission = await Notification.requestPermission();
  return permission;
}

export async function showEngramNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;

  const notificationOptions: NotificationOptions = {
    badge: "/icons/icon.svg",
    icon: "/icons/icon.svg",
    ...options,
  };

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, notificationOptions);
    return true;
  }

  new Notification(title, notificationOptions);
  return true;
}
