# CodeDock Backend & Platform Audit Plan

This plan details the comprehensive audit, testing, and hardening of the CodeDock real-time collaboration backend, Web Control Plane, and VS Code extension integration.

## 1. Current Architecture Map

### Core Technologies
- **Backend**: Go 1.26, HTTP (`net/http`)
- **Persistence**: PostgreSQL
- **Web Frontend**: Next.js (port 3000)
- **Extension**: VS Code (Node.js)
- **Sync/Collaboration**: WebSockets, Yjs CRDT

### Handlers & Services
Located in `/internal/`:
- `auth`: JWT middleware, password hashing.
- `handlers`:
  - `AuthHandler`: `/auth/register`, `/auth/login`, `/auth/me`
  - `RoomHandler`: `/rooms`, `/rooms/{id}`, `/rooms/{id}/details`
  - `InviteHandler`: `/rooms/{roomId}/invites`, `/join-code/resolve`
  - `LaunchHandler`: `/rooms/{roomId}/open-in-vscode`
  - `ws.go`: WebSocket entrypoint
- `services`: DB logic for users, rooms, invites, launches, snapshots.
- `hub`: WebSocket client management, broadcast, message routing.

### Database Tables (PostgreSQL)
Based on migration files:
- `users`: Core identity.
- `rooms`: Central collaboration entities.
- `room_members`: Access control and roles (`host`, `editor`).
- `room_invite_tokens`: Ephemeral/managed join codes.
- `room_launch_tokens`: Secure handoff from Web to VS Code.
- `snapshots`: CRDT state persistence per room/file.

---

## 2. Contract Verification

All dependent systems must agree on these API boundaries:

### Auth
- `POST /auth/register`
  - **Request**: `{ "email": "...", "password": "..." }`
  - **Response**: `{ "token": "...", "user": {...} }`
- `POST /auth/login`
  - **Request**: `{ "email": "...", "password": "..." }`
  - **Response**: `{ "token": "...", "user": {...} }`
- `GET /auth/me`
  - **Response**: Profile data.

### Rooms & Source State
- `POST /rooms`
  - **Request**: `{ "name": "...", "source_type": "local_workspace" | "github_repo", "source_metadata": {...} }`
- `GET /rooms/{roomId}/details`
  - **Response**: `{ "room": {...}, "membership": {...}, "source_state": { "type": "...", "status": "...", "ready": bool, "launch_allowed": bool } }`

### Collaboration & Hand-off
- `POST /join-code/resolve`
  - **Request**: `{ "code": "..." }`
- `POST /rooms/{roomId}/open-in-vscode`
  - **Response**: `{ "launch_url": "codedock://..." }`
- `GET /ws?token=...&room_id=...`
  - **Transport**: WebSocket for Yjs synchronization.

---

## 3. Test Plan & Matrix

To ensure production readiness, the following test matrix will be executed and verified:

### Unit & Integration Tests (Backend)
- [x] Existing tests pass (`go test ./...` returns 0).
- [ ] Add tests for `github_repo` clone readiness state transitions.
- [ ] Ensure deleted rooms actively sever WebSocket connections in the `hub`.
- [ ] Verify `launch_token` single-use consumption logic.
- [ ] Test path traversal protections in workspace manifest building.

### WebSocket Hub Tests
- [ ] Verify unauthorized connections are dropped.
- [ ] Verify clients only receive broadcasts for their joined room.
- [ ] Validate presence tracking (`connected_count`).

### VS Code Extension & E2E Validation
- [ ] Manual E2E Test A: End-to-end auth (`/auth/me`).
- [ ] Manual E2E Test B: Local workspace lifecycle (Host bind -> Guest join -> Yjs sync).
- [ ] Manual E2E Test C: GitHub repo lifecycle.
- [ ] Manual E2E Test D: Invite generation, resolution, and revoking.
- [ ] Manual E2E Test E: Host deletes room, kicking connected guests.

---

## 4. Open Questions & User Review Required

> [!IMPORTANT]
> The current backend tests (`go test ./...`) succeed with 100% passing. 
> 
> Before I begin writing new tests and performing the manual E2E verifications via the VS Code extension:
> 1. Are there any known, specific bugs you've experienced recently that I should prioritize debugging?
> 2. Should I proceed directly with Phase 6 (Open in VS Code) and Phase 10 (Workspace Hydration) manual validation?
