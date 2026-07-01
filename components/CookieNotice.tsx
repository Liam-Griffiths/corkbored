"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cb-cookie-notice-ack";

// We only set strictly-necessary cookies, so this is an informational notice
// rather than a consent gate. If non-essential cookies are ever added, this must
// become a real consent flow (with reject + granular options).
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // One-time read of client-only storage on mount (not available during SSR).
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage on mount
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      // localStorage unavailable — don't block the page.
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-paper-edge bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs text-ink-soft">
          We use only strictly-necessary cookies to sign you in and keep the site
          secure — no tracking or ads.{" "}
          <Link href="/cookies" className="text-pin-teal underline underline-offset-2">
            Learn more
          </Link>
          .
        </p>
        <button
          onClick={dismiss}
          className="flex-shrink-0 rounded-md bg-pin-red px-4 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#7c2d14] transition-transform hover:-translate-y-px"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
