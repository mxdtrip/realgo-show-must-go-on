import type { MetadataRoute } from "next";

import { getDictionary } from "./_content/i18n";

const copy = getDictionary().pwa;

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: copy.name,
    short_name: copy.shortName,
    description: copy.description,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#0d1117",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
