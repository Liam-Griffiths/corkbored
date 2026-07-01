import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private, auth-gated and machine-only routes out of the index.
      // Public project overviews (/p/[slug]) and announcement pages stay
      // crawlable; only the member-only project tabs are blocked.
      disallow: [
        "/api/",
        "/admin",
        "/me",
        "/activity",
        "/signin",
        "/styleguide",
        "/go/",
        "/invite/",
        "/p/*/dashboard",
        "/p/*/chat",
        "/p/*/tasks",
        "/p/*/applications",
        "/p/*/apply",
        "/p/*/calendar",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
