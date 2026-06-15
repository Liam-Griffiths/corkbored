"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-5">
      <div className="text-center">
        <p className="font-mono text-6xl font-bold text-ink/10 select-none">500</p>
        <h1 className="mt-4 font-display font-bold text-2xl text-ink">Something broke</h1>
        <p className="mt-2 font-mono text-sm text-ink-soft">
          An unexpected error occurred.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-md bg-pin-red px-5 py-2.5 font-mono text-sm font-medium text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px"
          >
            Try again
          </button>
          <Link
            href="/board"
            className="rounded-md border border-paper-edge px-5 py-2.5 font-mono text-sm text-ink-soft hover:border-ink-soft"
          >
            Back to the board
          </Link>
        </div>
      </div>
    </main>
  );
}
