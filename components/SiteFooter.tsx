"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Slim global footer with the legal links, shown on every page via the root
// layout — except the landing page, which renders its own footer with the same
// links (so we don't double up).
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <footer className="border-t border-ink/10 bg-board/60">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 font-mono text-xs text-ink-soft">
        <span>© {new Date().getFullYear()} corkbored.com</span>
        <nav className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/cookies" className="hover:text-ink">Cookies</Link>
          <Link href="/dmca" className="hover:text-ink">DMCA</Link>
        </nav>
      </div>
    </footer>
  );
}
