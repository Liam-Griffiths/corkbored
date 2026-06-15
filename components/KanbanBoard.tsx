"use client";

import { useState, useRef, useCallback } from "react";
import { TaskModal, type TaskDetail } from "./TaskModal";

type Task = TaskDetail;

type Member = {
  id: string;
  displayName: string | null;
  githubLogin: string | null;
};

const COLUMNS: { id: Task["status"]; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];

const COL_COLORS: Record<string, string> = {
  todo: "border-t-ink-soft",
  doing: "border-t-pin-gold",
  done: "border-t-pin-teal",
};

export function KanbanBoard({
  initialTasks,
  members,
  projectSlug,
}: {
  initialTasks: Task[];
  members: Member[];
  projectSlug: string;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);
  const didDrag = useRef(false);

  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;

  async function patchTask(id: string, patch: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) setTasks(initialTasks);
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    const res = await fetch(`/api/projects/${projectSlug}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (res.ok) {
      const t = await res.json() as Task;
      setTasks((prev) => [...prev, { ...t, tags: t.tags ?? [] }]);
      setNewTitle("");
      setAdding(false);
    }
  }

  function moveTask(taskId: string, newStatus: Task["status"]) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    void patchTask(taskId, { status: newStatus });
  }

  function onDragStart(taskId: string) {
    dragId.current = taskId;
    didDrag.current = false;
  }

  function onDrag() {
    didDrag.current = true;
  }

  function onDragOver(e: React.DragEvent, taskId: string | null) {
    e.preventDefault();
    dragOverId.current = taskId;
  }

  function onDrop(e: React.DragEvent, colStatus: Task["status"]) {
    e.preventDefault();
    if (!dragId.current) return;
    const dragged = tasks.find((t) => t.id === dragId.current);
    if (!dragged) return;

    const colTasks = tasks
      .filter((t) => t.status === colStatus && t.id !== dragId.current)
      .sort((a, b) => a.position - b.position);

    const overIdx = dragOverId.current
      ? colTasks.findIndex((t) => t.id === dragOverId.current)
      : -1;

    let newPosition: number;
    if (colTasks.length === 0) {
      newPosition = 1000;
    } else if (overIdx === -1 || overIdx >= colTasks.length - 1) {
      newPosition = (colTasks[colTasks.length - 1]?.position ?? 0) + 1000;
    } else {
      const before = colTasks[overIdx]?.position ?? 0;
      const after = colTasks[overIdx + 1]?.position ?? before + 2000;
      newPosition = (before + after) / 2;
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === dragId.current ? { ...t, status: colStatus, position: newPosition } : t,
      ),
    );
    void patchTask(dragId.current, { status: colStatus, position: newPosition });
    dragId.current = null;
    dragOverId.current = null;
  }

  function handleCardClick(taskId: string) {
    if (didDrag.current) return;
    setOpenTaskId(taskId);
  }

  const getMemberInitial = useCallback(
    (assigneeId: string | null) => {
      if (!assigneeId) return null;
      const m = members.find((m) => m.id === assigneeId);
      if (!m) return null;
      return (m.displayName ?? m.githubLogin ?? "?")[0].toUpperCase();
    },
    [members],
  );

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks
            .filter((t) => t.status === col.id)
            .sort((a, b) => a.position - b.position);

          return (
            <div
              key={col.id}
              className={`rounded-lg border-t-2 ${COL_COLORS[col.id]} border border-paper-edge bg-board/40 p-3`}
              onDragOver={(e) => onDragOver(e, null)}
              onDrop={(e) => onDrop(e, col.id)}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs font-medium uppercase tracking-widest text-ink-soft">
                  {col.label}
                </span>
                <span className="font-mono text-xs text-ink-soft">{colTasks.length}</span>
              </div>

              {col.id === "todo" && (
                adding ? (
                  <div className="mb-2">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void createTask();
                        if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
                      }}
                      placeholder="Task title…"
                      maxLength={120}
                      className="w-full rounded-md border border-pin-gold bg-paper px-2 py-1.5 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
                    />
                    <div className="mt-1.5 flex gap-1.5">
                      <button onClick={() => void createTask()} className="rounded-md bg-pin-red px-2.5 py-1 font-mono text-xs text-white">Add</button>
                      <button onClick={() => { setAdding(false); setNewTitle(""); }} className="rounded-md border border-paper-edge px-2.5 py-1 font-mono text-xs text-ink-soft">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAdding(true)}
                    className="mb-2 w-full rounded-md border border-dashed border-paper-edge py-1.5 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-ink"
                  >
                    + Add task
                  </button>
                )
              )}

              <div className="space-y-2">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => onDragStart(task.id)}
                    onDrag={onDrag}
                    onDragOver={(e) => onDragOver(e, task.id)}
                    onClick={() => handleCardClick(task.id)}
                    className="group cursor-pointer rounded-md border border-paper-edge bg-paper p-2.5 shadow-sm active:opacity-60 hover:border-ink-soft hover:shadow-md transition-shadow"
                  >
                    <p className="text-sm text-ink leading-snug">{task.title}</p>

                    {/* Tags */}
                    {task.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {task.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-sm bg-paper-edge px-1.5 py-0.5 font-mono text-[0.58rem] text-ink-soft">
                            {tag}
                          </span>
                        ))}
                        {task.tags.length > 3 && (
                          <span className="font-mono text-[0.58rem] text-ink-soft">+{task.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      {task.assigneeId ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-pin-teal text-[0.6rem] font-semibold text-white" title={members.find(m => m.id === task.assigneeId)?.githubLogin ?? ""}>
                          {getMemberInitial(task.assigneeId)}
                        </span>
                      ) : (
                        <span />
                      )}
                      <div
                        className="flex gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {col.id !== "todo" && (
                          <button
                            onClick={() => moveTask(task.id, col.id === "done" ? "doing" : "todo")}
                            aria-label="Move left"
                            className="rounded px-1 py-0.5 font-mono text-xs text-ink-soft hover:bg-board hover:text-ink"
                          >
                            ←
                          </button>
                        )}
                        {col.id !== "done" && (
                          <button
                            onClick={() => moveTask(task.id, col.id === "todo" ? "doing" : "done")}
                            aria-label="Move right"
                            className="rounded px-1 py-0.5 font-mono text-xs text-ink-soft hover:bg-board hover:text-ink"
                          >
                            →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 font-mono text-xs text-ink-soft">
        Click a card to open · drag between columns · use ← → for keyboard access.
      </p>

      {openTask && (
        <TaskModal
          task={openTask}
          members={members}
          onClose={() => setOpenTaskId(null)}
          onUpdate={(updated) =>
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
          }
          onDelete={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
        />
      )}
    </div>
  );
}
