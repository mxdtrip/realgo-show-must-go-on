"use client";

import { useEffect } from "react";

import { captureInstallPrompt, clearInstallPrompt } from "./installPrompt";

export function PWAProvider() {
  useEffect(() => {
    const registerServiceWorker = () => {
      if (!("serviceWorker" in navigator)) return;
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Failed to register realgo service worker", error);
      });
    };

    const handleInstalled = () => clearInstallPrompt();

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    return () => {
      window.removeEventListener("load", registerServiceWorker);
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  return null;
}
