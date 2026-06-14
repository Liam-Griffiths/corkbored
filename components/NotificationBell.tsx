"use client";

import { useState, useRef, useEffect } from "react";

type Notification = {
  id: string;
  kind: string;
  readAt: Date | null;
  createdAt: Date;
  projectId: string | null;
  applicationId: string | null;
  announcementId: string | null;
};

const KIND_TEXT: Record<string, string> = {
  application_received: "New application received",
  application_decided: "Your application was reviewed",
  invite_accepted: "Invite accepted",
  new_thread: "New project announcement",
};

export function NotificationBell({
  notifications,
  markAllReadAction,
}: {
  notifications: Notification[];
  markAllReadAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [localNotifs, setLocalNotifs] = useState(notifications);
  const ref = useRef<HTMLDivElement>(null);

  const unread = localNotifs.filter((n) => !n.readAt).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      setLocalNotifs((ns) => ns.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })));
      await markAllReadAction();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-ink/8 hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pin-red px-1 font-mono text-[0.6rem] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-paper-edge bg-paper shadow-[0_14px_30px_rgba(0,0,0,.18)] z-50">
          <div className="border-b border-paper-edge px-4 py-2.5">
            <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-paper-edge">
            {localNotifs.length === 0 ? (
              <p className="px-4 py-6 text-center font-mono text-sm text-ink-soft">Nothing yet.</p>
            ) : (
              localNotifs.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 text-sm ${n.readAt ? "opacity-60" : ""}`}
                >
                  <p className={`font-medium text-ink ${!n.readAt ? "font-semibold" : ""}`}>
                    {KIND_TEXT[n.kind] ?? n.kind}
                  </p>
                  <p className="font-mono text-xs text-ink-soft mt-0.5">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
