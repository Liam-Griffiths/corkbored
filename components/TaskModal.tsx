"use client";

import { useEffect, useRef, useState } from "react";

export type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: "backlog" | "todo" | "doing" | "done" | "archived";
  position: number;
  assigneeId: string | null;
  assignee?: { id: string; displayName: string | null; githubLogin: string | null } | null;
  createdById: string | null;
  createdBy?: { id: string; displayName: string | null; githubLogin: string | null } | null;
  tags: string[];
  createdAt: Date | string;
};

type Member = { id: string; displayName: string | null; githubLogin: string | null };

const STATUS_LABELS = { backlog: "Backlog", todo: "To do", doing: "In progress", done: "Done", archived: "Archived" };
const STATUS_COLORS = {
  backlog: "bg-board text-ink-soft",
  todo: "bg-paper-edge text-ink-soft",
  doing: "bg-[#fff8e1] text-pin-gold",
  done: "bg-[#d9efe6] text-pin-teal",
  archived: "bg-board text-ink-soft",
};

export function TaskModal({
  task: initialTask,
  members,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: TaskDetail;
  members: Member[];
  onClose: () => void;
  onUpdate: (updated: Partial<TaskDetail> & { id: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [task, setTask] = useState(initialTask);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Auto-size title textarea
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
    }
  }, [task.title]);

  async function patch(patch: Partial<TaskDetail>) {
    const next = { ...task, ...patch };
    setTask(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setTask((prev) => ({ ...prev, ...updated, tags: Array.isArray(updated.tags) ? updated.tags : prev.tags }));
        onUpdate({ id: task.id, ...patch });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    onDelete(task.id);
    onClose();
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!tag || task.tags.includes(tag) || task.tags.length >= 10) return;
    void patch({ tags: [...task.tags, tag] });
    setTagInput("");
  }

  function removeTag(tag: string) {
    void patch({ tags: task.tags.filter((t) => t !== tag) });
  }

  const creatorName = task.createdBy
    ? (task.createdBy.displayName ?? task.createdBy.githubLogin)
    : null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-sm bg-paper shadow-[0_24px_60px_rgba(0,0,0,.35)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start gap-2 p-5 pb-0">
          <textarea
            ref={titleRef}
            value={task.title}
            rows={1}
            maxLength={120}
            onChange={(e) => setTask((p) => ({ ...p, title: e.target.value }))}
            onBlur={() => { if (task.title !== initialTask.title) void patch({ title: task.title }); }}
            className="flex-1 resize-none font-display font-semibold text-xl text-ink bg-transparent focus:outline-none leading-snug overflow-hidden"
          />
          <button onClick={onClose} className="mt-1 flex-shrink-0 text-ink-soft hover:text-ink">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 pt-3 space-y-5">
          {/* Status + saving */}
          <div className="flex flex-wrap items-center gap-2">
            {(["backlog", "todo", "doing", "done", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => void patch({ status: s })}
                className={`rounded-full px-3 py-1 font-mono text-xs transition-all ${
                  task.status === s
                    ? `${STATUS_COLORS[s]} font-semibold ring-2 ring-offset-1 ring-current/30`
                    : "bg-paper-edge text-ink-soft hover:text-ink"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
            {saving && <span className="ml-auto font-mono text-[0.65rem] text-ink-soft">saving…</span>}
          </div>

          {/* Description */}
          <div>
            <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Notes</p>
            <textarea
              value={task.description ?? ""}
              onChange={(e) => setTask((p) => ({ ...p, description: e.target.value }))}
              onBlur={(e) => {
                const val = e.target.value || null;
                if (val !== initialTask.description) void patch({ description: val });
              }}
              rows={4}
              placeholder="Add notes, context, links…"
              className="w-full resize-y rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
            />
          </div>

          {/* Assignee */}
          <div>
            <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Assigned to</p>
            <select
              value={task.assigneeId ?? ""}
              onChange={(e) => void patch({ assigneeId: e.target.value || null })}
              className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-mono text-sm text-ink focus:outline-2 focus:outline-pin-gold"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName ?? m.githubLogin} (@{m.githubLogin})
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Labels</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {task.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-sm bg-paper-edge px-2 py-0.5 font-mono text-xs text-ink-soft">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-pin-red leading-none">×</button>
                </span>
              ))}
            </div>
            {task.tags.length < 10 && (
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
                }}
                onBlur={() => { if (tagInput) addTag(tagInput); }}
                placeholder="Add label, press Enter"
                maxLength={30}
                className="rounded-md border border-paper-edge bg-paper-bright px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold w-48"
              />
            )}
          </div>

          {/* Meta */}
          <div className="border-t border-paper-edge pt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft mb-0.5">Created by</p>
              <p className="font-mono text-xs text-ink">{creatorName ?? "—"}</p>
            </div>
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft mb-0.5">Created</p>
              <p className="font-mono text-xs text-ink">
                {new Date(task.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Delete */}
          <div className="flex justify-end">
            <button
              onClick={() => void handleDelete()}
              className={`font-mono text-xs transition-colors ${
                confirmDelete ? "text-pin-red font-semibold" : "text-ink-soft hover:text-pin-red"
              }`}
            >
              {confirmDelete ? "Click again to confirm delete" : "Delete task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
