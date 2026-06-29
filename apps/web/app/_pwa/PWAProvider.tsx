"use client";

import { useEffect } from "react";

export function PWAProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Failed to register Engram service worker", error);
      });
    });
  }, []);

  return null;
}
