"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ExportRecord = {
  id: string;
  status: "pending" | "ready" | "failed";
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
};

export function DataExportPanel({ initialExport }: { initialExport: ExportRecord | null }) {
  const [record, setRecord] = useState<ExportRecord | null>(initialExport);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isExpired = (e: ExportRecord) =>
    e.status === "ready" && e.expiresAt != null && new Date(e.expiresAt) < new Date();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Poll for status while an export is being assembled.
  useEffect(() => {
    if (record?.status !== "pending") {
      stopPolling();
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/account/export");
        if (!res.ok) return;
        const data = await res.json();
        if (data.export) setRecord(data.export);
      } catch {
        /* transient — keep polling */
      }
    }, 3000);
    return stopPolling;
  }, [record?.status, stopPolling]);

  async function request() {
    setError(null);
    setRequesting(true);
    try {
      const res = await fetch("/api/account/export", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError("Couldn't start the export. Please try again.");
        return;
      }
      setRecord(data.export);
    } catch {
      setError("Something went wrong.");
    } finally {
      setRequesting(false);
    }
  }

  const canDownload = record?.status === "ready" && !isExpired(record);
  const showRequest = !record || record.status === "failed" || isExpired(record);

  return (
    <div className="rounded-lg border border-paper-edge bg-paper p-4">
      <h3 className="font-display text-sm font-bold text-ink">Your data (export)</h3>
      <p className="mt-0.5 font-mono text-xs text-ink-soft">
        Request a complete copy of the personal data we hold about you. We assemble
        it in the background — this usually takes a few seconds.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {showRequest && (
          <button
            onClick={request}
            disabled={requesting}
            className="rounded-md border border-paper-edge px-4 py-1.5 font-mono text-xs text-ink-soft hover:text-ink disabled:opacity-50"
          >
            {requesting ? "Starting…" : "Request data export"}
          </button>
        )}

        {record?.status === "pending" && (
          <span className="font-mono text-xs text-ink-soft">
            Preparing your export… <span className="animate-pulse">●</span>
          </span>
        )}

        {canDownload && (
          <>
            <a
              href={`/api/account/export/${record!.id}`}
              className="rounded-md bg-pin-red px-4 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#7c2d14] transition-transform hover:-translate-y-px"
            >
              Download export (JSON)
            </a>
            <button
              onClick={request}
              disabled={requesting}
              className="font-mono text-xs text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-50"
            >
              Regenerate
            </button>
          </>
        )}
      </div>

      {canDownload && record!.expiresAt && (
        <p className="mt-2 font-mono text-[0.65rem] text-ink-soft">
          Link expires {new Date(record!.expiresAt).toLocaleDateString()}.
        </p>
      )}
      {record?.status === "failed" && (
        <p className="mt-2 font-mono text-xs text-pin-red">
          That export failed to generate. Please try again.
        </p>
      )}
      {record && isExpired(record) && (
        <p className="mt-2 font-mono text-[0.65rem] text-ink-soft">
          Your previous export has expired. Request a fresh one above.
        </p>
      )}
      {error && <p className="mt-2 font-mono text-xs text-pin-red">{error}</p>}
    </div>
  );
}
