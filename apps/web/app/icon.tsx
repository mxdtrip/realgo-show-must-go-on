import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 96,
  height: 96,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 22,
          background: "#08111f",
        }}
      >
        <svg width="78" height="78" viewBox="0 0 1254 1254" fill="none">
          <path d="M525 230 282 400l243 169" stroke="#f6f8fa" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M729 233 972 400 729 568" stroke="#f6f8fa" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M660 329 588 472" stroke="#f6f8fa" strokeWidth="60" strokeLinecap="round" />
          <path d="M274 598 628 824 982 596" stroke="#f6f8fa" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M268 769 628 1011 988 767" stroke="#f6f8fa" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
