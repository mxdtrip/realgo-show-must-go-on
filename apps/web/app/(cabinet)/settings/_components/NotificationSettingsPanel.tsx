"use client";

import { useEffect, useState } from "react";

import {
  getNotificationPermission,
  readNotificationSettings,
  requestNotificationPermission,
  showEngramNotification,
  writeNotificationSettings,
  type NotificationPermissionState,
  type NotificationSettingsState,
} from "../../../_notifications/notifications";

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
    streakReminder: string;
    testBody: string;
    testSent: string;
    testTitle: string;
  };
};

export function NotificationSettingsPanel({ copy }: Readonly<NotificationSettingsPanelProps>) {
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [settings, setSettings] = useState<NotificationSettingsState | null>(null);
  const [lastResult, setLastResult] = useState("");

  useEffect(() => {
    setPermission(getNotificationPermission());
    setSettings(readNotificationSettings());
  }, []);

  useEffect(() => {
    if (!settings) return;
    writeNotificationSettings(settings);
  }, [settings]);

  if (!settings) {
    return <div className="notification-settings-panel" />;
  }

  const permissionLabel = {
    default: copy.disabled,
    denied: copy.permissionDenied,
    granted: copy.permissionGranted,
    unsupported: copy.permissionUnsupported,
  }[permission];

  const update = (patch: Partial<NotificationSettingsState>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  };

  const enableNotifications = async () => {
    const nextPermission = await requestNotificationPermission();
    setPermission(nextPermission);
    update({ enabled: nextPermission === "granted" });
  };

  const sendTest = async () => {
    const didShow = await showEngramNotification(copy.testTitle, {
      body: copy.testBody,
      data: { url: "/cards" },
      tag: "engram-test-notification",
    });
    setLastResult(didShow ? copy.testSent : permissionLabel);
  };

  return (
    <div className="notification-settings-panel">
      <p>{copy.description}</p>

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
