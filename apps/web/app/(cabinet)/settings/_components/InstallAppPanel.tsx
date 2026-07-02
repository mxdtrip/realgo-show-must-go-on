"use client";

import { useEffect, useState } from "react";

import {
  clearInstallPrompt,
  getInstallPrompt,
  subscribeToInstallPrompt,
  type BeforeInstallPromptEvent,
} from "../../../_pwa/installPrompt";
import { useToast } from "../../../_toast";

type InstallAppPanelProps = {
  copy: {
    description: string;
    install: string;
    installed: string;
    manualHint: string;
    manualSupport: string;
    ready: string;
  };
};

export function InstallAppPanel({ copy }: Readonly<InstallAppPanelProps>) {
  const toast = useToast();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && Boolean(window.navigator.standalone));
    setIsStandalone(standalone);
    setPromptEvent(getInstallPrompt());
    setIsReady(true);

    const handleInstalled = () => {
      setIsStandalone(true);
    };

    window.addEventListener("appinstalled", handleInstalled);
    const unsubscribe = subscribeToInstallPrompt(setPromptEvent);

    return () => {
      window.removeEventListener("appinstalled", handleInstalled);
      unsubscribe();
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setIsStandalone(true);
        toast.success(copy.installed);
      }
    } finally {
      clearInstallPrompt();
    }
  };

  return (
    <div className="install-app-panel">
      <p>{copy.description}</p>
      {isReady && isStandalone ? (
        <div className="install-app-panel__status">
          <span>{copy.installed}</span>
        </div>
      ) : null}
      {isReady && promptEvent && !isStandalone ? (
        <>
          <div className="install-app-panel__status">
            <span>{copy.ready}</span>
          </div>
          <button type="button" onClick={install}>
            {copy.install}
          </button>
        </>
      ) : null}
      {isReady && !promptEvent && !isStandalone ? (
        <div className="install-app-panel__fallback">
          <strong>{copy.manualSupport}</strong>
          <small>{copy.manualHint}</small>
        </div>
      ) : null}
    </div>
  );
}
