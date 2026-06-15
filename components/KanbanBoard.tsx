"use client";

import { useState, useRef, useCallback } from "react";
import { TaskModal, type TaskDetail } from "./TaskModal";

type Task = TaskDetail;
type Status = Task["status"];

type Member = {
  id: string;
  displayName: string | null;
  githubLogin: string | null;
};

// Full task flow. The board shows the three middle channels; backlog and
// archive bookend it and live in their own views.
const FLOW: Status[] = ["backlog", "todo", "doing", "done", "archived"];
const STATUS_LABELS: Record<Status, string> = {
  backlog: "Backlog",
  todo: "To do",
  doing: "In progress",
  done: "Done",
  archived: "Archive",
};

const COLUMNS: { id: Status; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];

const COL_COLORS: Record<string, string> = {
  todo: "border-t-ink-soft",
  doing: "border-t-pin-gold",
  done: "border-t-pin-teal",
};

// Cork-board pin colours per status — a subtle nod to the board metaphor.
const PIN_COLORS: Record<Status, string> = {
  backlog: "bg-ink-soft/60",
  todo: "bg-ink-soft",
  doing: "bg-pin-gold",
  done: "bg-pin-teal",
  archived: "bg-ink-soft/40",
};

function Pin({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block h-2 w-2 flex-shrink-0 rounded-full shadow-[inset_-1px_-1px_2px_rgba(0,0,0,.35)] ${PIN_COLORS[status]}`}
      aria-hidden="true"
    />
  );
}

type View = "backlog" | "board" | "archived";

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
  const [view, setView] = useState<View>("board");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);
  const didDrag = useRef(false);

  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;

  const backlogCount = tasks.filter((t) => t.status === "backlog").length;
  const archivedCount = tasks.filter((t) => t.status === "archived").length;

  async function patchTask(id: string, patch: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) setTasks(initialTasks);
  }

  async function createTask(title: string, status: Status) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/projects/${projectSlug}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed, status }),
    });
    if (res.ok) {
      const t = await res.json() as Task;
      setTasks((prev) => [...prev, { ...t, tags: t.tags ?? [] }]);
    }
  }

  function moveTask(taskId: string, newStatus: Status) {
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

  function onDrop(e: React.DragEvent, colStatus: Status) {
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

  const memberLogin = (assigneeId: string | null) =>
    members.find((m) => m.id === assigneeId)?.githubLogin ?? "";

  // Backlog → Board → Archive
  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "backlog", label: "Backlog", count: backlogCount },
    { id: "board", label: "Board" },
    { id: "archived", label: "Archive", count: archivedCount },
  ];

  return (
    <div>
      {/* View switcher */}
      <div className="mb-4 inline-flex rounded-md border border-paper-edge bg-paper p-0.5 shadow-[0_2px_6px_rgba(0,0,0,.08)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs transition-colors ${
              view === t.id ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={view === t.id ? "text-paper/70" : "text-ink-soft"}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {view === "board" && (
        <div className="grid grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks
              .filter((t) => t.status === col.id)
              .sort((a, b) => a.position - b.position);
            const idx = FLOW.indexOf(col.id);
            const prev = FLOW[idx - 1];
            const next = FLOW[idx + 1];

            return (
              <div
                key={col.id}
                className={`rounded-lg border-t-2 ${COL_COLORS[col.id]} border border-paper-edge bg-board/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.4)]`}
                onDragOver={(e) => onDragOver(e, null)}
                onDrop={(e) => onDrop(e, col.id)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-widest text-ink-soft">
                    <Pin status={col.id} />
                    {col.label}
                  </span>
                  <span className="font-mono text-xs text-ink-soft">{colTasks.length}</span>
                </div>

                {col.id === "todo" && <AddTask status="todo" onCreate={createTask} />}

                <div className="space-y-2">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => onDragStart(task.id)}
                      onDrag={onDrag}
                      onDragOver={(e) => onDragOver(e, task.id)}
                      onClick={() => handleCardClick(task.id)}
                      className="group relative cursor-pointer rounded-md border border-paper-edge bg-paper p-2.5 pt-3 shadow-[0_2px_5px_rgba(0,0,0,.1)] active:opacity-60 hover:border-ink-soft hover:shadow-[0_4px_10px_rgba(0,0,0,.15)] transition-shadow"
                    >
                      {/* Pin tack at the top of each card */}
                      <span
                        className={`absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full shadow-[0_1px_2px_rgba(0,0,0,.4)] ${PIN_COLORS[col.id]}`}
                        aria-hidden="true"
                      />
                      <p className="text-sm text-ink leading-snug">{task.title}</p>

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
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-pin-teal text-[0.6rem] font-semibold text-white" title={memberLogin(task.assigneeId)}>
                            {getMemberInitial(task.assigneeId)}
                          </span>
                        ) : (
                          <span />
                        )}
                        <div
                          className="flex gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {prev && (
                            <button
                              onClick={() => moveTask(task.id, prev)}
                              aria-label={`Move to ${STATUS_LABELS[prev]}`}
                              title={`Move to ${STATUS_LABELS[prev]}`}
                              className="rounded px-1 py-0.5 font-mono text-xs text-ink-soft hover:bg-board hover:text-ink"
                            >
                              ←
                            </button>
                          )}
                          {next && (
                            <button
                              onClick={() => moveTask(task.id, next)}
                              aria-label={`Move to ${STATUS_LABELS[next]}`}
                              title={`Move to ${STATUS_LABELS[next]}`}
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
      )}

      {view === "backlog" && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Pin status="backlog" />
            <h3 className="font-mono text-xs font-medium uppercase tracking-widest text-ink-soft">Backlog</h3>
          </div>
          <div className="mb-3 max-w-xl">
            <AddTask status="backlog" onCreate={createTask} />
          </div>
          <div className="max-w-xl">
            <TaskList
              tasks={tasks.filter((t) => t.status === "backlog")}
              emptyText="Nothing in the backlog yet. Add ideas here, or send tasks back from the To do column."
              actionLabel="→ To do"
              onAction={(id) => moveTask(id, "todo")}
              onOpen={setOpenTaskId}
              getMemberInitial={getMemberInitial}
              memberLogin={memberLogin}
            />
          </div>
        </div>
      )}

      {view === "archived" && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Pin status="archived" />
            <h3 className="font-mono text-xs font-medium uppercase tracking-widest text-ink-soft">Archive</h3>
          </div>
          <div className="max-w-xl">
            <TaskList
              tasks={tasks.filter((t) => t.status === "archived")}
              emptyText="No archived tasks. Completed work you no longer need on the board lands here."
              actionLabel="Restore"
              onAction={(id) => moveTask(id, "done")}
              onOpen={setOpenTaskId}
              getMemberInitial={getMemberInitial}
              memberLogin={memberLogin}
            />
          </div>
        </div>
      )}

      {view === "board" && (
        <p className="mt-3 font-mono text-xs text-ink-soft">
          Click a card to open · drag between columns · ← on To do sends to Backlog, → on Done archives.
        </p>
      )}

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

function AddTask({
  status,
  onCreate,
}: {
  status: Status;
  onCreate: (title: string, status: Status) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function submit() {
    if (!title.trim()) return;
    await onCreate(title, status);
    setTitle("");
    setAdding(false);
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="mb-2 w-full rounded-md border border-dashed border-paper-edge py-1.5 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-ink"
      >
        + Add task
      </button>
    );
  }

  return (
    <div className="mb-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
          if (e.key === "Escape") { setAdding(false); setTitle(""); }
        }}
        placeholder="Task title…"
        maxLength={120}
        className="w-full rounded-md border border-pin-gold bg-paper px-2 py-1.5 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
      />
      <div className="mt-1.5 flex gap-1.5">
        <button onClick={() => void submit()} className="rounded-md bg-pin-red px-2.5 py-1 font-mono text-xs text-white">Add</button>
        <button onClick={() => { setAdding(false); setTitle(""); }} className="rounded-md border border-paper-edge px-2.5 py-1 font-mono text-xs text-ink-soft">Cancel</button>
      </div>
    </div>
  );
}

function TaskList({
  tasks,
  emptyText,
  actionLabel,
  onAction,
  onOpen,
  getMemberInitial,
  memberLogin,
}: {
  tasks: Task[];
  emptyText: string;
  actionLabel: string;
  onAction: (id: string) => void;
  onOpen: (id: string) => void;
  getMemberInitial: (assigneeId: string | null) => string | null;
  memberLogin: (assigneeId: string | null) => string;
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-paper-edge p-8 text-center font-mono text-sm text-ink-soft">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {tasks
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((task) => (
          <div
            key={task.id}
            onClick={() => onOpen(task.id)}
            className="group flex cursor-pointer items-center gap-3 rounded-md border border-paper-edge bg-paper p-3 shadow-[0_2px_5px_rgba(0,0,0,.1)] hover:border-ink-soft hover:shadow-[0_4px_10px_rgba(0,0,0,.15)] transition-shadow"
          >
            {task.assigneeId ? (
              <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-pin-teal text-[0.62rem] font-semibold text-white" title={memberLogin(task.assigneeId)}>
                {getMemberInitial(task.assigneeId)}
              </span>
            ) : (
              <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-paper-edge text-[0.62rem] text-ink-soft">·</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{task.title}</p>
              {task.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {task.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-sm bg-paper-edge px-1.5 py-0.5 font-mono text-[0.58rem] text-ink-soft">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onAction(task.id); }}
              className="flex-shrink-0 rounded-md border border-paper-edge px-2.5 py-1 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-ink"
            >
              {actionLabel}
            </button>
          </div>
        ))}
    </div>
  );
}
