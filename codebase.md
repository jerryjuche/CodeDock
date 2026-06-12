# CodeDock Codebase Index

## Project Structure

The CodeDock repository is organized as a **monorepo** with three main application components:

```
/home/gamp/Desktop/CodeDock/
├── Backend Server (Go)              main.go, go.mod, Dockerfile
├── Frontend Web App (Next.js)        codedock-web/
├── VS Code Extension (TypeScript)    extension/
├── Database Migrations               migration/
├── Infrastructure & Scripts          scripts/, fly.toml, .github/workflows/
├── Test Dashboard                    codedock-test-dashboard/
└── Configuration Files               package.json, go.mod, .env files
```

---

## Technologies & Frameworks

| Layer              | Technology Stack                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Backend**        | Go 1.25.0, `net/http`, `gorilla/websocket`, `golang-jwt/jwt/v5`, `lib/pq`, `posthog-go`, Sentry error tracking           |
| **Database**       | PostgreSQL 16, pgcrypto extension                                                                                        |
| **Frontend**       | Next.js 16.2.6 (App Router), React 19.2.5, TypeScript 5.9.3, Tailwind CSS 3.4, TanStack Query 5, Sonner, Lucide, PostHog |
| **Extension**      | VS Code Extension API (≥1.85.0), TypeScript 5.9.3, esbuild, Yjs (CRDT sync), `ws` (WebSocket client), PostHog telemetry  |
| **Real-time Sync** | Yjs / CRDT over WebSocket (document sync, cursor presence, chat)                                                         |
| **Auth**           | JWT tokens (golang-jwt/v5), bcrypt password hashing (golang.org/x/crypto)                                                |
| **Hosting**        | Backend: Fly.io (fra region), Frontend: Vercel, DB: Supabase/self-hosted PostgreSQL                                      |
| **Deployment**     | Docker (multi-stage alpine), GitHub Actions → Fly.io, Vercel auto-deploy                                                 |
| **Testing**        | Go test (backend), Vitest (frontend), esbuild (extension)                                                                |

---

## Main Entry Points

### Backend

- **main.go** — Server initialization, route definitions, database connection
  - Initializes Sentry monitoring
  - Sets up HTTP mux with CORS (origin whitelist, no wildcards)
  - Configures rate limiters for auth (10/min) and WebSocket (100/min) endpoints
  - Connects to PostgreSQL database

### Frontend

- **codedock-web/app/page.tsx** — Landing page with marketing content, auto-redirect to dashboard if authenticated
- **codedock-web/app/layout.tsx** — Root layout (Providers, Vercel Analytics, SpeedInsights)
- **codedock-web/app/(app)/dashboard/page.tsx** — Workspace/Room dashboard page
- **codedock-web/app/(app)/rooms/[roomId]/page.tsx** — Specific Room details page (client-side rendered via room-details-page component)
- **codedock-web/app/(app)/rooms/[roomId]/review/[userId]/page.tsx** — Side-by-side code review for specific teammate's edits
- **codedock-web/app/(app)/rooms/new/page.tsx** — Create new room form page
- **codedock-web/app/(app)/activity/page.tsx** — Session activity timeline logs page
- **codedock-web/app/(app)/join/page.tsx** — Resolving and joining rooms via code
- **codedock-web/package.json** — Scripts: `dev` (port 3000), `build`, `test` (vitest), `lint`

### Extension

- **extension/src/extension.ts** — Extension activation/deactivation, command registration, VS Code URI scheme callback handlers (`vscode://jerryjuche.codedock/...`)
- **extension/package.json** — v3.2.0, defines 9 commands, 6 config settings, engine ≥1.85.0

### Test Dashboard

