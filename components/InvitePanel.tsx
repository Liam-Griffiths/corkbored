"use client";

import { useEffect, useRef, useState } from "react";

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  url: string;
  expiresAt: string;
};

type Created = { invite: Invite; emailSent: boolean };

export function InvitePanel({
  slug,
  initialInvites,
}: {
  slug: string;
  initialInvites: Invite[];
}) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/projects/${slug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not send invite");
        return;
      }
      setInvites((prev) => [
        data.invite,
        ...prev.filter((i) => i.email !== data.invite.email),
      ]);
      setEmail("");
      // Always surface the link in a modal — it's the manual-share fallback when
      // email is off, and a useful confirmation when it did send.
      setCreated({ invite: data.invite, emailSent: data.emailSent });
    } catch {
      setError("Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/invites/${id}`, { method: "DELETE" });
    if (res.ok) setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  async function copy(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  }

  // Close the share modal on Escape.
  useEffect(() => {
    if (!created) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCreated(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [created]);

  return (
    <div className="mt-8 rounded-lg border border-paper-edge bg-paper p-4">
      <h2 className="font-display text-sm font-bold text-ink">Invite someone</h2>
      <p className="mt-0.5 font-mono text-xs text-ink-soft">
        We&apos;ll email a join link. They sign in with GitHub (account created if needed).
      </p>

      <form onSubmit={sendInvite} className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className="min-w-0 flex-1 rounded-md border border-paper-edge bg-white px-3 py-1.5 font-mono text-sm text-ink placeholder:text-ink-soft/60 focus:border-ink-soft focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-paper-edge bg-white px-2 py-1.5 font-mono text-xs text-ink focus:border-ink-soft focus:outline-none"
        >
          <option value="member">member</option>
          <option value="maintainer">maintainer</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-pin-red px-4 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#7c2d14] transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </form>

      {error && <p className="mt-2 font-mono text-xs text-pin-red">{error}</p>}

      {invites.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
            Pending invites
          </p>
          {invites.map((i) => (
            <div
              key={i.id}
              className="flex items-center gap-2 rounded-md border border-paper-edge px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-ink">{i.email}</p>
                <p className="font-mono text-[0.6rem] text-ink-soft">
                  {i.role} · {i.status}
                </p>
              </div>
              <button
                onClick={() => copy(i.url, i.id)}
                className="rounded border border-paper-edge px-2 py-1 font-mono text-[0.65rem] text-ink-soft hover:border-ink-soft hover:text-ink"
              >
                {copied === i.id ? "Copied!" : "Copy link"}
              </button>
              <button
                onClick={() => revoke(i.id)}
                className="rounded border border-paper-edge px-2 py-1 font-mono text-[0.65rem] text-ink-soft hover:border-pin-red hover:text-pin-red"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {created && (
        <ShareModal
          created={created}
          copied={copied === created.invite.id}
          onCopy={() => copy(created.invite.url, created.invite.id)}
          onClose={() => setCreated(null)}
        />
      )}
    </div>
  );
}

function ShareModal({
  created,
  copied,
  onCopy,
  onClose,
}: {
  created: Created;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { invite, emailSent } = created;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-md rounded-sm bg-paper p-5 shadow-[0_24px_60px_rgba(0,0,0,.35)]">
        <span
          className="absolute -top-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff8a72,#c94e2a_60%,#7c2d14)] shadow-[0_3px_5px_rgba(0,0,0,.4)]"
          aria-hidden="true"
        />
        <div className="flex items-start justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">
            {emailSent ? "Invite sent" : "Share this invite link"}
          </h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="mt-1 font-mono text-xs text-ink-soft">
          {emailSent ? (
            <>We emailed <span className="text-ink">{invite.email}</span> a join link. You can also share it directly:</>
          ) : (
            <>Email delivery is off, so we couldn&apos;t send to <span className="text-ink">{invite.email}</span>. Copy this link and send it to them yourself — it works the same way.</>
          )}
        </p>

        <div className="mt-3 flex items-center gap-2 rounded-md border border-paper-edge bg-white p-2">
          <input
            readOnly
            value={invite.url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink focus:outline-none"
          />
          <button
            onClick={onCopy}
            className="flex-shrink-0 rounded bg-pin-red px-3 py-1 font-mono text-[0.65rem] text-white shadow-[0_2px_0_#7c2d14] transition-transform hover:-translate-y-px"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <p className="mt-3 font-mono text-[0.6rem] text-ink-soft">
          Anyone with this link can join as {invite.role}. It expires in 14 days — revoke it from the pending list if needed.
        </p>
      </div>
    </div>
  );
}
