"use client";

import { useEffect, useRef, useState } from "react";

import { CabinetIcon } from "./_icons";

export type ReportCopy = Readonly<{
  triggerAria: string;
  title: string;
  description: string;
  placeholder: string;
  contextLabel: string;
  send: string;
  copy: string;
  copied: string;
  copyFailed: string;
  handoffTitle: string;
  handoffNote: string;
  close: string;
  email: string;
}>;

/** Пункт user-menu живёт в другом компоненте — открывает диалог этим событием. */
export const REPORT_PROBLEM_EVENT = "realgo:report-problem";

export function openReportProblemDialog() {
  window.dispatchEvent(new Event(REPORT_PROBLEM_EVENT));
}

function pageContextLines(): string[] {
  return [
    `url: ${window.location.href}`,
    `viewport: ${window.innerWidth}×${window.innerHeight}`,
    `ua: ${navigator.userAgent}`,
    `time: ${new Date().toISOString()}`,
  ];
}

export function ReportProblemLauncher({
  copy,
  showTrigger = true,
}: Readonly<{ copy: ReportCopy; showTrigger?: boolean }>) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"edit" | "handoff">("edit");
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const [context, setContext] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener(REPORT_PROBLEM_EVENT, onOpenEvent);
    return () => window.removeEventListener(REPORT_PROBLEM_EVENT, onOpenEvent);
  }, []);

  useEffect(() => {
    if (!open) return;
    setContext(pageContextLines());
    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    // Текст намеренно сохраняем при закрытии в фазе edit: случайный Escape
    // не должен стирать описание в процессе написания. Но после handoff
    // (юзер уже нажал «отправить», mailto открылся) черновик своё
    // отслужил — иначе он молча всплывёт в следующем, не связанном отчёте.
    if (phase === "handoff") setText("");
    setOpen(false);
    setPhase("edit");
    setCopyState("idle");
  }

  function composedReport(): string {
    return `${text.trim()}\n\n---\n${context.join("\n")}`;
  }

  function send() {
    const subject = "realgo: проблема в кабинете";
    window.location.href = `mailto:${copy.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(composedReport())}`;
    // A mailto hand-off cannot tell us whether a mail client opened or whether
    // the user actually sent anything. Show explicit next steps, never a false
    // success confirmation.
    setPhase("handoff");
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(composedReport());
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
  }

  const copyLabel =
    copyState === "done" ? copy.copied : copyState === "failed" ? copy.copyFailed : copy.copy;

  return (
    <>
      {showTrigger ? (
        <button
          className="cabinet-topbar__iconbtn"
          type="button"
          aria-label={copy.triggerAria}
          title={copy.triggerAria}
          onClick={() => setOpen(true)}
        >
          <CabinetIcon name="megaphone" width="16" height="16" />
        </button>
      ) : null}

      {open ? (
        <div className="shell-overlay" data-shell-overlay role="presentation" onClick={close}>
          <div
            className="shell-dialog shell-dialog--report"
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            ref={dialogRef}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="shell-dialog__head">
              <strong>{phase === "handoff" ? copy.handoffTitle : copy.title}</strong>
              <button
                className="shell-dialog__close"
                type="button"
                aria-label={copy.close}
                onClick={close}
              >
                ×
              </button>
            </header>

            {phase === "edit" ? (
              <>
                <p className="shell-dialog__note">{copy.description}</p>
                <textarea
                  className="report-textarea"
                  value={text}
                  placeholder={copy.placeholder}
                  rows={5}
                  onChange={(event) => setText(event.target.value)}
                />
                <div className="report-context">
                  <span className="report-context__label">{copy.contextLabel}</span>
                  {context.map((line) => (
                    <code key={line}>{line}</code>
                  ))}
                </div>
                <div className="shell-dialog__actions">
                  <button
                    className="shell-btn shell-btn--primary"
                    type="button"
                    disabled={text.trim().length < 4}
                    onClick={send}
                  >
                    {copy.send}
                  </button>
                  <button className="shell-btn shell-btn--ghost" type="button" onClick={copyReport}>
                    {copyLabel}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="shell-dialog__note">{copy.handoffNote}</p>
                <div className="shell-dialog__actions">
                  <button className="shell-btn shell-btn--primary" type="button" onClick={copyReport}>
                    {copyLabel}
                  </button>
                  <button className="shell-btn shell-btn--ghost" type="button" onClick={close}>
                    {copy.close}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
