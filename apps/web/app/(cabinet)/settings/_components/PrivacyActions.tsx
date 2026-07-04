"use client";

import { useState } from "react";

import { deleteAccount, requestDataExport } from "../../../_api/account";
import { ApiError } from "../../../_api/types";
import { useToast } from "../../../_toast";

type PrivacyActionsProps = {
  copy: {
    exportProgress: string;
    exportRequested: string;
    deleteAccount: string;
    deleteConfirm: string;
    deletePasswordPrompt: string;
    deleteDone: string;
    actionFailed: string;
  };
};

export function PrivacyActions({ copy }: Readonly<PrivacyActionsProps>) {
  const toast = useToast();
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);

  const runExport = async () => {
    setBusy("export");
    try {
      const result = await requestDataExport();
      toast.info(result.message || copy.exportRequested);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : copy.actionFailed);
    } finally {
      setBusy(null);
    }
  };

  const runDelete = async () => {
    if (!window.confirm(copy.deleteConfirm)) return;
    const password = window.prompt(copy.deletePasswordPrompt);
    if (!password) return;

    setBusy("delete");
    try {
      await deleteAccount(password);
      toast.success(copy.deleteDone);
      window.location.assign("/");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : copy.actionFailed);
      setBusy(null);
    }
  };

  return (
    <div className="privacy-actions">
      <button disabled={busy !== null} type="button" onClick={runExport}>
        {busy === "export" ? "..." : copy.exportProgress}
      </button>
      <button disabled={busy !== null} type="button" onClick={runDelete}>
        {busy === "delete" ? "..." : copy.deleteAccount}
      </button>
    </div>
  );
}
