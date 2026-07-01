"use client";

import Link from "next/link";
import { useState } from "react";

// Checkbox-gated GitHub sign-in. The form action (a server action) sets the
// consent cookie and starts OAuth; the button stays disabled until the user
// confirms they're 16+ and accept the Terms & Privacy Policy.
export function SignInForm({ action }: { action: () => Promise<void> }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <form action={action} className="mt-7 w-full">
      <label className="flex cursor-pointer items-start gap-2 text-left">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-pin-red"
        />
        <span className="font-mono text-xs leading-relaxed text-ink-soft">
          I am at least 16 years old and agree to the{" "}
          <Link href="/terms" className="text-pin-teal underline underline-offset-2" target="_blank">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-pin-teal underline underline-offset-2" target="_blank">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={!agreed}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-ink px-6 py-2.5 font-mono text-sm text-paper shadow-[0_2px_0_rgba(0,0,0,.3)] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
        </svg>
        Continue with GitHub
      </button>
    </form>
  );
}
