# CodeDock Codebase Index

## Project Structure

The CodeDock repository is organized as a **monorepo** with three main application components:

```
/home/gamp/Desktop/CodeDock/
├── Backend Server (Go)              main.go, go.mod, Dockerfile
├── Frontend Web App (Next.js)        codedock-web/
├── VS Code Extension (TypeScript)    extension/
├── Database Migrations               migration/
├── Infrastructure & Scripts          scripts/, fly.toml
├── Test Dashboard                    codedock-test-dashboard/
└── Configuration Files               package.json, go.mod, .env files
```

---

## Technologies & Frameworks

| Layer              | Technology Stack                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Backend**        | Go 1.25, `net/http`, `gorilla/websocket`, `golang-jwt/jwt/v5`, `lib/pq` (PostgreSQL driver), Sentry error tracking |
| **Database**       | PostgreSQL 16, pgcrypto extension                                                                                  |
| **Frontend**       | Next.js 15 (App Router), React 19, TypeScript 5.6, Tailwind CSS 3.4, TanStack Query, React Query                   |
| **Extension**      | VS Code Extension API, TypeScript, esbuild, Yjs (CRDT sync), `gorilla/ws` client library                           |
| **Real-time Sync** | Yjs / CRDT over WebSocket (document sync, cursor presence)                                                         |
| **Auth**           | JWT tokens, bcrypt password hashing                                                                                |
| **Hosting**        | Backend: Fly.io (fra region), Frontend: Vercel, DB: Supabase/self-hosted PostgreSQL                                |
| **Deployment**     | Docker, GitHub Actions, fly.io CLI                                                                                 |

---

## Main Entry Points

### Backend

- **main.go** — Server initialization, route definitions, database connection
  - Initializes Sentry monitoring
  - Sets up HTTP mux with CORS
  - Configures rate limiters for auth and WebSocket endpoints
  - Connects to PostgreSQL database

### Frontend

- **codedock-web/app/page.tsx** — Landing page with marketing content
- **codedock-web/app/layout.tsx** — Root layout
- **codedock-web/app/(app)/dashboard/page.tsx** — Workspace/Room dashboard page
- **codedock-web/app/(app)/rooms/[roomId]/page.tsx** — Specific Room details page (client-side rendered via room-details-page component)
- **codedock-web/app/(app)/rooms/[roomId]/review/[userId]/page.tsx** — Standing code review route for specific teammates' edits
- **codedock-web/app/(app)/activity/page.tsx** — Session activity timeline logs page
- **codedock-web/app/(app)/join/page.tsx** — Resolving and joining rooms via code
- **codedock-web/package.json** — Scripts: `dev` (port 3000), `build`, `test`, `lint`

### Extension

- **extension/src/extension.ts** — Extension activation/deactivation, command registration, VS Code URI scheme callback handlers
- **extension/package.json** — Defines commands, status bar menu items, contributes settings, engine constraints

### Test Dashboard

