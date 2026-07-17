"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { updateNotificationSettings } from "../../../_api/account";
import { useAuth } from "../../../_api/AuthProvider";
import { ApiError } from "../../../_api/types";
import {
  getNotificationPermission,
  readNotificationSettings,
  requestNotificationPermission,
  showRealgoNotification,
  writeNotificationSettings,
  type NotificationPermissionState,
  type NotificationSettingsState,
} from "../../../_notifications/notifications";
import { useToast } from "../../../_toast";

type NotificationSettingsPanelProps = {
  copy: {
    cardReviewReminder: string;
    dailyReminder: string;
    description: string;
    disabled: string;
    enable: string;
    enabled: string;
    permissionDenied: string;
    permissionGranted: string;
    permissionUnsupported: string;
    reminderTime: string;
    sendTest: string;
    syncFailed: string;
    streakReminder: string;
    testBody: string;
    testSent: string;
    testTitle: string;
  };
};

export function NotificationSettingsPanel({ copy }: Readonly<NotificationSettingsPanelProps>) {
  const toast = useToast();
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [settings, setSettings] = useState<NotificationSettingsState | null>(null);
  const [lastResult, setLastResult] = useState("");

  useEffect(() => {
    setPermission(getNotificationPermission());
    const localSettings = readNotificationSettings();
    const remote = user?.notification_settings;
    setSettings(
      remote
        ? {
            ...localSettings,
            enabled: remote.email_enabled,
            dailyReminder: remote.weekly_digest,
            cardReviewReminder: remote.review_reminder,
          }
        : localSettings,
    );
  }, [user?.notification_settings]);

  useEffect(() => {
    if (!settings) return;
    writeNotificationSettings(settings);
  }, [settings]);

  if (!settings) {
    return <div className="notification-settings-panel" />;
  }

  const permissionLabelByState = {
    default: copy.disabled,
    denied: copy.permissionDenied,
    granted: copy.permissionGranted,
    unsupported: copy.permissionUnsupported,
  };
  const permissionLabel = permissionLabelByState[permission];

  const update = (patch: Partial<NotificationSettingsState>) => {
    setSettings((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      void syncRemote(next);
      return next;
    });
  };

  const syncRemote = async (next: NotificationSettingsState) => {
    try {
      await updateNotificationSettings({
        email_enabled: next.enabled,
        weekly_digest: next.dailyReminder,
        review_reminder: next.cardReviewReminder,
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : copy.syncFailed);
    }
  };

  const enableNotifications = async () => {
    const nextPermission = await requestNotificationPermission();
    setPermission(nextPermission);
    update({ enabled: nextPermission === "granted" });
    const message = nextPermission === "granted" ? copy.enabled : permissionLabelByState[nextPermission];
    if (nextPermission === "granted") {
      toast.success(message);
    } else {
      toast.error(message);
    }
  };

  const sendTest = async () => {
    const didShow = await showRealgoNotification(copy.testTitle, {
      body: copy.testBody,
      data: { url: "/cards" },
      tag: "realgo-test-notification",
    });
    const message = didShow ? copy.testSent : permissionLabel;
    setLastResult(message);
    if (didShow) {
      toast.success(message);
    } else {
      toast.error(message);
    }
  };

  return (
    <div className="notification-settings-panel">
      <p>{copy.description}</p>
      <p className="notification-settings-panel__legal">
        Еженедельный дайджест выключен по умолчанию для новых аккаунтов —
        включайте его сами. Что и зачем мы отправляем на почту, описано в{" "}
        <Link href="/privacy">Политике конфиденциальности</Link>.
      </p>

      <div className="notification-status-row">
        <span>{settings.enabled ? copy.enabled : permissionLabel}</span>
        <button disabled={permission === "unsupported" || permission === "denied"} type="button" onClick={enableNotifications}>
          {copy.enable}
        </button>
      </div>

      <label className="settings-toggle">
        <input
          checked={settings.dailyReminder}
          type="checkbox"
          onChange={(event) => update({ dailyReminder: event.target.checked })}
        />
        <span>{copy.dailyReminder}</span>
      </label>
      <label className="settings-toggle">
        <input
          checked={settings.cardReviewReminder}
          type="checkbox"
          onChange={(event) => update({ cardReviewReminder: event.target.checked })}
        />
        <span>{copy.cardReviewReminder}</span>
      </label>
      <label className="settings-toggle">
        <input
          checked={settings.streakReminder}
          type="checkbox"
          onChange={(event) => update({ streakReminder: event.target.checked })}
        />
        <span>{copy.streakReminder}</span>
      </label>

      <label className="settings-time">
        <span>{copy.reminderTime}</span>
        <input
          type="time"
          value={settings.reminderTime}
          onChange={(event) => update({ reminderTime: event.target.value })}
        />
      </label>

      <button disabled={!settings.enabled || permission !== "granted"} type="button" onClick={sendTest}>
        {copy.sendTest}
      </button>
      {lastResult ? <small>{lastResult}</small> : null}
    </div>
  );
}
