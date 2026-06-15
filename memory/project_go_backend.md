---
name: project-go-backend
description: User wants a separate Go backend hosted on Linode for intense real-time features that would be expensive on Vercel serverless
metadata:
  type: project
---

User wants to start a new project — a separate Go backend hosted on a Linode VPS — for features that are expensive or unsuitable for serverless (e.g. persistent WebSocket connections, live chat, presence tracking).

**Why:** Serverless (Vercel) charges per invocation/duration and can't hold long-lived connections. A small Linode instance would be much cheaper for sustained real-time workloads.

**How to apply:** When building features that need persistent connections, pub/sub, or high-frequency polling, note that these are candidates to eventually move to the Go backend. Start with a polling/serverless MVP now, but architect the API contracts so the Go service can drop in later.

Current placeholder: chat feature uses 4s polling as MVP; WebSocket upgrade would go to the Go backend.
