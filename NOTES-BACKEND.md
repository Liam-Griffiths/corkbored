# Go backend notes

> Referenced from NOTES.md. Source lives in `backend/`.

## Overview

Separate Go 1.23 service (`corkbored/backend`) hosted on a Linode VPS. Handles features that are expensive or impossible on Vercel serverless — starting with WebSocket chat. Shares the same Neon Postgres database as the Next.js app.

---

## Running locally

```bash
cp backend/.env.example backend/.env   # fill in DATABASE_URL + AUTH_SECRET
cd backend
make dev                               # go run ./cmd/server — listens on :8080
```

Point Next.js at it:
```
CHAT_TRANSPORT=websocket
CHAT_WS_URL=ws://localhost:8080
```

---

## Structure

```
backend/
  cmd/server/main.go          HTTP server entry point
  internal/auth/jwt.go        HS256 token verification (shared AUTH_SECRET)
  internal/chat/
    hub.go                    Per-project WebSocket connection registry
    client.go                 Read/write pumps, ping/pong keepalive
    handler.go                Upgrade, auth, initial payload, broadcast
  internal/db/
    db.go                     pgxpool connection
    queries.go                ChatMessage + Membership queries
  .env.example
  Makefile
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check — returns `{"ok":true}` |
| `WS` | `/ws/projects/{slug}` | WebSocket chat for a project |

## Auth flow

1. Client fetches `GET /api/chat-token?project={slug}` from **Next.js**.
2. Next.js verifies the session, checks active membership, and signs a 5-minute HS256 JWT:
   `{ sub: userId, projectId, iat, exp, jti }` — using `AUTH_SECRET`.
3. Client opens the WebSocket with `?token=<jwt>`.
4. Go verifies the JWT signature, resolves the slug → project ID, re-checks membership in DB.

Token expiry is intentional — if a user's membership is revoked, their next reconnect will fail auth.

## WebSocket protocol

**Server → client frames:**

```jsonc
// On connect: full initial state
{ "type": "init", "messages": [...], "members": [...] }

// New message broadcast
{ "type": "message", "message": { "id": "...", "body": "...", "createdAt": "...", "user": {...} } }

// Presence update (future — not yet sent automatically)
{ "type": "presence", "members": [...] }
```

**Client → server frames:**

```jsonc
// Send a chat message
{ "type": "message", "body": "hello" }
```

Messages over 2000 chars are silently dropped.

## Environment variables

| Var | Description |
|-----|-------------|
| `DATABASE_URL` | Same Neon connection string as Next.js |
| `AUTH_SECRET` | Same value as Next.js `AUTH_SECRET` — used to verify JWTs |
| `PORT` | Defaults to `8080` |
| `ALLOWED_ORIGIN` | Next.js app origin for CORS, e.g. `https://corkbored.com` |

## Pending migrations before enabling WebSocket chat

Run these against the production DB before setting `CHAT_TRANSPORT=websocket`:
```bash
npx prisma migrate deploy   # adds ChatMessage table + presenceAt on Membership
```

## Deploying to Linode

1. Provision an Ubuntu 24.04 Nanode (1 GB RAM is enough to start).
2. Install Go 1.23+: `sudo snap install go --classic`
3. Clone the repo, `cd backend`, `make build` → produces `bin/server`.
4. Copy `.env.example` → `.env`, fill in `DATABASE_URL`, `AUTH_SECRET`, `ALLOWED_ORIGIN`.
5. Run behind systemd or `screen`; put Caddy/nginx in front for TLS.
6. Set `CHAT_WS_URL=wss://backend.corkbored.com` in Vercel env vars.
7. Set `CHAT_TRANSPORT=websocket` in Vercel to cut over from polling.

## Future features for this backend

- Presence broadcast (push `type: presence` frame on connect/disconnect)
- Rate limiting per user (token bucket, in-memory per hub)
- Typing indicators (`type: typing` frame, no persistence)
- Read receipts
- Any other high-frequency / persistent-connection feature
