import { ImageResponse } from "next/og";

import { getDictionary } from "./_content/i18n";

export const runtime = "edge";

export const size = {
  width: 96,
  height: 96,
};
export const contentType = "image/png";

export default function Icon() {
  const brandInitial = getDictionary().common.brand.slice(0, 1);

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
          background: "#0d1117",
          color: "#58a6ff",
          fontFamily: "Arial, sans-serif",
          fontSize: 62,
          fontWeight: 800,
          letterSpacing: -4,
        }}
      >
        {brandInitial}
      </div>
    ),
    size,
  );
}
