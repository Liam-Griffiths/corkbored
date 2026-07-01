import Link from "next/link";
import { Header } from "@/components/Header";
import { Markdown } from "@/components/Markdown";
import { LAST_UPDATED } from "@/lib/legal";

// Shared chrome for the static legal pages (terms, privacy, cookies).
export function LegalPage({ title, body }: { title: string; body: string }) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-5 py-10">
        <Link href="/" className="font-mono text-[0.78rem] text-ink-soft hover:text-ink">
          ← back home
        </Link>
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-1 font-mono text-xs text-ink-soft">Last updated: {LAST_UPDATED}</p>

        <div className="mt-6 legal-prose">
          <Markdown>{body}</Markdown>
        </div>

        <nav className="mt-10 flex flex-wrap gap-4 border-t border-paper-edge pt-6 font-mono text-xs text-ink-soft">
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/cookies" className="hover:text-ink">Cookies</Link>
          <Link href="/dmca" className="hover:text-ink">DMCA</Link>
        </nav>
      </main>
    </>
  );
}
