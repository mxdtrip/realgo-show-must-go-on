"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallAppPanelProps = {
  copy: {
    description: string;
    install: string;
    installed: string;
    iosHint: string;
    ready: string;
    unavailable: string;
  };
};

export function InstallAppPanel({ copy }: Readonly<InstallAppPanelProps>) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && Boolean(window.navigator.standalone));
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsStandalone(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };

  return (
    <div className="install-app-panel">
      <p>{copy.description}</p>
      <div className="install-app-panel__status">
        <span>{isStandalone ? copy.installed : promptEvent ? copy.ready : copy.unavailable}</span>
      </div>
      <button disabled={!promptEvent || isStandalone} type="button" onClick={install}>
        {copy.install}
      </button>
      {!promptEvent && !isStandalone ? <small>{copy.iosHint}</small> : null}
    </div>
  );
}
