import type { Metadata } from "next";
import type { CSSProperties } from "react";

import { getDictionary } from "../_content/i18n";
import { FlipReviewCard } from "../components/FlipReviewCard";
import { MemoryExtensionDemo } from "../components/MemoryExtensionDemo";
import { ScrollReveal } from "../components/ScrollReveal";
import { ScrollVideoBackground } from "../components/ScrollVideoBackground";
import { SiteFooter } from "../components/SiteFooter";
import { SortingMemoryHero } from "../components/SortingMemoryHero";
import { LandingFAQ } from "./LandingFAQ";

const metadataCopy = getDictionary().common.metadata;

export const metadata: Metadata = {
  title: {
    absolute: metadataCopy.title,
  },
  description: metadataCopy.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: metadataCopy.title,
    description: metadataCopy.description,
    url: "/",
    siteName: metadataCopy.applicationName,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: metadataCopy.ogImageAlt,
      },
    ],
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: metadataCopy.title,
    description: metadataCopy.description,
    images: ["/opengraph-image"],
  },
};

export default function Home() {
  const dictionary = getDictionary();
  const copy = dictionary.marketing;

  return (
    <>
      <ScrollVideoBackground />
      <ScrollReveal />
      <SortingMemoryHero />

      <section className="landing-section" id="memory">
        <div className="section-kicker" data-reveal="blur">
          {copy.sections.memory.kicker}
        </div>
        <div className="section-grid">
          <div className="section-copy" data-reveal="left">
            <h2>{copy.sections.memory.title}</h2>
            <p>{copy.sections.memory.description}</p>
          </div>
          <div className="memory-ext-demo" data-reveal="right">
            <MemoryExtensionDemo />
          </div>
        </div>
      </section>

      <section className="landing-section" id="roadmap">
        <div className="section-kicker" data-reveal="blur">
          {copy.sections.roadmap.kicker}
        </div>
        <div className="section-grid reverse">
          <div className="product-demo roadmap-demo" data-reveal="left">
            <div className="roadmap-head">
              <span>{copy.sections.roadmap.head}</span>
              <strong>{copy.sections.roadmap.readiness}</strong>
            </div>
            {copy.roadmapWeeks.map((week, index) => (
              <article
                className="roadmap-row"
                key={week.label}
                style={{ "--week-index": index, "--progress": `${week.progress}%` } as CSSProperties}
              >
                <div className="roadmap-row__meta">
                  <span>{week.label}</span>
                  <span className={`roadmap-row__state roadmap-row__state--${week.tone}`}>
                    {week.state}
                  </span>
                </div>
                <strong>{week.title}</strong>
                <p>{week.focus}</p>
                <div className="roadmap-progress" aria-hidden="true">
                  <span className="roadmap-progress__track">
                    <i className="roadmap-progress__fill" />
                  </span>
                  <em className="roadmap-progress__value">{week.progress}%</em>
                </div>
              </article>
            ))}
          </div>
          <div className="section-copy" data-reveal="right">
            <h2>{copy.sections.roadmap.title}</h2>
            <p>{copy.sections.roadmap.description}</p>
          </div>
        </div>
      </section>

      <section className="landing-section" id="reviews">
        <div className="section-kicker" data-reveal="blur">
          {copy.sections.reviews.kicker}
        </div>
        <div className="section-copy wide" data-reveal="up">
          <h2>{copy.sections.reviews.title}</h2>
          <p>{copy.sections.reviews.description}</p>
        </div>
        <div className="review-grid">
          {copy.reviewCards.map(([type, front, back], index) => (
            <div className="review-card" data-reveal="tilt" data-reveal-delay={index * 100} key={type}>
              <FlipReviewCard
                type={type}
                front={front}
                back={back}
                flipAria={{
                  showAnswer: copy.sections.reviews.flipToAnswer,
                  showQuestion: copy.sections.reviews.flipToQuestion,
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" id="pricing">
        <div className="section-kicker" data-reveal="blur">
          {copy.sections.pricing.kicker}
        </div>
        <div className="section-grid">
          <div className="section-copy" data-reveal="left">
            <h2>{copy.sections.pricing.title}</h2>
            <p>{copy.sections.pricing.description}</p>
          </div>
          <div className="pricing-grid">
            {copy.pricing.map(([name, price, features, cta], index) => (
              <article
                className="price-card"
                data-reveal="zoom"
                data-reveal-delay={index * 110}
                key={name}
              >
                <span>{name}</span>
                <strong>{price}</strong>
                <ul className="price-features">
                  {features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <a
                  className="price-cta"
                  href={`/checkout?plan=${name.toLowerCase()}`}
                >
                  {cta}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <LandingFAQ section={copy.sections.faq} />

      <SiteFooter />
    </>
  );
}
