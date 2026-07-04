"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError } from "../../../../_api/types";
import { getPatternDetail, type PatternDetail } from "../../../../_api/patterns";
import { CabinetIcon } from "../../../_icons";
import { CabinetPanel } from "../../../_components";

type LoadState = "loading" | "loaded" | "not_found" | "error";

type Copy = Readonly<{
  eyebrow: string;
  backLink: string;
  loading: string;
  errorTitle: string;
  notFoundTitle: string;
  retry: string;
  descriptionTitle: string;
  techniquesTitle: string;
  symptomsTitle: string;
  symptomsEmpty: string;
  checklistTitle: string;
  examplesTitle: string;
  examplesEmpty: string;
  practiceCta: string;
}>;

export function PatternDetailPageClient({ code, copy }: Readonly<{ code: string; copy: Copy }>) {
  const [detail, setDetail] = useState<PatternDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setError("");

    getPatternDetail(code, controller.signal)
      .then((data) => {
        setDetail(data);
        setLoadState("loaded");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 404) {
          setLoadState("not_found");
          return;
        }
        setError(e instanceof ApiError ? e.message : copy.errorTitle);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [code, copy.errorTitle, reloadVersion]);

  return (
    <main className="cabinet-page">
      <Link className="cabinet-ghost-link" href="/patterns">
        {copy.backLink}
      </Link>

      {loadState === "loading" ? (
        <CabinetPanel title={copy.loading}>
          <p>{copy.loading}</p>
        </CabinetPanel>
      ) : null}

      {loadState === "not_found" ? (
        <CabinetPanel title={copy.notFoundTitle}>
          <p>{copy.notFoundTitle}</p>
        </CabinetPanel>
      ) : null}

      {loadState === "error" ? (
        <CabinetPanel title={copy.errorTitle}>
          <p>{error || copy.errorTitle}</p>
          <button className="btn-ghost" type="button" onClick={() => setReloadVersion((v) => v + 1)}>
            {copy.retry}
          </button>
        </CabinetPanel>
      ) : null}

      {loadState === "loaded" && detail ? (
        <>
          <section className="cabinet-page-head">
            <div>
              <span className="cabinet-eyebrow">{copy.eyebrow}</span>
              <h1>{detail.name}</h1>
              <p>{detail.description}</p>
            </div>
            <div className="cabinet-page-head__actions">
              <div>
                <Link className="cabinet-cta" href={`/patterns/${detail.code}/session`}>
                  {copy.practiceCta}
                  <CabinetIcon name="arrow" />
                </Link>
              </div>
            </div>
          </section>

          <div className="cabinet-grid">
            {detail.techniques.length > 0 ? (
              <CabinetPanel eyebrow="techniques" title={copy.techniquesTitle}>
                <div className="pattern-technique-chips">
                  {detail.techniques.map((technique) => (
                    <span className="meta-chip" key={technique}>
                      {technique}
                    </span>
                  ))}
                </div>
              </CabinetPanel>
            ) : null}

            <CabinetPanel eyebrow="symptoms" title={copy.symptomsTitle}>
              {detail.recognitionSymptoms.length > 0 ? (
                <ul className="pattern-detail-list">
                  {detail.recognitionSymptoms.map((symptom) => (
                    <li key={symptom}>{symptom}</li>
                  ))}
                </ul>
              ) : (
                <p>{copy.symptomsEmpty}</p>
              )}
            </CabinetPanel>

            <CabinetPanel eyebrow="checklist" title={copy.checklistTitle}>
              <ul className="pattern-detail-list">
                {detail.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CabinetPanel>

            <CabinetPanel eyebrow="examples" title={copy.examplesTitle}>
              {detail.exampleProblems.length > 0 ? (
                <ul className="pattern-detail-examples">
                  {detail.exampleProblems.map((problem) => (
                    <li key={problem.title}>
                      <a href={problem.url} target="_blank" rel="noreferrer">
                        {problem.title}
                      </a>
                      {problem.difficulty ? <span>{problem.difficulty}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{copy.examplesEmpty}</p>
              )}
            </CabinetPanel>
          </div>
        </>
      ) : null}
    </main>
  );
}
