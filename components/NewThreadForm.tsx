"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownEditor } from "./MarkdownEditor";

export function NewThreadForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !body.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Couldn't post the thread.");
        return;
      }
      const created = await res.json();
      router.push(`/p/${slug}/discussion/${created.id}`);
    } finally {
      setPosting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 w-full rounded-lg border border-dashed border-paper-edge px-4 py-3 text-left font-mono text-sm text-ink-soft hover:border-ink-soft hover:text-ink"
      >
        + New thread
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-paper-edge bg-paper-bright p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thread title"
        autoFocus
        maxLength={200}
        className="mb-2 w-full rounded-md border border-paper-edge bg-paper px-3 py-2 font-display text-sm font-semibold text-ink placeholder:font-sans placeholder:font-normal placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
      />
      <MarkdownEditor
        value={body}
        onChange={setBody}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(); }}
        placeholder="Write the first post…"
        rows={4}
        maxLength={5000}
      />
      {error && <p className="mt-1 font-mono text-xs text-pin-red">{error}</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-xs text-ink-soft">⌘↵ to post · markdown</span>
        <div className="flex gap-2">
          <button
            onClick={() => { setOpen(false); setTitle(""); setBody(""); setError(null); }}
            className="rounded-md border border-paper-edge px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={posting || !title.trim() || !body.trim()}
            className="rounded-md bg-pin-teal px-4 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#0e5a47] hover:-translate-y-px disabled:opacity-50"
          >
            {posting ? "Posting…" : "Post thread"}
          </button>
        </div>
      </div>
    </div>
  );
}
