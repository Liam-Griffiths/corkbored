"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

interface ChatUser {
  id: string;
  githubLogin: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  user: ChatUser;
}

interface Member extends ChatUser {
  online: boolean;
}

interface Props {
  slug: string;
  currentUserId: string;
  transport: "polling" | "websocket";
  wsUrl: string | null;
  fullHeight?: boolean;
}

function startOfDay(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function sameDay(a: string, b: string): boolean {
  return startOfDay(a) === startOfDay(b);
}

// Adaptive poll cadence: fast during active conversation, backing off as the
// chat goes quiet, then stopping entirely (manual refresh) once it's idle for
// an hour — so a forgotten open tab doesn't poll forever.
function pollDelay(idleMs: number): number | null {
  if (idleMs < 60_000) return 3_000; // < 1 min: live
  if (idleMs < 5 * 60_000) return 10_000; // < 5 min
  if (idleMs < 15 * 60_000) return 30_000; // < 15 min
  if (idleMs < 30 * 60_000) return 60_000; // < 30 min
  if (idleMs < 60 * 60_000) return 300_000; // < 60 min
  return null; // idle ≥ 1 hr: stop, require manual refresh
}

function dayLabel(iso: string): string {
  const diffDays = Math.round((startOfDay(new Date().toISOString()) - startOfDay(iso)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const d = new Date(iso);
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

export function ChatPanel({ slug, currentUserId, transport, wsUrl, fullHeight }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; displayName: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pollPaused, setPollPaused] = useState(false);
  const lastActivityRef = useRef<number>(0);
  const lastPresenceRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumePollRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sinceRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const autoScrollRef = useRef(true);
  const prevScrollHeightRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTyping = useCallback((userId: string, displayName: string) => {
    if (userId === currentUserId) return;
    setTypingUsers((prev) => {
      if (prev.some((u) => u.userId === userId)) return prev;
      return [...prev, { userId, displayName }];
    });
    // Auto-clear after 3s of no new typing events
    const existing = typingTimeouts.current.get(userId);
    if (existing) clearTimeout(existing);
    typingTimeouts.current.set(userId, setTimeout(() => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
      typingTimeouts.current.delete(userId);
    }, 3000));
  }, [currentUserId]);

  const applyPayload = useCallback((data: { messages: ChatMessage[]; members: Member[]; hasMore?: boolean }, initial = false) => {
    if (initial) {
      setMessages(data.messages);
      setMembers(data.members);
      setHasMore(data.hasMore ?? false);
      autoScrollRef.current = true;
      if (data.messages.length > 0) {
        sinceRef.current = data.messages[data.messages.length - 1].createdAt;
      }
    } else {
      if (data.messages.length > 0) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const fresh = data.messages.filter((m) => !seen.has(m.id));
          if (fresh.length === 0) return prev;
          // New traffic — reset the backoff so polling stays live.
          lastActivityRef.current = Date.now();
          return [...prev, ...fresh];
        });
        sinceRef.current = data.messages[data.messages.length - 1].createdAt;
      }
      setMembers(data.members);
    }
  }, []);

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const url = initial || !sinceRef.current
        ? `/api/projects/${slug}/chat`
        : `/api/projects/${slug}/chat?since=${encodeURIComponent(sinceRef.current)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      applyPayload(await res.json(), initial);
    } catch {
      // network error — retry on next tick
    }
  }, [slug, applyPayload]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore) return;
    const oldest = messagesRef.current[0]?.createdAt;
    if (!oldest) return;
    setLoadingOlder(true);
    // Preserve scroll position: remember height so we can restore the offset
    // after older messages are prepended (see the layout effect below).
    prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? null;
    try {
      const res = await fetch(`/api/projects/${slug}/chat?before=${encodeURIComponent(oldest)}`);
      if (!res.ok) return;
      const data: { messages: ChatMessage[]; hasMore?: boolean } = await res.json();
      if (data.messages.length > 0) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const older = data.messages.filter((m) => !seen.has(m.id));
          return older.length > 0 ? [...older, ...prev] : prev;
        });
      }
      setHasMore(data.hasMore ?? false);
    } catch {
      // network error — leave hasMore so the user can retry by scrolling
    } finally {
      setLoadingOlder(false);
    }
  }, [slug, hasMore, loadingOlder]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Track whether the user is pinned to the bottom so new messages only
    // auto-scroll when they're already there.
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60) loadOlder();
  }, [loadOlder]);

  const pingPresence = useCallback(async () => {
    await fetch(`/api/projects/${slug}/presence`, { method: "POST" }).catch(() => {});
  }, [slug]);

  // Polling transport — adaptive cadence that backs off as the chat goes quiet
  // and stops once idle, falling back to a manual refresh button.
  useEffect(() => {
    if (transport !== "polling") return;
    let cancelled = false;

    function clearTimer() {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    // Presence keeps you "online"; ping at most every 30s regardless of cadence.
    function maybePing() {
      if (Date.now() - lastPresenceRef.current >= 30_000) {
        lastPresenceRef.current = Date.now();
        pingPresence();
      }
    }

    function schedule() {
      clearTimer();
      if (cancelled) return;
      const delay = document.hidden ? null : pollDelay(Date.now() - lastActivityRef.current);
      if (delay == null) {
        setPollPaused(true); // idle or hidden — stop until the user acts
        return;
      }
      setPollPaused(false);
      pollTimerRef.current = setTimeout(async () => {
        await fetchMessages(false);
        maybePing();
        schedule();
      }, delay);
    }

    function resume() {
      if (cancelled) return;
      lastActivityRef.current = Date.now();
      setPollPaused(false);
      clearTimer();
      fetchMessages(false).finally(() => { maybePing(); schedule(); });
    }
    resumePollRef.current = resume;

    function onVisibility() {
      if (document.hidden) {
        clearTimer();
        setPollPaused(true);
      } else {
        resume();
      }
    }

    // Initial load
    lastActivityRef.current = Date.now();
    fetchMessages(true);
    maybePing();
    schedule();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimer();
      resumePollRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [transport, fetchMessages, pingPresence]);

  // WebSocket transport — connects to Go backend when CHAT_TRANSPORT=websocket
  useEffect(() => {
    if (transport !== "websocket" || !wsUrl) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    async function connect() {
      try {
        const res = await fetch(`/api/chat-token?project=${encodeURIComponent(slug)}`);
        if (!res.ok) return;
        const { token } = await res.json();

        const url = `${wsUrl}/ws/projects/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const frame = JSON.parse(e.data);
            if (frame.type === "init") {
              applyPayload({ messages: frame.messages ?? [], members: frame.members ?? [] }, true);
            } else if (frame.type === "message" && frame.message) {
              setMessages((prev) =>
                prev.some((m) => m.id === frame.message.id) ? prev : [...prev, frame.message],
              );
              // Clear typing indicator for the sender when their message arrives
              setTypingUsers((prev) => prev.filter((u) => u.userId !== frame.message.user.id));
            } else if (frame.type === "typing") {
              handleTyping(frame.userId, frame.displayName);
            } else if (frame.type === "presence") {
              setMembers(frame.members ?? []);
            }
          } catch { /* malformed frame */ }
        };

        ws.onclose = () => {
          // Reconnect after 3s on unexpected close
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch { /* fetch error — retry */ }
    }

    connect();
    return () => {
      ws?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [transport, wsUrl, slug, applyPayload, handleTyping]);

  // Keep a ref of the latest messages for stale-closure-free reads (loadOlder).
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // After messages change, either restore the scroll offset (when older
  // messages were prepended) or stick to the bottom (when at the bottom and a
  // new message arrived). Runs before paint to avoid a visible jump.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (prevScrollHeightRef.current != null) {
      if (el) el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
    } else if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    autoScrollRef.current = true;
    try {
      if (transport === "websocket" && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "message", body }));
        setDraft("");
      } else {
        const res = await fetch(`/api/projects/${slug}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        if (res.ok) {
          const msg = await res.json();
          setMessages((prev) => [...prev, msg]);
          sinceRef.current = msg.createdAt;
          setDraft("");
        }
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
      // Sending is activity — snap polling back to live cadence.
      resumePollRef.current?.();
    }
  }

  function startEdit(msg: ChatMessage) {
    setEditingId(msg.id);
    setEditDraft(msg.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  async function saveEdit(id: string) {
    const body = editDraft.trim();
    if (!body) return;
    const original = messages.find((m) => m.id === id);
    if (original && body === original.body) { cancelEdit(); return; }
    cancelEdit();
    const res = await fetch(`/api/projects/${slug}/chat/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: updated.body } : m)));
    }
  }

  async function deleteMessage(id: string) {
    if (!window.confirm("Delete this message?")) return;
    const res = await fetch(`/api/projects/${slug}/chat/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
  }

  const onlineCount = members.filter((m) => m.online).length;

  return (
    <div className={`flex ${fullHeight ? "h-full" : "h-[600px]"} rounded-sm border border-paper-edge bg-paper shadow-[0_8px_18px_rgba(0,0,0,.18)] overflow-hidden`}>
      {/* Sidebar: members */}
      <aside className="w-48 flex-shrink-0 border-r border-paper-edge bg-board flex flex-col">
        <div className="px-3 py-3 border-b border-paper-edge">
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-ink-soft">
            Members · {onlineCount} online
          </p>
        </div>
        <ul className="flex-1 overflow-y-auto py-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="relative flex-shrink-0">
                {m.avatarUrl ? (
                  <Image
                    src={m.avatarUrl}
                    alt={m.displayName ?? m.githubLogin ?? ""}
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pin-teal text-[0.6rem] font-bold text-white">
                    {(m.displayName ?? m.githubLogin ?? "?")[0].toUpperCase()}
                  </span>
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-board ${
                    m.online ? "bg-green-400" : "bg-ink/20"
                  }`}
                  title={m.online ? "Online" : "Offline"}
                />
              </span>
              <span className="truncate font-mono text-xs text-ink">
                {m.displayName ?? m.githubLogin}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-paper-edge px-4 py-3">
          <p className="font-mono text-xs font-medium text-ink"># team-chat</p>
          <button
            onClick={() => setVisible((v) => !v)}
            className="font-mono text-xs text-ink-soft hover:text-ink"
          >
            {visible ? "hide" : "show"}
          </button>
        </div>

        {visible && (
          <>
            {/* Messages */}
            <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {hasMore && (
                <p className="py-2 text-center font-mono text-[0.65rem] text-ink-soft">
                  {loadingOlder ? "Loading earlier messages…" : "Scroll up for earlier messages"}
                </p>
              )}
              {messages.length === 0 && (
                <p className="py-8 text-center font-mono text-xs text-ink-soft">
                  No messages yet. Say hello 👋
                </p>
              )}
              {messages.map((msg, i) => {
                const prev = messages[i - 1];
                const newDay = !prev || !sameDay(prev.createdAt, msg.createdAt);
                const grouped = !newDay && prev?.user.id === msg.user.id;
                const isOwn = msg.user.id === currentUserId;
                return (
                  <div key={msg.id}>
                    {newDay && (
                      <div className="flex items-center gap-3 py-1.5">
                        <span className="h-px flex-1 bg-paper-edge" />
                        <span className="font-mono text-[0.6rem] uppercase tracking-widest text-ink-soft">
                          {dayLabel(msg.createdAt)}
                        </span>
                        <span className="h-px flex-1 bg-paper-edge" />
                      </div>
                    )}
                  <div className={grouped ? "pl-8" : "flex gap-2.5"}>
                    {!grouped && (
                      <span className="flex-shrink-0 mt-0.5">
                        {msg.user.avatarUrl ? (
                          <Image
                            src={msg.user.avatarUrl}
                            alt={msg.user.displayName ?? ""}
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-full"
                          />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pin-teal text-xs font-bold text-white">
                            {(msg.user.displayName ?? msg.user.githubLogin ?? "?")[0].toUpperCase()}
                          </span>
                        )}
                      </span>
                    )}
                    <div className={grouped ? "" : "flex-1 min-w-0"}>
                      {!grouped && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className={`font-mono text-xs font-semibold ${isOwn ? "text-pin-teal" : "text-ink"}`}>
                            {msg.user.displayName ?? msg.user.githubLogin}
                          </span>
                          <span className="font-mono text-[0.65rem] text-ink-soft">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      )}
                      {editingId === msg.id ? (
                        <div className="mt-0.5">
                          <textarea
                            value={editDraft}
                            autoFocus
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(msg.id); }
                              if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                            }}
                            rows={2}
                            maxLength={2000}
                            className="w-full resize-none rounded-md border border-paper-edge bg-paper-bright px-2.5 py-1.5 font-sans text-sm text-ink focus:outline-2 focus:outline-pin-gold"
                          />
                          <div className="mt-1 flex gap-2 font-mono text-[0.65rem] text-ink-soft">
                            <button onClick={() => saveEdit(msg.id)} className="text-pin-teal hover:underline">save</button>
                            <button onClick={cancelEdit} className="hover:text-ink">cancel</button>
                            <span>· ↵ to save, esc to cancel</span>
                          </div>
                        </div>
                      ) : (
                        <div className="group/msg relative">
                          <p className="text-sm text-ink leading-relaxed break-words">{msg.body}</p>
                          {isOwn && (
                            <div className="absolute -top-1 right-0 hidden gap-1.5 rounded-sm border border-paper-edge bg-paper px-1.5 py-0.5 font-mono text-[0.6rem] text-ink-soft shadow-sm group-hover/msg:flex">
                              <button onClick={() => startEdit(msg)} className="hover:text-ink">edit</button>
                              <button onClick={() => deleteMessage(msg.id)} className="hover:text-pin-red">delete</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="px-4 pb-1 font-mono text-[0.68rem] text-ink-soft italic">
                {typingUsers.map((u) => u.displayName).join(", ")}
                {" "}{typingUsers.length === 1 ? "is" : "are"} typing…
              </div>
            )}

            {/* Polling paused — chat went idle (or tab hidden); offer manual refresh */}
            {transport === "polling" && pollPaused && (
              <div className="flex items-center justify-center gap-2 border-t border-paper-edge bg-board px-4 py-1.5 font-mono text-[0.68rem] text-ink-soft">
                <span>Live updates paused</span>
                <button
                  onClick={() => resumePollRef.current?.()}
                  className="rounded-sm border border-paper-edge px-2 py-0.5 text-ink hover:border-ink-soft"
                >
                  ↻ refresh
                </button>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-paper-edge px-4 py-3">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    lastActivityRef.current = Date.now();
                    if (transport === "websocket" && wsRef.current?.readyState === WebSocket.OPEN) {
                      if (typingDebounce.current) clearTimeout(typingDebounce.current);
                      typingDebounce.current = setTimeout(() => {
                        wsRef.current?.send(JSON.stringify({ type: "typing" }));
                      }, 300);
                    }
                  }}
                  onFocus={() => resumePollRef.current?.()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Message team… (↵ to send, ⇧↵ for newline)"
                  rows={1}
                  maxLength={2000}
                  className="flex-1 resize-none rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
                />
                <button
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  className="rounded-md bg-pin-teal px-4 py-2 font-mono text-sm font-medium text-white shadow-[0_2px_0_#0f5e5e] hover:-translate-y-px disabled:opacity-40 disabled:translate-y-0"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
