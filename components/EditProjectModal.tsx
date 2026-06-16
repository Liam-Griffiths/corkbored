"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownEditor } from "./MarkdownEditor";

type Stage = "building" | "prototype" | "launched";

const STAGES: { id: Stage; label: string }[] = [
  { id: "building", label: "Building" },
  { id: "prototype", label: "Prototype" },
  { id: "launched", label: "Launched" },
];

export function EditProjectModal({
  slug,
  initialTitle,
  initialPitch,
  initialStage,
  initialTags,
  initialOverview,
}: {
  slug: string;
  initialTitle: string;
  initialPitch: string;
  initialStage: Stage;
  initialTags: string[];
  initialOverview: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [pitch, setPitch] = useState(initialPitch);
  const [stage, setStage] = useState<Stage>(initialStage);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [overview, setOverview] = useState(initialOverview);
  const [tagInput, setTagInput] = useState("");
  const [suggestions, setSuggestions] = useState<{ slug: string; label: string; count: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset form to current values whenever the modal opens
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setPitch(initialPitch);
      setStage(initialStage);
      setTags(initialTags);
      setOverview(initialOverview);
      setTagInput("");
      setError(null);
    }
  }, [open, initialTitle, initialPitch, initialStage, initialTags, initialOverview]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Debounced tag autocomplete against the popularity-ranked search endpoint.
  useEffect(() => {
    const q = tagInput.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (!q) { setSuggestions([]); return; }
      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setSuggestions(await res.json());
      } catch { /* aborted or offline */ }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [tagInput]);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9.+#-]/g, "");
    if (!tag || tags.includes(tag) || tags.length >= 6) return;
    setTags((prev) => [...prev, tag]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function save() {
    if (!title.trim()) { setError("Title can't be empty."); return; }
    if (tags.length === 0) { setError("Add at least one skill or tag."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), pitch: pitch.trim(), stage, tags, overview: overview.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't save changes.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Edit project"
        title="Edit project"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-paper-edge text-ink-soft transition-colors hover:border-ink-soft hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />

          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-sm bg-paper shadow-[0_24px_60px_rgba(0,0,0,.35)]">
            {/* Pin tack */}
            <span
              className="absolute -top-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff8a72,#c94e2a_60%,#7c2d14)] shadow-[0_3px_5px_rgba(0,0,0,.4)]"
              aria-hidden="true"
            />
            <div className="flex items-start justify-between p-5 pb-0">
              <h3 className="font-display text-lg font-semibold text-ink">Edit project</h3>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-5 pb-5 pt-4">
              {/* Title */}
              <div>
                <label className="mb-1.5 block font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink focus:outline-2 focus:outline-pin-gold"
                />
              </div>

              {/* Description / pitch */}
              <div>
                <label className="mb-1.5 block font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Description</label>
                <textarea
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  rows={4}
                  maxLength={280}
                  placeholder="What is this project, and who's it for?"
                  className="w-full resize-y rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
                />
                <p className="mt-1 text-right font-mono text-[0.6rem] text-ink-soft">{pitch.length}/280</p>
              </div>

              {/* Overview / about (markdown) */}
              <div>
                <label className="mb-1.5 block font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">About (markdown, optional)</label>
                <MarkdownEditor
                  value={overview}
                  onChange={setOverview}
                  rows={8}
                  maxLength={20000}
                  placeholder="A longer write-up shown on the public project page…"
                />
              </div>

              {/* Stage */}
              <div>
                <label className="mb-1.5 block font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Stage</label>
                <div className="flex gap-2">
                  {STAGES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStage(s.id)}
                      className={`rounded-full px-3 py-1 font-mono text-xs transition-all ${
                        stage === s.id
                          ? "bg-ink text-paper font-medium"
                          : "border border-paper-edge text-ink-soft hover:border-ink-soft hover:text-ink"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills / tags */}
              <div>
                <label className="mb-1.5 block font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Skills &amp; tags</label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 rounded-sm bg-paper-edge px-2 py-0.5 font-mono text-xs text-ink-soft">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="leading-none hover:text-pin-red">×</button>
                    </span>
                  ))}
                </div>
                {tags.length < 6 && (
                  <div className="relative w-52">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
                      }}
                      onBlur={() => { if (tagInput) addTag(tagInput); }}
                      placeholder="Add a skill, press Enter"
                      maxLength={30}
                      className="w-full rounded-md border border-paper-edge bg-paper-bright px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
                    />
                    {suggestions.filter((s) => !tags.includes(s.slug)).length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-paper-edge bg-paper-bright shadow-[0_8px_18px_rgba(0,0,0,.18)]">
                        {suggestions.filter((s) => !tags.includes(s.slug)).map((s) => (
                          <li key={s.slug}>
                            <button
                              type="button"
                              // onMouseDown so it fires before the input's onBlur
                              onMouseDown={(e) => { e.preventDefault(); addTag(s.slug); }}
                              className="flex w-full items-center justify-between px-2.5 py-1.5 text-left font-mono text-xs text-ink hover:bg-paper-edge"
                            >
                              <span>{s.label}</span>
                              <span className="text-[0.6rem] text-ink-soft">{s.count}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {error && <p className="font-mono text-xs text-pin-red">{error}</p>}

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-paper-edge pt-4">
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="rounded-md bg-pin-red px-4 py-2 font-mono text-sm font-medium text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-paper-edge px-4 py-2 font-mono text-sm text-ink-soft hover:border-ink-soft hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
