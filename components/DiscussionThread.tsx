"use client";

import { useState } from "react";

type Author = {
  id: string;
  displayName: string | null;
  githubLogin: string | null;
};

type Message = {
  id: string;
  body: string;
  createdAt: Date | string;
  author: Author;
  replies: Array<Omit<Message, "replies">>;
};

function initial(a: Author) {
  return (a.displayName ?? a.githubLogin ?? "?")[0].toUpperCase();
}

function Bubble({
  message,
  currentUserId,
  isReply,
  projectSlug,
  onReply,
}: {
  message: Omit<Message, "replies"> & { replies?: Message["replies"] };
  currentUserId: string;
  isReply: boolean;
  projectSlug: string;
  onReply?: (parentId: string) => void;
}) {
  return (
    <div className={`flex gap-2.5 ${isReply ? "ml-8" : ""}`}>
      <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-pin-gold text-xs font-semibold text-ink">
        {initial(message.author)}
      </span>
      <div className="flex-1">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-medium text-sm text-ink">
            {message.author.displayName ?? message.author.githubLogin}
          </span>
          <span className="font-mono text-xs text-ink-soft">
            {new Date(message.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="rounded-lg border border-paper-edge bg-paper-bright px-3 py-2 text-sm text-ink whitespace-pre-wrap break-words">
          {message.body}
        </div>
        {!isReply && onReply && (
          <button
            onClick={() => onReply(message.id)}
            className="mt-1 font-mono text-xs text-ink-soft hover:text-ink"
          >
            Reply
          </button>
        )}
      </div>
    </div>
  );
}

export function DiscussionThread({
  initialMessages,
  currentUserId,
  projectSlug,
}: {
  initialMessages: Message[];
  currentUserId: string;
  projectSlug: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), parentId: replyTo ?? undefined }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to post");
        return;
      }
      const msg = await res.json() as Omit<Message, "replies">;
      if (replyTo) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyTo
              ? { ...m, replies: [...(m.replies ?? []), { ...msg, replies: [] }] }
              : m,
          ),
        );
      } else {
        setMessages((prev) => [{ ...msg, replies: [] }, ...prev]);
      }
      setBody("");
      setReplyTo(null);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div>
      {/* Composer */}
      <div className="mb-6 rounded-lg border border-paper-edge bg-paper-bright p-3">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-xs text-ink-soft">
              Replying to thread
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="font-mono text-xs text-ink-soft underline hover:text-ink"
            >
              cancel
            </button>
          </div>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
          }}
          placeholder={replyTo ? "Write a reply…" : "Start a thread…"}
          rows={3}
          maxLength={5000}
          className="w-full rounded-md border border-paper-edge bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold resize-y"
        />
        {error && <p className="mt-1 font-mono text-xs text-pin-red">{error}</p>}
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-xs text-ink-soft">⌘↵ to post</span>
          <button
            onClick={() => void submit()}
            disabled={posting || !body.trim()}
            className="rounded-md bg-pin-teal px-4 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#0e5a47] hover:-translate-y-px disabled:opacity-50"
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {/* Thread list */}
      {messages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-paper-edge p-8 text-center font-mono text-sm text-ink-soft">
          No threads yet. Start the conversation.
        </p>
      ) : (
        <div className="space-y-6">
          {messages.map((msg) => (
            <div key={msg.id}>
              <Bubble
                message={msg}
                currentUserId={currentUserId}
                isReply={false}
                projectSlug={projectSlug}
                onReply={setReplyTo}
              />
              {msg.replies?.map((reply) => (
                <div key={reply.id} className="mt-3">
                  <Bubble
                    message={reply}
                    currentUserId={currentUserId}
                    isReply={true}
                    projectSlug={projectSlug}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
