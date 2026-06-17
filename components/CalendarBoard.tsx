"use client";

import { useCallback, useEffect, useState } from "react";

interface EventUser {
  id: string;
  displayName: string | null;
  githubLogin: string | null;
  avatarUrl: string | null;
}

interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  isPublic: boolean;
  createdBy: EventUser;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Mon-first 6-week grid covering the month containing `view`.
function buildGrid(view: Date): Date[] {
  const first = startOfMonth(view);
  const offset = (first.getDay() + 6) % 7; // days since Monday
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ISO window spanning the 6-week grid for `view`, for the events query.
function monthRange(view: Date): { from: string; to: string } {
  const cells = buildGrid(view);
  return {
    from: cells[0].toISOString(),
    to: new Date(cells[41].getTime() + 86_400_000).toISOString(),
  };
}

interface FormState {
  id: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  isPublic: boolean;
  location: string;
  description: string;
}

export function CalendarBoard({ slug }: { slug: string }) {
  const [view, setView] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grid = buildGrid(view);
  const todayKey = dayKey(new Date());

  // Manual reload (after create/edit/delete) for the current view.
  const load = useCallback(async () => {
    const { from, to } = monthRange(view);
    try {
      const res = await fetch(`/api/projects/${slug}/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (res.ok) setEvents(await res.json());
    } catch {
      /* offline — keep current view */
    }
  }, [slug, view]);

  // Load events whenever the visible month changes; guard against races.
  useEffect(() => {
    let active = true;
    const { from, to } = monthRange(view);
    fetch(`/api/projects/${slug}/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (active && data) setEvents(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [slug, view]);

  const byDay = new Map<string, CalEvent[]>();
  for (const ev of events) {
    const k = dayKey(new Date(ev.startAt));
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(ev);
  }

  function openCreate(day: Date) {
    setError(null);
    setForm({
      id: null,
      title: "",
      date: toDateInput(day),
      startTime: "10:00",
      endTime: "",
      allDay: false,
      isPublic: false,
      location: "",
      description: "",
    });
  }

  function openEdit(ev: CalEvent) {
    setError(null);
    setForm({
      id: ev.id,
      title: ev.title,
      date: toDateInput(new Date(ev.startAt)),
      startTime: ev.allDay ? "10:00" : toTimeInput(ev.startAt),
      endTime: ev.endAt ? toTimeInput(ev.endAt) : "",
      allDay: ev.allDay,
      isPublic: ev.isPublic,
      location: ev.location ?? "",
      description: ev.description ?? "",
    });
  }

  async function save() {
    if (!form || saving) return;
    if (!form.title.trim()) { setError("Give the event a title."); return; }
    setSaving(true);
    setError(null);

    const startAt = new Date(`${form.date}T${form.allDay ? "00:00" : form.startTime}`).toISOString();
    const endAt = !form.allDay && form.endTime
      ? new Date(`${form.date}T${form.endTime}`).toISOString()
      : null;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      location: form.location.trim() || undefined,
      startAt,
      endAt,
      allDay: form.allDay,
      isPublic: form.isPublic,
    };

    try {
      const res = await fetch(
        form.id ? `/api/projects/${slug}/events/${form.id}` : `/api/projects/${slug}/events`,
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Couldn't save the event.");
        return;
      }
      setForm(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!form?.id || saving) return;
    if (!window.confirm("Delete this event?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${slug}/events/${form.id}`, { method: "DELETE" });
      if (res.ok) {
        setForm(null);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  const monthLabel = view.toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
            className="rounded-md border border-paper-edge px-2.5 py-1 font-mono text-sm text-ink-soft hover:border-ink-soft hover:text-ink"
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="min-w-[10rem] text-center font-display text-base font-semibold text-ink">{monthLabel}</span>
          <button
            onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
            className="rounded-md border border-paper-edge px-2.5 py-1 font-mono text-sm text-ink-soft hover:border-ink-soft hover:text-ink"
            aria-label="Next month"
          >
            ›
          </button>
          <button
            onClick={() => setView(startOfMonth(new Date()))}
            className="ml-1 rounded-md border border-paper-edge px-2.5 py-1 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-ink"
          >
            today
          </button>
        </div>
        <button
          onClick={() => openCreate(new Date())}
          className="rounded-md bg-pin-teal px-3 py-1.5 font-mono text-sm font-medium text-white shadow-[0_2px_0_#0f5e5e] hover:-translate-y-px"
        >
          + New event
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-t-md border border-paper-edge bg-paper-edge">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-board px-2 py-1.5 text-center font-mono text-[0.62rem] uppercase tracking-widest text-ink-soft">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px rounded-b-md border border-t-0 border-paper-edge bg-paper-edge">
        {grid.map((day) => {
          const inMonth = day.getMonth() === view.getMonth();
          const k = dayKey(day);
          const dayEvents = byDay.get(k) ?? [];
          const isToday = k === todayKey;
          return (
            <div
              key={k}
              onClick={() => openCreate(day)}
              className={`min-h-[5.5rem] cursor-pointer bg-paper p-1.5 transition-colors hover:bg-paper-bright ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 font-mono text-[0.68rem] ${
                    isToday ? "bg-pin-red font-semibold text-white" : "text-ink-soft"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                    className="block w-full truncate rounded-sm bg-pin-teal/15 px-1 py-0.5 text-left font-mono text-[0.62rem] text-ink hover:bg-pin-teal/25"
                    title={ev.isPublic ? `${ev.title} (public)` : ev.title}
                  >
                    {ev.isPublic && <span className="text-pin-gold" title="Public">◆ </span>}
                    <span className="text-ink-soft">{ev.allDay ? "•" : timeLabel(ev.startAt)}</span> {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1 font-mono text-[0.58rem] text-ink-soft">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / edit modal */}
      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setForm(null); }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
          <div className="relative z-10 w-full max-w-md rounded-sm bg-paper p-5 shadow-[0_24px_60px_rgba(0,0,0,.35)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-ink">{form.id ? "Edit event" : "New event"}</h3>
              <button onClick={() => setForm(null)} className="text-ink-soft hover:text-ink">✕</button>
            </div>

            <div className="space-y-3">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Event title"
                autoFocus
                maxLength={120}
                className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink focus:outline-2 focus:outline-pin-gold"
              />

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="rounded-md border border-paper-edge bg-paper-bright px-2.5 py-1.5 font-mono text-xs text-ink focus:outline-2 focus:outline-pin-gold"
                />
                {!form.allDay && (
                  <>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="rounded-md border border-paper-edge bg-paper-bright px-2.5 py-1.5 font-mono text-xs text-ink focus:outline-2 focus:outline-pin-gold"
                    />
                    <span className="font-mono text-xs text-ink-soft">to</span>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="rounded-md border border-paper-edge bg-paper-bright px-2.5 py-1.5 font-mono text-xs text-ink focus:outline-2 focus:outline-pin-gold"
                    />
                  </>
                )}
                <label className="flex items-center gap-1.5 font-mono text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={form.allDay}
                    onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
                  />
                  all day
                </label>
                <label className="flex items-center gap-1.5 font-mono text-xs text-ink-soft" title="Show this event on the project's public page">
                  <input
                    type="checkbox"
                    checked={form.isPublic}
                    onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                  />
                  public
                </label>
              </div>

              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Location / link (optional)"
                maxLength={200}
                className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink focus:outline-2 focus:outline-pin-gold"
              />

              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Notes (optional)"
                rows={3}
                maxLength={2000}
                className="w-full resize-y rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink focus:outline-2 focus:outline-pin-gold"
              />

              {error && <p className="font-mono text-xs text-pin-red">{error}</p>}

              <div className="flex items-center gap-2 border-t border-paper-edge pt-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-md bg-pin-teal px-4 py-2 font-mono text-sm font-medium text-white shadow-[0_2px_0_#0f5e5e] hover:-translate-y-px disabled:opacity-60"
                >
                  {saving ? "Saving…" : form.id ? "Save" : "Create"}
                </button>
                <button
                  onClick={() => setForm(null)}
                  className="rounded-md border border-paper-edge px-4 py-2 font-mono text-sm text-ink-soft hover:border-ink-soft hover:text-ink"
                >
                  Cancel
                </button>
                {form.id && (
                  <button
                    onClick={remove}
                    disabled={saving}
                    className="ml-auto rounded-md px-3 py-2 font-mono text-sm text-pin-red hover:underline disabled:opacity-60"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
