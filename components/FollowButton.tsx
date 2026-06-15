"use client";

import { useState } from "react";

export function FollowButton({
  endpoint,
  initialFollowing,
  initialCount,
  label = "Follow",
  followingLabel = "Following",
}: {
  endpoint: string;
  initialFollowing: boolean;
  initialCount: number;
  label?: string;
  followingLabel?: string;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      const res = await fetch(endpoint, { method: following ? "DELETE" : "POST" });
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following);
        setCount(data.count);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`rounded-md px-4 py-1.5 font-mono text-xs transition-all disabled:opacity-50 ${
        following
          ? "border border-paper-edge text-ink-soft hover:border-pin-red hover:text-pin-red"
          : "bg-pin-red text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px"
      }`}
    >
      {following ? followingLabel : label}
      {count > 0 && <span className="ml-1.5 opacity-60">{count}</span>}
    </button>
  );
}
