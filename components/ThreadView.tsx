"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "./Markdown";

interface Author {
  id: string;
  displayName: string | null;
  githubLogin: string | null;
}

interface Post {
  id: string;
  title: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  pinnedAt: string | null;
  author: Author;
  voteCount: number;
  voted: boolean;
}

function authorName(a: Author) {
  return a.displayName ?? a.githubLogin ?? "Someone";
}

function initial(a: Author) {
  return authorName(a)[0].toUpperCase();
}

export function ThreadView({
  slug,
  currentUserId,
  isManager,
  thread: initialThread,
  initialReplies,
}: {
  slug: string;
  currentUserId: string;
  isManager: boolean;
  thread: Post;
  initialReplies: Post[];
}) {
  const router = useRouter();
  const [thread, setThread] = useState<Post>(initialThread);
  const [replies, setReplies] = useState<Post[]>(initialReplies);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const replyRef = useRef<HTMLTextAreaElement>(null);

  function patchPost(id: string, patch: Partial<Post>) {
    setThread((t) => (t.id === id ? { ...t, ...patch } : t));
    setReplies((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function toggleVote(post: Post) {
    // optimistic
    patchPost(post.id, { voted: !post.voted, voteCount: post.voteCount + (post.voted ? -1 : 1) });
    const res = await fetch(`/api/projects/${slug}/messages/${post.id}/vote`, { method: "POST" });
    if (res.ok) {
      const { count, voted } = await res.json();
      patchPost(post.id, { voted, voteCount: count });
    } else {
      patchPost(post.id, { voted: post.voted, voteCount: post.voteCount }); // revert
    }
  }

  async function submitReply() {
    const body = reply.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/projects/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentId: thread.id }),
      });
      if (res.ok) {
        const msg = await res.json();
        setReplies((rs) => [
          ...rs,
          {
            id: msg.id,
            title: null,
            body: msg.body,
            createdAt: msg.createdAt,
            editedAt: null,
            pinnedAt: null,
            author: msg.author,
            voteCount: 0,
            voted: false,
          },
        ]);
        setReply("");
      }
    } finally {
      setPosting(false);
    }
  }

  function startEdit(post: Post) {
    setEditingId(post.id);
    setEditTitle(post.title ?? "");
    setEditBody(post.body);
  }

  async function saveEdit(post: Post) {
    const body = editBody.trim();
    if (!body) return;
    const isRoot = post.id === thread.id;
    const res = await fetch(`/api/projects/${slug}/messages/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isRoot ? { title: editTitle.trim(), body } : { body }),
    });
    if (res.ok) {
      const updated = await res.json();
      patchPost(post.id, {
        body: updated.body,
        title: isRoot ? updated.title : null,
        editedAt: updated.editedAt,
      });
      setEditingId(null);
    }
  }

  async function deletePost(post: Post) {
    const isRoot = post.id === thread.id;
    if (!window.confirm(isRoot ? "Delete this thread?" : "Delete this reply?")) return;
    const res = await fetch(`/api/projects/${slug}/messages/${post.id}`, { method: "DELETE" });
    if (res.ok) {
      if (isRoot) router.push(`/p/${slug}/discussion`);
      else setReplies((rs) => rs.filter((r) => r.id !== post.id));
    }
  }

  async function togglePin() {
    const res = await fetch(`/api/projects/${slug}/messages/${thread.id}/pin`, { method: "POST" });
    if (res.ok) {
      const { pinnedAt } = await res.json();
      setThread((t) => ({ ...t, pinnedAt }));
    }
  }

  function quote(post: Post) {
    const quoted = `> **${authorName(post.author)}**:\n${post.body.split("\n").map((l) => `> ${l}`).join("\n")}\n\n`;
    setReply((prev) => (prev ? `${prev}\n${quoted}` : quoted));
    replyRef.current?.focus();
  }

  function renderPost(post: Post, isRoot: boolean) {
    const isOwn = post.author.id === currentUserId;
    const editing = editingId === post.id;
    return (
      <div className={`flex gap-2.5 ${isRoot ? "" : "border-t border-paper-edge pt-4"}`}>
        {/* Vote rail */}
        <button
          onClick={() => void toggleVote(post)}
          className={`flex h-fit flex-col items-center rounded-md border px-1.5 py-1 font-mono ${
            post.voted ? "border-pin-teal text-pin-teal" : "border-paper-edge text-ink-soft hover:text-ink"
          }`}
          title={post.voted ? "Remove upvote" : "Upvote"}
        >
          <span className="text-sm leading-none">▲</span>
          <span className="text-xs">{post.voteCount}</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-pin-gold text-[0.7rem] font-semibold text-ink">
              {initial(post.author)}
            </span>
            <span className="text-sm font-medium text-ink">{authorName(post.author)}</span>
            <span className="font-mono text-[0.7rem] text-ink-soft">
              {new Date(post.createdAt).toLocaleString()}
              {post.editedAt && " · edited"}
            </span>
            {isRoot && post.pinnedAt && (
              <span className="rounded-sm bg-pin-gold/25 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wide text-ink">
                📌 pinned
              </span>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              {isRoot && (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={200}
                  className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-1.5 font-display text-sm font-semibold text-ink focus:outline-2 focus:outline-pin-gold"
                />
              )}
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={4}
                maxLength={5000}
                className="w-full resize-y rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink focus:outline-2 focus:outline-pin-gold"
              />
              <div className="flex gap-2 font-mono text-xs">
                <button onClick={() => void saveEdit(post)} className="text-pin-teal hover:underline">save</button>
                <button onClick={() => setEditingId(null)} className="text-ink-soft hover:text-ink">cancel</button>
              </div>
            </div>
          ) : (
            <>
              {isRoot && <h2 className="mb-1 font-display text-lg font-bold text-ink">{post.title}</h2>}
              <Markdown>{post.body}</Markdown>
            </>
          )}

          {!editing && (
            <div className="mt-1.5 flex flex-wrap gap-3 font-mono text-[0.7rem] text-ink-soft">
              <button onClick={() => quote(post)} className="hover:text-ink">quote</button>
              {isOwn && <button onClick={() => startEdit(post)} className="hover:text-ink">edit</button>}
              {(isOwn || isManager) && (
                <button onClick={() => void deletePost(post)} className="hover:text-pin-red">delete</button>
              )}
              {isRoot && isManager && (
                <button onClick={() => void togglePin()} className="hover:text-ink">
                  {post.pinnedAt ? "unpin" : "pin"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border border-paper-edge bg-paper p-4">
        {renderPost(thread, true)}
      </div>

      <div className="mt-4 space-y-4 rounded-lg border border-paper-edge bg-paper p-4">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </p>
        {replies.map((r) => (
          <div key={r.id}>{renderPost(r, false)}</div>
        ))}

        {/* Reply composer */}
        <div className="border-t border-paper-edge pt-4">
          <textarea
            ref={replyRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submitReply(); }}
            placeholder="Write a reply… (markdown supported)"
            rows={3}
            maxLength={5000}
            className="w-full resize-y rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-xs text-ink-soft">⌘↵ to reply · markdown</span>
            <button
              onClick={() => void submitReply()}
              disabled={posting || !reply.trim()}
              className="rounded-md bg-pin-teal px-4 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#0e5a47] hover:-translate-y-px disabled:opacity-50"
            >
              {posting ? "Posting…" : "Reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
