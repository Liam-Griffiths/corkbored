import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function isInternal(href: string): boolean {
  if (href.startsWith("/") || href.startsWith("#")) return true;
  try {
    const u = new URL(href);
    const app = APP_URL ? new URL(APP_URL) : null;
    if (app && u.hostname === app.hostname) return true;
    return false;
  } catch {
    return true; // treat unparseable as internal (safe default)
  }
}

export function SafeLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (isInternal(href)) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  const warnUrl = `/go?url=${encodeURIComponent(href)}`;
  return (
    <Link href={warnUrl} className={className}>
      {children}
    </Link>
  );
}

/**
 * Renders a string that may contain raw URLs, turning each one into a SafeLink.
 * External URLs route through /go; internal ones link directly.
 */
export function LinkedText({ text, className }: { text: string; className?: string }) {
  const URL_RE = /https?:\/\/[^\s<>"']+/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const raw = match[0];
    // Strip trailing punctuation that's likely not part of the URL
    const clean = raw.replace(/[.,;:!?)]+$/, "");
    const trailing = raw.slice(clean.length);

    parts.push(
      <SafeLink
        key={match.index}
        href={clean}
        className="underline decoration-ink-soft/40 hover:decoration-ink-soft"
      >
        {clean}
      </SafeLink>,
    );
    if (trailing) parts.push(trailing);
    last = match.index + raw.length;
  }

  if (last < text.length) parts.push(text.slice(last));

  return <span className={className}>{parts}</span>;
}
