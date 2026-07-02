"use client";

import { useState } from "react";

type FAQSectionCopy = Readonly<{
  kicker: string;
  title: string;
  description: string;
  items: readonly Readonly<{
    question: string;
    answer: string;
  }>[];
}>;

export function LandingFAQ({ section }: { section: FAQSectionCopy }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="landing-section faq-section" id="faq">
      <div className="section-kicker">{section.kicker}</div>
      <div className="faq-layout">
        <div className="section-copy faq-intro">
          <h2 id="faq-title">{section.title}</h2>
          <p>{section.description}</p>
        </div>

        <div aria-labelledby="faq-title" className="faq-list">
          {section.items.map((item, index) => {
            const isOpen = openIndex === index;
            const panelId = `faq-panel-${index}`;
            const buttonId = `faq-button-${index}`;

            return (
              <article className={isOpen ? "faq-item is-open" : "faq-item"} key={item.question}>
                <h3>
                  <button
                    aria-controls={panelId}
                    aria-expanded={isOpen}
                    className="faq-question"
                    id={buttonId}
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  >
                    <span>{item.question}</span>
                    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    </svg>
                  </button>
                </h3>
                <div
                  aria-hidden={!isOpen}
                  aria-labelledby={buttonId}
                  className="faq-answer"
                  id={panelId}
                  role="region"
                >
                  <div className="faq-answer__inner">
                    <p>{item.answer}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
