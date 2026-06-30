"use client";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallPromptListener = (prompt: BeforeInstallPromptEvent | null) => void;

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<InstallPromptListener>();

function emitInstallPrompt() {
  listeners.forEach((listener) => listener(deferredInstallPrompt));
}

export function captureInstallPrompt(event: Event) {
  event.preventDefault();
  deferredInstallPrompt = event as BeforeInstallPromptEvent;
  emitInstallPrompt();
}

export function clearInstallPrompt() {
  deferredInstallPrompt = null;
  emitInstallPrompt();
}

export function getInstallPrompt() {
  return deferredInstallPrompt;
}

export function subscribeToInstallPrompt(listener: InstallPromptListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