- **codedock-test-dashboard/backend/main.go** — Isolated test server
- **codedock-test-dashboard/frontend/** — Vite + React test UI

---

## Key Components & Services

### Backend Services ([internal/services/](internal/services/))

| Service           | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| **RoomService**   | Room creation, updates, deletion, activation/deactivation            |
| **InviteService** | Generate, list, validate, and revoke invite tokens                   |
| **LaunchService** | Generate launch tokens for IDE deep-links, exchange for room context |
| **SnapshotStore** | Persist Yjs document state (CRDT snapshots)                          |
| **ActivityStore** | Track user activities (edits, joins, leaves) with metadata           |
| **CreateUser**    | Helper function in `users.go` for database user record insertion & password hashing |

### Backend Handlers ([internal/handlers/](internal/handlers/))

| Handler           | Endpoints                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AuthHandler**   | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`                                                                                                   |
| **RoomHandler**   | `GET/POST /rooms`, `/rooms/{roomId}`, `/rooms/{roomId}/details`, `/rooms/{roomId}/activation/toggle`, `/rooms/{roomId}/leave`, `/rooms/{roomId}/activities` |
| **InviteHandler** | `/join-code/resolve`, `/rooms/{roomId}/invites`, `/rooms/{roomId}/invites/{inviteId}/revoke`                                                                |
| **LaunchHandler** | `/rooms/{roomId}/open-in-vscode`, `/rooms/{roomId}/open-ide`, `/vscode/launch/exchange`                                                                     |
| **WSHandler**     | `GET /ws` — WebSocket gateway for real-time collaboration                                                                                                   |
| **HealthHandler** | `GET /health` (liveness), `GET /ready` (readiness with DB connectivity validation)                                                                          |

### Backend Core Modules ([internal/](internal/))

- **[internal/auth/](internal/auth/)** — JWT middleware (`RequireAuth`), token generation/validation
- **[internal/hub/](internal/hub/)** — WebSocket connection hub, message relay, CRDT sync coordination (`client.go`, `hub.go`, `message.go`)
- **[internal/middleware/](internal/middleware/)** — Rate limiting, CORS handling
- **[internal/observability/](internal/observability/)** — Sentry integration, error tracking

### Frontend Components ([codedock-web/components/](codedock-web/components/))

| Component Group | Purpose                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| **auth/**       | Login/register forms, auth state management                                           |
| **dashboard/**  | Room list, room details, invite management UI                                         |
| **rooms/**      | Room creation, workspace binding, invite generation, code reviews, status indicators |
| **layout/**     | Navigation, sidebar, main content wrapper                                             |
| **ui/**         | Reusable: buttons, modals, inputs, tables, cards, diff views                          |
| **fancy/**      | Advanced UI: text rotation, animations, visual effects                                |
| **marketing/**  | Landing page components, feature showcase                                             |
| **brand/**      | Logo, brand SVG rendering assets                                                      |
| **backgrounds/**| Complex visual components (e.g. grid patterns, animated particles)                    |
| **reactbits/**  | Low-level animation & micro-interaction building blocks                               |

### Frontend Hooks ([codedock-web/hooks/](codedock-web/hooks/))

| Hook                        | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `useAuth()`                 | Authentication state, login/logout, token management |
| `useRoom(roomId)`           | Fetch/update single room details                     |
| `useRooms()`                | Fetch user's room list                               |
| `useInvites(roomId)`        | List, create, revoke room invites                    |
| `useJoinCode()`             | Resolve join codes to rooms                          |
| `useLaunch(roomId)`         | Generate and exchange launch tokens                  |
| `useRoomSync(roomId)`       | WebSocket sync state (connection, doc state)         |
| `useRoomPresence(roomId)`   | Track online users, cursors, active editors          |
| `useRoomActivities(roomId)` | Fetch activity log for audit/presence                |
| `useReviewFiles(roomId)`    | File diff generation and review UI                   |
| `useRoomDetails(roomId)`    | Room metadata, source workspace info                 |
| `useErrorHandler()`         | Centralized React error normalization and reporting  |

### Extension Features ([extension/src/](extension/src/))

| Module                | Purpose                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| **auth.ts**           | VS Code credential store, token persistence                                            |
| **api.ts**            | REST client for backend communication                                                  |
| **websocket.ts**      | WebSocket connection manager, state transition dispatching                             |
| **yjs-sync.ts**       | CRDT document synchronization                                                          |
| **cursor-manager.ts** | Render teammate cursors, track selections                                              |
| **chat.ts**           | Integrated chat panel                                                                  |
| **git.ts**            | Git repo initialization/management                                                     |
| **protocol.ts**       | Message protocol definitions                                                           |
| **status-bar.ts**     | Native theme-aware status bar connection indicators (connected, disconnected, issue)  |
| **types.ts**          | Shared type interfaces for communication layers                                        |
| **utils.ts**          | Helper subroutines and path normalization utilities                                    |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│            Web Control Plane (Next.js 15)               │
│  Dashboard · Room Management · Invite Generation        │
│  Activity Log · Launch Trigger                          │
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
│  │ Snapshot Persistence                        │        │
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

---

## Database Schema

### Migration Files ([migration/](migration/))

| Migration                         | Purpose                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `001_create_extensions.sql`       | Enable pgcrypto extension                                       |
| `002_create_enums.sql`            | Define enums (e.g., room roles: `editor`, `viewer`)             |
| `003_create_users.sql`            | Users table (id, email, password_hash, timestamps)              |
| `004_create_trigger_function.sql` | Auto-update `updated_at` timestamps                             |
| `005_create_rooms.sql`            | Rooms table (id, name, created_by, is_active)                   |
| `006_create_room_members.sql`     | Room membership with roles (user_id, room_id, role)             |
| `007_create_snapshots.sql`        | Yjs document snapshots (room_id, file_path, yjs_state)          |
| `008_create_invite_tokens.sql`    | Invite tokens (room_id, token, expires_at, used_at)             |
| `009_create_activities.sql`       | Activity audit log (room_id, user_id, type, file_path, details) |
| `012_default_rooms_inactive.sql`  | Default rooms to inactive status                                |
| `0002_phase1_control_plane.sql`   | Phase 1 control plane enhancements                              |

**Core Tables:**

- **users** — Authentication, email-based accounts
- **rooms** — Collaboration spaces, creation metadata
- **room_members** — Membership with role-based access
- **snapshots** — CRDT state persistence (one per file per room)
- **invite_tokens** — Time-limited join invitations
- **activities** — Audit trail (edits, joins, leaves, etc.)

---

## Configuration Files

| File                                | Purpose                                                                |
| ----------------------------------- | ---------------------------------------------------------------------- |
| **go.mod**                          | Go dependencies: jwt, websocket, postgres driver, env loading          |
| **package.json**                    | Root monorepo utils: diff, react                                       |
| **codedock-web/package.json**       | Next.js app scripts + dependencies                                     |
| **codedock-web/tsconfig.json**      | TypeScript compiler: ES2017, path aliases (@/\*)                       |
| **codedock-web/next.config.ts**     | Next.js configuration (webpack, env vars, proxy)                       |
| **codedock-web/tailwind.config.ts** | Tailwind CSS theming                                                   |
| **extension/package.json**          | VS Code extension metadata, commands, contributes                      |
| **extension/tsconfig.json**         | Extension TypeScript build config                                      |
| **fly.toml**                        | Fly.io deployment: region (fra), machine specs (1GB RAM), auto-scaling |
| **Dockerfile**                      | Multi-stage Go build + Alpine runtime                                  |

---

## Build & Deployment

### Build Scripts ([scripts/](scripts/))

| Script                              | Purpose                                  |
| ----------------------------------- | ---------------------------------------- |
| `scaffold-codedock-web.sh`          | Initialize frontend project structure    |
| `apply-supabase-migrations.sh`      | Apply PostgreSQL migrations to Supabase  |
| `create-test-users.sh`              | Populate test database with sample users |
| `export-backend-debug.sh`           | Bundle backend context for debugging     |
| `export-debug-bundle.sh`            | Create diagnostic export                 |
| `collect_codedock_full_snapshot.sh` | Collect full codebase snapshot           |
| `cleanup-repo.sh`                   | Remove build artifacts and dependencies  |

### CI/CD Pipeline

- **GitHub Actions** → Automatically deploys to Fly.io on push
- **Docker Multi-stage Build** → Alpine base, 1GB memory allocation
- **Environment Variables** — Loaded from `.env` via `godotenv`

### Deployment Configuration

**Fly.io** ([fly.toml](fly.toml)):

- Primary region: `fra` (Frankfurt)
- Auto-scaling: enabled
- Min machines: 1
- Force HTTPS: enabled
- Internal port: 8080 → Public HTTPS
- VM: 1 CPU shared, 1GB RAM

**Database** (PostgreSQL 16):

- Supabase managed or self-hosted
- Connection pooling via Go's `database/sql`
- SSL mode configurable (`DB_SSLMODE`)

**Frontend Deployment** (Vercel):

- Automatic CI/CD on push
- Next.js optimization (server components, edge functions)
- Environment: `codedock-web/` directory
- Default port: 3000 (dev), managed by Vercel (production)

---

## API Endpoints

### Authentication

- `POST /auth/register` — Create account (rate limited)
- `POST /auth/login` — JWT token generation (rate limited)
- `GET /auth/me` — Fetch authenticated user (requires JWT)

### Rooms

- `POST /rooms` — Create room
- `GET /rooms` — List user's rooms
- `GET /rooms/{roomId}` — Get room details
- `GET /rooms/{roomId}/details` — Extended room metadata
- `GET /rooms/{roomId}/presence` — Online users/cursors
- `GET /rooms/{roomId}/activities` — Activity audit log
- `POST /rooms/{roomId}/activation/toggle` — Activate/deactivate
- `POST /rooms/{roomId}/source/local/bind` — Bind to local workspace
- `DELETE /rooms/{roomId}` — Delete room
- `POST /rooms/{roomId}/leave` — Leave room as member

### Invites

- `POST /join-code/resolve` — Validate and resolve invite code → room
- `GET /rooms/{roomId}/invites` — List room invites
- `POST /rooms/{roomId}/invites` — Generate invite token
- `DELETE /rooms/{roomId}/invites/{inviteId}` — Revoke invite

### IDE Launch

- `POST /rooms/{roomId}/open-in-vscode` — Generate VS Code launch token + deep-link
- `POST /rooms/{roomId}/open-ide` — Generate IDE-agnostic launch token
- `POST /vscode/launch/exchange` — Exchange launch token for room context

### Real-time

- `GET /ws` (WebSocket upgrade) — CRDT sync relay, cursor tracking, chat

---

## Key Design Patterns

### Real-time Collaboration

- **CRDT (Conflict-free Replicated Data Type)** using Yjs
- Document state synchronized across all connected editors
- No central arbiter needed for merge conflicts
- Automatic conflict resolution at the CRDT level

### WebSocket Hub Architecture

- Central hub maintains connections to all active collaborators
- Messages broadcast to all room participants
- Snapshot persistence for document recovery
- Activity logging for audit trail and presence tracking

### JWT Authentication

- Stateless token-based auth
- Token refresh mechanism
- Credential storage in VS Code keychain (extension)
- Rate limiting on auth endpoints

### Multi-tier Service Architecture

- **Presentation** (Next.js) → **API** (Go) → **Database** (PostgreSQL)
- Clean separation of concerns
- Horizontal scaling ready
- Microservice-friendly architecture

### Multi-Editor / IDE Launch Handoff

- Supports launching the collaborative workspace in different editor targets: **Visual Studio Code** and **Antigravity**.
- Deep-links are generated with custom protocol schemes (`vscode://` and `antigravity://`) carrying a short-lived launch token (`2-minute TTL`).
- **Real-Time Handoff Feedback Loop**: Once the IDE extension intercepts the protocol scheme and calls `/vscode/launch/exchange` to redeem the launch token, the backend triggers a WebSocket broadcast containing `MessageTypeRoomUpdate` (`0x0a`) to all connected dashboard web clients. The web frontend catches this event via `useRoomSync`, invalidates the active room details query, and updates the launch UI progress status to confirm that the session successfully transferred to the editor.

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
npm run compile  # Or vsce package to build VSIX
```

### Database Migrations

```bash
# Run migrations on Supabase or self-hosted PostgreSQL
bash scripts/apply-supabase-migrations.sh
```

### Testing

```bash
# Backend tests via Go test suite
go test ./...

# Frontend tests (if configured)
cd codedock-web
npm test

# Test server dashboard
cd codedock-test-dashboard
npm run dev
```

---

## Environment Variables

Required environment variables (typically in `.env`):

**Backend:**

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret key for JWT signing
- `SENTRY_DSN` — Sentry error tracking endpoint
- `WEB_ALLOWED_ORIGINS` — Allowed CORS origins (e.g., `https://codedockapp.vercel.app`)
- `DB_SSLMODE` — PostgreSQL SSL mode (disable, require, etc.)

**Frontend:**

- `NEXT_PUBLIC_API_BASE_URL` — Backend API endpoint (e.g., `http://localhost:8080` for local development)

**Extension:**

- Credentials stored in VS Code credential store
- Token refresh handled automatically

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
- [ ] VS Code extension packaged and ready for release

---

## Key Files for Understanding the Codebase

**Start with these files to understand the architecture:**

1. `main.go` — Backend entry point and routing
2. `codedock-web/app/page.tsx` — Frontend landing page
3. `extension/src/extension.ts` — Extension entry point
4. `internal/hub/hub.go` — WebSocket relay logic
5. `migration/` — Database schema evolution
6. `fly.toml` — Deployment configuration
7. `codedock-web/hooks/use-room.ts` — Frontend state management example

---

## Quick Reference: Technology Decisions

- **Go Backend**: High concurrency support, fast performance, easy deployment (single binary)
- **Next.js Frontend**: Server-side rendering, static optimization, edge functions for scalability
- **Yjs CRDT**: Battle-tested real-time sync, automatic conflict resolution
- **PostgreSQL**: Reliable transactions, JSON support, proven at scale
- **Fly.io**: Simple deployment, global edge network, reasonable pricing
- **VS Code Extension API**: Massive market reach, rich integration capabilities
