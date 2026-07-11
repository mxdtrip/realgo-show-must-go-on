import { ImageResponse } from "next/og";

import { getDictionary } from "./_content/i18n";

export const runtime = "edge";

export const alt = getDictionary().common.metadata.ogImageAlt;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  const copy = getDictionary();
  const metadata = copy.common.metadata;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0d1117",
          color: "#e6edf3",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            color: "#58a6ff",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          <svg width="54" height="54" viewBox="0 0 1254 1254" fill="none">
            <path d="M525 230 282 400l243 169" stroke="#f6f8fa" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M729 233 972 400 729 568" stroke="#f6f8fa" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M660 329 588 472" stroke="#f6f8fa" strokeWidth="60" strokeLinecap="round" />
            <path d="M274 598 628 824 982 596" stroke="#f6f8fa" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M268 769 628 1011 988 767" stroke="#f6f8fa" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {metadata.applicationName}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div
            style={{
              display: "flex",
              color: "#7d8590",
              fontSize: 30,
              letterSpacing: 2,
            }}
          >
            {metadata.ogEyebrow}
          </div>
          <div
            style={{
              maxWidth: 920,
              fontSize: 78,
              lineHeight: 0.98,
              fontWeight: 700,
              letterSpacing: -2,
            }}
          >
            {metadata.ogHeadline}
          </div>
          <div
            style={{
              maxWidth: 820,
              color: "#c9d1d9",
              fontSize: 32,
              lineHeight: 1.35,
            }}
          >
            {metadata.description}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            color: "#3fb950",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {metadata.ogFooter}
        </div>
      </div>
    ),
    size,
  );
}
