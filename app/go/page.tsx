import Link from "next/link";
import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ url?: string }>;
}

function isAllowedExternal(raw: string): boolean {
  try {
    const u = new URL(raw);
    // Must be http(s)
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    // Block loopback / private ranges
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.startsWith("127.") || host.startsWith("192.168.") || host.startsWith("10.")) return false;
    return true;
  } catch {
    return false;
  }
}

export default async function GoPage({ searchParams }: Props) {
  const { url } = await searchParams;

  if (!url || !isAllowedExternal(url)) {
    redirect("/board");
  }

  let displayHost = "";
  try {
    displayHost = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    redirect("/board");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-board px-5">
      <div className="w-full max-w-md">
        {/* Pin decoration */}
        <div className="flex justify-center mb-6">
          <span
            className="inline-block h-5 w-5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff8a72,#c94e2a_60%,#7c2d14)] shadow-[0_3px_5px_rgba(0,0,0,.4)]"
            aria-hidden="true"
          />
        </div>

        <div className="rounded-sm bg-paper shadow-[0_14px_30px_rgba(0,0,0,.18)] p-8">
          <h1 className="font-display font-bold text-xl text-ink mb-2">
            Leaving corkbored
          </h1>
          <p className="font-mono text-sm text-ink-soft mb-6">
            You&apos;re about to visit an external site. Corkbored has no control over its content.
          </p>

          <div className="rounded-lg border border-paper-edge bg-board px-4 py-3 mb-6">
            <p className="font-mono text-xs uppercase tracking-widest text-ink-soft mb-1">Destination</p>
            <p className="font-mono text-sm text-ink font-medium break-all">{displayHost}</p>
            <p className="font-mono text-xs text-ink-soft mt-0.5 break-all">{url}</p>
          </div>

          <div className="flex gap-3">
            <a
              href={url}
              rel="noopener noreferrer"
              className="flex-1 rounded-md bg-pin-red px-5 py-2.5 font-mono text-sm font-medium text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px text-center transition-transform"
            >
              Continue →
            </a>
            <Link
              href="/board"
              className="rounded-md border border-paper-edge px-5 py-2.5 font-mono text-sm text-ink-soft hover:border-ink-soft text-center"
            >
              Go back
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center font-mono text-xs text-ink-soft">
          Never enter your password or payment details on external sites.
        </p>
      </div>
    </main>
  );
}
