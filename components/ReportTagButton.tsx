"use client";

import { useState } from "react";

/** Lets a signed-in user report the tag they're currently filtering the board by. */
export function ReportTagButton({ tagId, label }: { tagId: string; label: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function report() {
    if (state === "sending" || state === "done") return;
    const reason = window.prompt(`Report the tag "${label}" — what's wrong with it?`);
    if (!reason || reason.trim().length < 10) {
      if (reason !== null) window.alert("Please give a reason of at least 10 characters.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType: "tag", subjectId: tagId, reason: reason.trim() }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      onClick={report}
      disabled={state === "sending" || state === "done"}
      title={`Report "${label}"`}
      className="rounded-full border border-transparent px-2.5 py-1.5 font-mono text-[0.7rem] text-ink-soft transition-colors hover:text-pin-red disabled:opacity-60"
    >
      {state === "done" ? "⚑ reported" : state === "error" ? "⚑ try again" : "⚑ report tag"}
    </button>
  );
}
