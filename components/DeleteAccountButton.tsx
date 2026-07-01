"use client";

import { useEffect, useRef, useState } from "react";

// Self-serve account deletion (GDPR right to erasure). Requires the user to type
// DELETE to confirm, since this is irreversible and removes owned projects.
export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  async function confirmDelete() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't delete your account. Please try again or email privacy@corkbored.com.");
        setPending(false);
        return;
      }
      // Account (and its sessions) are gone — send them home.
      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setConfirmText(""); setError(null); }}
        className="rounded-md border border-pin-red/50 px-4 py-1.5 font-mono text-xs text-pin-red hover:bg-pin-red hover:text-white"
      >
        Delete account
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === overlayRef.current && !pending) setOpen(false); }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
          <div className="relative z-10 w-full max-w-md rounded-sm bg-paper p-5 shadow-[0_24px_60px_rgba(0,0,0,.35)]">
            <h3 className="font-display text-lg font-semibold text-ink">Delete your account?</h3>
            <p className="mt-2 font-mono text-xs text-ink-soft">
              This permanently deletes your profile, sign-in, and the content you
              authored. <span className="text-pin-red">Any projects you own will be
              deleted along with all their data — for every member.</span> This
              cannot be undone.
            </p>
            <label className="mt-4 block font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">
              Type DELETE to confirm
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              className="mt-1 w-full rounded-md border border-paper-edge bg-white px-3 py-2 font-mono text-sm text-ink focus:border-ink-soft focus:outline-none"
            />

            {error && <p className="mt-2 font-mono text-xs text-pin-red">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-paper-edge px-4 py-1.5 font-mono text-xs text-ink-soft hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={pending || confirmText !== "DELETE"}
                className="rounded-md bg-pin-red px-4 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#7c2d14] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
