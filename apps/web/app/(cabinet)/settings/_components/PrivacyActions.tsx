"use client";

import { useState } from "react";

import { deleteAccount } from "../../../_api/account";
import { ApiError } from "../../../_api/types";
import { useToast } from "../../../_toast";

type PrivacyActionsProps = {
  copy: {
    deleteTitle: string;
    deleteDescription: string;
    deleteAccount: string;
    deleteConfirm: string;
    deletePasswordPrompt: string;
    deleteCancel: string;
    deleteForever: string;
    deleteDone: string;
    actionFailed: string;
  };
};

/**
 * Account deletion request (the legally required "erase me and my data"
 * control). Deliberately the only action here: data export was dropped, and
 * the old window.confirm/window.prompt flow is replaced by an inline
 * confirmation with an explicit password field.
 */
export function PrivacyActions({ copy }: Readonly<PrivacyActionsProps>) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const cancel = () => {
    setConfirming(false);
    setPassword("");
  };

  const runDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;

    setBusy(true);
    try {
      await deleteAccount(password);
      toast.success(copy.deleteDone);
      window.location.assign("/");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : copy.actionFailed);
      setBusy(false);
    }
  };

  return (
    <div className={`danger-zone ${confirming ? "danger-zone--confirming" : ""}`}>
      <div className="danger-zone__info">
        <strong>{copy.deleteTitle}</strong>
        <p>{confirming ? copy.deleteConfirm : copy.deleteDescription}</p>
      </div>

      {confirming ? (
        <form className="danger-zone__confirm" onSubmit={runDelete}>
          <input
            aria-label={copy.deletePasswordPrompt}
            autoFocus
            autoComplete="current-password"
            disabled={busy}
            placeholder={copy.deletePasswordPrompt}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div>
            <button className="danger-zone__cancel" disabled={busy} type="button" onClick={cancel}>
              {copy.deleteCancel}
            </button>
            <button className="danger-zone__btn" disabled={busy || password.length === 0} type="submit">
              {busy ? "..." : copy.deleteForever}
            </button>
          </div>
        </form>
      ) : (
        <button className="danger-zone__btn" type="button" onClick={() => setConfirming(true)}>
          {copy.deleteAccount}
        </button>
      )}
    </div>
  );
}
