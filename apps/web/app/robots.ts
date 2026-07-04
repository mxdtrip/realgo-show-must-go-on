import type { MetadataRoute } from "next";

import { getDictionary } from "./_content/i18n";

function getSiteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? getDictionary().common.metadata.siteUrl);
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/checkout", "/login", "/register"],
      disallow: [
        "/dashboard",
        "/reviews",
        "/problems",
        "/roadmap",
        "/patterns",
        "/cards",
        "/extension",
        "/settings",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl.origin,
  };
}
