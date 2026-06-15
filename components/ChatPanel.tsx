"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
}

export function ChatPanel({ slug, currentUserId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [visible, setVisible] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sinceRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const url = initial || !sinceRef.current
        ? `/api/projects/${slug}/chat`
        : `/api/projects/${slug}/chat?since=${encodeURIComponent(sinceRef.current)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      if (initial) {
        setMessages(data.messages);
        setMembers(data.members);
        if (data.messages.length > 0) {
          sinceRef.current = data.messages[data.messages.length - 1].createdAt;
        }
      } else {
        if (data.messages.length > 0) {
          setMessages((prev) => [...prev, ...data.messages]);
          sinceRef.current = data.messages[data.messages.length - 1].createdAt;
        }
        setMembers(data.members);
      }
    } catch {
      // network error — polling will retry
    }
  }, [slug]);

  const pingPresence = useCallback(async () => {
    await fetch(`/api/projects/${slug}/presence`, { method: "POST" }).catch(() => {});
  }, [slug]);

  // Initial load + polling
  useEffect(() => {
    fetchMessages(true);
    pingPresence();

    const msgInterval = setInterval(() => fetchMessages(false), 4000);
    const presenceInterval = setInterval(pingPresence, 30_000);

    return () => {
      clearInterval(msgInterval);
      clearInterval(presenceInterval);
    };
  }, [fetchMessages, pingPresence]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
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
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const onlineCount = members.filter((m) => m.online).length;

  return (
    <div className="flex h-[600px] rounded-sm border border-paper-edge bg-paper shadow-[0_8px_18px_rgba(0,0,0,.18)] overflow-hidden">
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
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <p className="py-8 text-center font-mono text-xs text-ink-soft">
                  No messages yet. Say hello 👋
                </p>
              )}
              {messages.map((msg, i) => {
                const prev = messages[i - 1];
                const grouped = prev?.user.id === msg.user.id;
                const isOwn = msg.user.id === currentUserId;
                return (
                  <div key={msg.id} className={grouped ? "pl-8" : "flex gap-2.5"}>
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
                      <p className="text-sm text-ink leading-relaxed break-words">{msg.body}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-paper-edge px-4 py-3">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
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
