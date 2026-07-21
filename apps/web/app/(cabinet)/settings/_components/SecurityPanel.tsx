"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { changePassword, revokeAllSessions } from "../../../_api/account";
import { useAuth } from "../../../_api/AuthProvider";
import { ApiError } from "../../../_api/types";
import { accountSecurityCopy } from "../../../_content/i18n";
import { useToast } from "../../../_toast";

const MIN_PASSWORD_LENGTH = 8;

export function SecurityPanel() {
  const copy = accountSecurityCopy;
  const toast = useToast();
  const { logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [done, setDone] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const validationError = (() => {
    if (!newPassword && !confirmPassword) return null;
    if (newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH) {
      return copy.tooShort;
    }
    if (confirmPassword.length > 0 && newPassword !== confirmPassword) {
      return copy.mismatch;
    }
    return null;
  })();

  const canSubmit =
    currentPassword.trim().length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword === confirmPassword &&
    !saving;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setUnavailable(false);
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(copy.saved);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        setUnavailable(true);
      } else {
        toast.error(e instanceof ApiError ? e.message : copy.saveFailed);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm(copy.revokeConfirm)) return;
    setRevoking(true);
    try {
      const serverConfirmed = await revokeAllSessions();
      if (serverConfirmed) {
        toast.success(copy.revokeDone);
      } else {
        toast.info(copy.revokeFallback);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : copy.revokeFailed);
      setRevoking(false);
      return;
    }
    // Sessions are already revoked server-side past this point — a failure
    // here is just the local logout/redirect not completing, not a failed
    // revoke, so it must not surface the same "revoke failed" message.
    try {
      await logout();
    } catch {
      /* best-effort local cleanup; the server-side revoke already succeeded */
    }
    window.location.assign("/login");
  };

  if (unavailable) {
    return (
      <div className="security-panel security-panel--soon">
        <p>{copy.soon}</p>
      </div>
    );
  }

  return (
    <form className="security-panel" onSubmit={submit}>
      <label className="settings-profile-field">
        <span>{copy.currentPasswordLabel}</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          placeholder={copy.passwordPlaceholder}
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setDone(false);
          }}
        />
      </label>
      <label className="settings-profile-field">
        <span>{copy.newPasswordLabel}</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder={copy.passwordPlaceholder}
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setDone(false);
          }}
        />
      </label>
      <label className="settings-profile-field">
        <span>{copy.confirmPasswordLabel}</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder={copy.passwordPlaceholder}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setDone(false);
          }}
        />
      </label>

      {validationError ? (
        <small className="security-panel__error">{validationError}</small>
      ) : null}

      <div className="profile-settings-actions">
        <div>
          <button disabled={!canSubmit} type="submit">
            {saving ? "..." : copy.save}
          </button>
        </div>
        <small aria-live="polite">{done ? copy.saved : ""}</small>
      </div>

      <div className="security-panel__divider" />

      <div className="security-panel__revoke">
        <div>
          <strong>{copy.revokeTitle}</strong>
          <p>{copy.revokeDescription}</p>
        </div>
        <button
          disabled={revoking}
          type="button"
          onClick={handleRevokeAll}
          className="security-panel__revoke-btn"
        >
          {revoking ? "..." : copy.revokeAction}
        </button>
      </div>
    </form>
  );
}
