import type { MetadataRoute } from "next";

import { getDictionary } from "./_content/i18n";

const publicRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/checkout", priority: 0.5, changeFrequency: "monthly" },
  { path: "/login", priority: 0.3, changeFrequency: "monthly" },
  { path: "/register", priority: 0.4, changeFrequency: "monthly" },
] as const;

function getSiteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? getDictionary().common.metadata.siteUrl);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date("2026-07-01T00:00:00.000Z");

  return publicRoutes.map((route) => ({
    url: new URL(route.path, siteUrl).toString(),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
