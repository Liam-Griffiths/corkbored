// Canonical, absolute origin for the site — used for sitemap/robots, canonical
// links and Open Graph URLs. Falls back to the production domain so metadata is
// still correct when NEXT_PUBLIC_APP_URL is unset.
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://corkbored.com").replace(/\/$/, "");
}

// Build an absolute URL from a site-relative path (e.g. "/p/foo").
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