- **codedock-test-dashboard/backend/main.go** — Isolated test server
- **codedock-test-dashboard/frontend/** — Vite + React test UI

---

## Key Components & Services

### Backend Services ([internal/services/](internal/services/))

| Service           | File            | Purpose                                                                                                          |
| ----------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| **RoomService**   | `rooms.go`      | Room CRUD, GetRoomDetails, GetRoomPresence, ToggleActivation, MarkLocalWorkspaceBound, slug/join-code generation |
| **InviteService** | `invite.go`     | Generate (5-min expiry, auto-revoke previous), Validate, List, Revoke                                            |
| **LaunchService** | `launch.go`     | GenerateLaunchToken (2-min TTL), ExchangeLaunchToken, hub notification                                           |
| **SnapshotStore** | `snapshots.go`  | Persist Yjs document state (CRDT snapshots per file per room)                                                    |
| **ActivityStore** | `activities.go` | Track user activities (edits, joins, leaves) with metadata                                                       |
| **CreateUser**    | `users.go`      | Database user record insertion & bcrypt password hashing                                                         |

### Backend Handlers ([internal/handlers/](internal/handlers/))

| Handler           | File         | Endpoints                                                                                                                                                                                                                    |
| ----------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AuthHandler**   | `auth.go`    | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/exchange` (deprecated)                                                                                                                                |
| **RoomHandler**   | `rooms.go`   | `GET/POST /rooms`, `/rooms/{roomId}`, `/rooms/{roomId}/details`, `/rooms/{roomId}/presence`, `/rooms/{roomId}/activation/toggle`, `/rooms/{roomId}/source/local/bind`, `/rooms/{roomId}/leave`, `/rooms/{roomId}/activities` |
| **InviteHandler** | `invites.go` | `/join-code/resolve`, `/rooms/{roomId}/invites`, `/rooms/{roomId}/invites/{inviteId}/revoke`                                                                                                                                 |
| **LaunchHandler** | `launch.go`  | `/rooms/{roomId}/open-in-vscode`, `/rooms/{roomId}/open-ide`, `/vscode/launch/exchange`                                                                                                                                      |
| **WSHandler**     | `ws.go`      | `GET /ws` — WebSocket gateway (origin validation, rate limited, hub registration)                                                                                                                                            |
| **HealthHandler** | `health.go`  | `GET /health` (liveness), `GET /ready` (readiness with DB ping)                                                                                                                                                              |

### Backend Core Modules ([internal/](internal/))

- **[internal/auth/](internal/auth/)** — JWT middleware (`RequireAuth`), token generation/validation (`jwt.go`), middleware integration (`middleware.go`)
- **[internal/hub/](internal/hub/)** — WebSocket connection hub, message relay, CRDT sync coordination (`hub.go`, `client.go`, `message.go`)
- **[internal/middleware/](internal/middleware/)** — Token-bucket rate limiting (`rate.go`)
- **[internal/observability/](internal/observability/)** — Sentry integration, error tracking (`sentry.go`)

### Frontend Components ([codedock-web/components/](codedock-web/components/))

| Component Group  | Key Files                                                                 | Purpose                                                                                   |
| ---------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **app-shell**    | `app-shell.tsx`                                                           | App chrome wrapper (header + content area)                                                |
| **auth/**        | `auth-guard.tsx`, `auth-shell.tsx`, `login-form.tsx`, `register-form.tsx` | Login/register forms, route protection, auth layout                                       |
| **dashboard/**   | `room-list.tsx`, `room-card.tsx`, `join-code-form.tsx`                    | Room listing, preview cards, quick join                                                   |
| **rooms/**       | 17 components                                                             | Room details, invites, presence, launch, review, CRUD, activity timeline                  |
| **layout/**      | `app-header.tsx`                                                          | Navigation header with user menu                                                          |
| **marketing/**   | `marketing-shell.tsx`                                                     | Landing page layout with hero background                                                  |
| **brand/**       | `logo.tsx`                                                                | CodeDock SVG logo                                                                         |
| **backgrounds/** | `silk-hero.tsx`                                                           | Animated silk gradient hero background                                                    |
| **fancy/**       | `text/text-rotate.tsx`                                                    | Rotating text animation                                                                   |
| **reactbits/**   | `silk.tsx`                                                                | WebGL silk effect rendering                                                               |
| **ui/**          | 14 components                                                             | Buttons, inputs, cards, badges, skeletons, spinners, diff views, toasts, error boundaries |

### Frontend Hooks ([codedock-web/hooks/](codedock-web/hooks/))

| Hook                        | Purpose                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| `useAuth()`                 | Authentication state, login/logout, token management (localStorage) |
| `useRoom(roomId)`           | Fetch/update single room details                                    |
| `useRooms()`                | Fetch user's room list                                              |
| `useRoomDetails(roomId)`    | Extended room metadata, source state, membership                    |
| `useRoomSync(roomId)`       | WebSocket sync state, MsgTypeRoomUpdate listener                    |
| `useRoomPresence(roomId)`   | Track online users, connection status                               |
| `useRoomActivities(roomId)` | Fetch activity log for audit/presence                               |
| `useInvites(roomId)`        | List, create, revoke room invites                                   |
| `useJoinCode()`             | Resolve join codes to rooms                                         |
| `useLaunch(roomId)`         | Generate and exchange launch tokens                                 |
| `useReviewFiles(roomId)`    | File diff generation and review UI state                            |
| `useErrorHandler()`         | Centralized React error normalization and reporting                 |

### Extension Features ([extension/src/](extension/src/))

| Module                | Size   | Purpose                                                                                  |
| --------------------- | ------ | ---------------------------------------------------------------------------------------- |
| **extension.ts**      | 25 KB  | Extension activator, URI deep-link routers, workspace launchers, 9 command registrations |
| **yjs-sync.ts**       | 38 KB  | Yjs CRDT document synchronization, workspace materialization, file tree handlers         |
| **websocket.ts**      | 12 KB  | Custom reconnecting WebSocket client, message queuing, state transition dispatching      |
| **chat.ts**           | 8 KB   | Webview chat panel backend provider                                                      |
| **protocol.ts**       | 8 KB   | Binary encoding/decoding layers for sync, awareness, and activity frames                 |
| **git.ts**            | 6 KB   | Git repo initialization/management                                                       |
| **cursor-manager.ts** | 5 KB   | Visual cursor and selection range tracking across active editors                         |
| **api.ts**            | 4 KB   | REST client for backend communication                                                    |
| **status-bar.ts**     | 3.5 KB | Native theme-aware status bar connection indicators (connected/disconnected/issue)       |
| **auth.ts**           | 2.5 KB | VS Code SecretStorage credential store, token persistence                                |
| **utils.ts**          | 2 KB   | Helper functions and path normalization utilities                                        |
| **types.ts**          | 1.5 KB | Shared type interfaces for communication layers                                          |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│            Web Control Plane (Next.js 16)               │
│  Dashboard · Room Management · Invite Generation        │
│  Activity Log · Code Review · Launch Trigger            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS/REST
┌──────────────────────▼──────────────────────────────────┐
│            Go Backend (net/http)                        │
│  ┌─────────────────────────────────────────────┐        │
│  │ Auth Services (JWT) · Rate Limiters         │        │
│  │ Room/Invite/Launch Services · CORS          │        │
│  │ Sentry Error Tracking                       │        │
│  └─────────────────────────────────────────────┘        │
│  ┌─────────────────────────────────────────────┐        │
│  │ WebSocket Hub (Yjs CRDT Relay)              │        │
│  │ Connection Management · Message Broadcasting│        │
│  │ Snapshot Persistence · Activity Logging     │        │
│  └─────────────────────────────────────────────┘        │
└──────────────────────┬──────────────────────────────────┘
         │             │              │
    SQL  │       WebSocket           │ Snapshots/
         │             │          Activities
    ┌────▼──────────┐  │  ┌──────────▼──────────┐
    │  PostgreSQL   │  │  │  VS Code Extension  │
    │  (Supabase/   │  │  │  TypeScript+Yjs     │
    │   self-hosted)│  │  │  - CRDT sync        │
    └───────────────┘  │  │  - Cursor presence  │
                       │  │  - Chat             │
                    ┌──▼──▼──────────────────┐
                    │  VS Code Editor (IDE)  │
                    │  + CodeDock Extension  │
                    │  Real-time collab      │
                    └───────────────────────┘
```

**Data Flow:**

1. **Room Creation** → Web → Backend REST → PostgreSQL
2. **Join Room** → Extension → Backend WebSocket → Hub (relay)
3. **Document Sync** → Extension Yjs → WebSocket → Hub → Other Extensions (CRDT)
4. **Cursor Tracking** → Extension → WebSocket → Hub → Broadcast
5. **Activity Logging** → Hub records events → PostgreSQL
6. **Code Review** → Web fetches activity snapshots → Diff computation → Side-by-side view

---

## Database Schema

### Migration Files ([migration/](migration/))

| Migration                         | Purpose                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `001_create_extensions.sql`       | Enable pgcrypto extension                                          |
| `002_create_enums.sql`            | Define enums (e.g., room roles: `editor`, `viewer`)                |
| `003_create_users.sql`            | Users table (id, email, password_hash, timestamps)                 |
| `004_create_trigger_function.sql` | Auto-update `updated_at` timestamps                                |
| `005_create_rooms.sql`            | Rooms table (id, name, created_by, is_active)                      |
| `006_create_room_members.sql`     | Room membership with roles (user_id, room_id, role)                |
| `007_create_snapshots.sql`        | Yjs document snapshots (room_id, file_path, yjs_state)             |
| `008_create_invite_tokens.sql`    | Invite tokens (room_id, token, expires_at, used_at)                |
| `009_create_activities.sql`       | Activity audit log (room_id, user_id, type, file_path, details)    |
| `012_default_rooms_inactive.sql`  | Default rooms to inactive status                                   |
| `0002_phase1_control_plane.sql`   | Phase 1 control plane (launch tokens, source metadata, join codes) |

**Core Tables:**

- **users** — Authentication, email-based accounts
- **rooms** — Collaboration spaces, creation metadata, source_metadata (JSONB)
- **room_members** — Membership with role-based access (host, editor)
- **snapshots** — CRDT state persistence (one per file per room)
- **room_invite_tokens** — Time-limited join invitations (5-min expiry, auto-revoke)
- **room_launch_tokens** — One-time IDE launch tokens (2-min TTL)
- **activities** — Audit trail (edits, joins, leaves, file paths, metadata)

---

## Configuration Files

| File                                 | Purpose                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| **go.mod**                           | Go 1.25 dependencies: jwt/v5, websocket, postgres driver, sentry, env, PostHog  |
| **package.json**                     | Root monorepo utils: diff, react                                                |
| **codedock-web/package.json**        | Next.js 16 app: TanStack Query 5, Tailwind 3.4, Sonner, Lucide, PostHog, Vitest |
| **codedock-web/tsconfig.json**       | TypeScript compiler: path aliases (@/\*)                                        |
| **codedock-web/next.config.ts**      | Next.js configuration (webpack, env vars)                                       |
| **codedock-web/tailwind.config.ts**  | Tailwind CSS theming                                                            |
| **extension/package.json**           | VS Code extension v3.2.0: 9 commands, telemetry settings, esbuild               |
| **extension/tsconfig.json**          | Extension TypeScript build config                                               |
| **extension/esbuild.js**             | Extension bundler config                                                        |
| **fly.toml**                         | Fly.io deployment: region (fra), 1GB RAM, auto-start, force HTTPS               |
| **Dockerfile**                       | Multi-stage Go build (golang:1.25-alpine → alpine:latest)                       |
| **.github/workflows/fly-deploy.yml** | GitHub Actions: auto-deploy to Fly.io on push to main                           |

---

## Build & Deployment

### Build Scripts ([scripts/](scripts/))

| Script                                    | Purpose                                  |
| ----------------------------------------- | ---------------------------------------- |
| `scaffold-codedock-web.sh`                | Initialize frontend project structure    |
| `apply-supabase-migrations.sh`            | Apply PostgreSQL migrations to Supabase  |
| `apply-phase1-control-plane-migration.sh` | Apply phase 1 control plane migration    |
| `create-test-users.sh`                    | Populate test database with sample users |
| `export-backend-debug.sh`                 | Bundle backend context for debugging     |
| `export-debug-bundle.sh`                  | Create diagnostic export                 |
| `collect_codedock_full_snapshot.sh`       | Collect full codebase snapshot           |
| `cleanup-repo.sh`                         | Remove build artifacts and dependencies  |

### CI/CD Pipeline

- **GitHub Actions** (`fly-deploy.yml`) → Automatically deploys to Fly.io on push to `main`
- **Docker Multi-stage Build** → golang:1.25-alpine builder + alpine:latest runtime
- **Environment Variables** — Loaded from `.env` via `godotenv`

### Deployment Configuration

**Fly.io** ([fly.toml](fly.toml)):

- Primary region: `fra` (Frankfurt)
- Auto-stop machines: off
- Auto-start machines: enabled
- Min machines: 1
- Force HTTPS: enabled
- Internal port: 8080 → Public HTTPS
- VM: 1 CPU shared, 1GB RAM (1024MB)

**Database** (PostgreSQL 16):

- Supabase managed or self-hosted
- Connection pooling via Go's `database/sql`
- SSL mode configurable (`DB_SSLMODE`)

**Frontend Deployment** (Vercel):

- Automatic CI/CD on push
- Next.js optimization (server components, edge functions)
- Vercel Analytics + SpeedInsights integrated
- Environment: `codedock-web/` directory
- Default port: 3000 (dev), managed by Vercel (production)

---

## API Endpoints

### Authentication

- `POST /auth/register` — Create account (rate limited: 10/min)
- `POST /auth/login` — JWT token generation (rate limited: 10/min)
- `GET /auth/me` — Fetch authenticated user (requires JWT)
- `POST /auth/exchange` — **Deprecated** legacy code exchange

### Rooms

- `POST /rooms` — Create room
- `GET /rooms` — List user's rooms
- `GET /rooms/{roomId}` — Get room details
- `DELETE /rooms/{roomId}` — Soft-delete room (host only)
- `GET /rooms/{roomId}/details` — Extended room metadata (source state, membership, launch exchange)
- `GET /rooms/{roomId}/presence` — Online users/cursors
- `GET /rooms/{roomId}/activities` — Activity audit log
- `POST /rooms/{roomId}/activation/toggle` — Activate/deactivate (owner only)
- `POST /rooms/{roomId}/source/local/bind` — Bind to local workspace (host only)
- `POST /rooms/{roomId}/leave` — Leave room as member

### Invites

- `POST /join-code/resolve` — Validate and resolve invite code → room (rate limited)
- `GET /rooms/{roomId}/invites` — List room invites
- `POST /rooms/{roomId}/invites` — Generate invite token (5-min expiry, auto-revokes previous)
- `DELETE /rooms/{roomId}/invites/{inviteId}/revoke` — Revoke invite

### IDE Launch

- `POST /rooms/{roomId}/open-in-vscode` — Generate VS Code launch token + deep-link
- `POST /rooms/{roomId}/open-ide` — Generate IDE-agnostic launch token (VS Code or Antigravity)
- `POST /vscode/launch/exchange` — Exchange launch token for room context (no auth required)

### Real-time

- `GET /ws` (WebSocket upgrade) — CRDT sync relay, cursor tracking, chat (rate limited: 100/min)

### Infrastructure

- `GET /health` — Liveness probe
- `GET /ready` — Readiness probe (includes DB connectivity check)

---

## Key Design Patterns

### Real-time Collaboration

- **CRDT (Conflict-free Replicated Data Type)** using Yjs
- Document state synchronized across all connected editors
- No central arbiter needed for merge conflicts
- Automatic conflict resolution at the CRDT level
- Snapshot persistence for document recovery

### WebSocket Hub Architecture

- Central hub maintains connections to all active collaborators
- Messages broadcast to all room participants by type
- Binary frame protocol with 11 distinct message types (0x01–0x0B)
- Snapshot persistence for document recovery
- Activity logging for audit trail and presence tracking

### JWT Authentication

- Stateless token-based auth (golang-jwt/v5)
- Token stored in localStorage (web) or VS Code SecretStorage (extension)
- Rate limiting on auth endpoints (10 req/min)
- Origin-based CORS with no wildcard support

### Multi-tier Service Architecture

- **Presentation** (Next.js 16) → **API** (Go) → **Database** (PostgreSQL)
- Clean separation of concerns (handlers → services → DB)
- Horizontal scaling ready
- Test coverage across all tiers

### Multi-Editor / IDE Launch Handoff

- Supports launching the collaborative workspace in different editor targets: **Visual Studio Code** and **Antigravity**.
- Deep-links are generated with custom protocol schemes (`vscode://` and `antigravity://`) carrying a short-lived launch token (`2-minute TTL`).
- **Real-Time Handoff Feedback Loop**: Once the IDE extension intercepts the protocol scheme and calls `/vscode/launch/exchange` to redeem the launch token, the backend triggers a WebSocket broadcast containing `MessageTypeRoomUpdate` (`0x0A`) to all connected dashboard web clients. The web frontend catches this event via `useRoomSync`, invalidates the active room details query, and updates the launch UI progress status to confirm that the session successfully transferred to the editor.

### Room Source Types

- **`local_workspace`** — Host binds a local folder; workspace state tracked via `source_metadata` JSONB (workspace_bound, activated, ready, workspace_label).
- **`github_repo`** — Room backed by a GitHub repository; metadata includes `repo_owner`, `repo_name`, `branch`, `clone_ready`.
- Both types follow the same activation gating flow: bind → activate → launch.

---

## Development Workflow

### Frontend Development

```bash
cd codedock-web
npm install
npm run dev  # Port 3000
```

### Backend Development

```bash
go run main.go
# Server runs on port 8080
```

### Extension Development

```bash
cd extension
npm install
npm run compile  # TypeScript check + esbuild bundle
# Or: npx @vscode/vsce package  # Build .vsix
```

### Database Migrations

```bash
# Run migrations on Supabase or self-hosted PostgreSQL
bash scripts/apply-supabase-migrations.sh
```

### Testing

```bash
# Backend tests
go test ./...

# Frontend tests
cd codedock-web
npm test  # vitest run

# Test server dashboard
cd codedock-test-dashboard
npm run dev
```

---

## Environment Variables

Required environment variables (typically in `.env`):

**Backend:**

- `JWT_SECRET` — Secret key for JWT signing (required)
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` — PostgreSQL connection (required)
- `DB_SSLMODE` — PostgreSQL SSL mode (`disable` default, `require` for production)
- `PORT` — Server port (default: `8080`)
- `WEB_ALLOWED_ORIGINS` — Allowed CORS origins (e.g., `https://codedockapp.vercel.app`)
- `SENTRY_DSN` — Sentry error tracking endpoint (optional)

**Frontend:**

- `NEXT_PUBLIC_API_BASE_URL` — Backend API endpoint (e.g., `http://localhost:8080` for dev, `https://codedock.fly.dev` for production)

**Extension:**

- `codedock.serverUrl` — Backend URL (VS Code setting, default: `https://codedock.fly.dev`)
- `codedock.webAppUrl` — Web app URL (VS Code setting, default: `https://codedockapp.vercel.app/`)
- Credentials stored in VS Code SecretStorage (keychain)

---

## Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Sentry project created and DSN configured
- [ ] CORS origins configured correctly
- [ ] JWT secret generated and stored securely
- [ ] PostgreSQL SSL certificates configured (if needed)
- [ ] Docker image built and tested locally
- [ ] Fly.io app created and secrets configured
- [ ] GitHub Actions workflow enabled
- [ ] Vercel project connected to `codedock-web/`
- [ ] VS Code extension packaged and published

---

## Key Files for Understanding the Codebase

**Start with these files to understand the architecture:**

1. `main.go` — Backend entry point, routing, middleware assembly
2. `internal/hub/hub.go` — WebSocket relay logic, room-scoped message broadcasting
3. `internal/hub/message.go` — Binary protocol message type definitions
4. `internal/services/rooms.go` — Room lifecycle, source state machine, activation gating
5. `codedock-web/app/page.tsx` — Frontend landing page
6. `codedock-web/hooks/use-room-sync.ts` — WebSocket integration, real-time UI updates
7. `extension/src/extension.ts` — Extension entry point, URI handlers, command registration
8. `extension/src/yjs-sync.ts` — CRDT document sync, workspace materialization
9. `migration/` — Database schema evolution
10. `fly.toml` — Deployment configuration

---

## Quick Reference: Technology Decisions

- **Go Backend**: High concurrency support, fast performance, easy deployment (single binary)
- **Next.js 16 Frontend**: Server-side rendering, static optimization, App Router architecture
- **Yjs CRDT**: Battle-tested real-time sync, automatic conflict resolution
- **PostgreSQL 16**: Reliable transactions, JSONB support, proven at scale
- **Fly.io**: Simple deployment, global edge network, WebSocket-friendly infrastructure
- **VS Code Extension API**: Massive market reach (1.3k+ downloads), rich integration capabilities
- **TanStack Query 5**: Server state management, automatic cache invalidation, optimistic updates
- **Sonner**: Toast notifications with minimal footprint
- **esbuild**: Fast extension bundling (sub-second builds)
