# CodeDock

**Self-hosted, real-time collaborative coding platform for engineering teams.**

CodeDock gives developers a focused control plane for shared coding sessions — room creation, invite management, workspace readiness, and one-click VS Code launch — without surrendering infrastructure ownership.

[![Go](https://img.shields.io/badge/Go-1.25-00ADD8?style=flat-square&logo=go)](https://golang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Tests](https://img.shields.io/badge/tests-60%20passing-4CAF50?style=flat-square)](#testing)
[![Coverage](https://img.shields.io/badge/coverage-66.7%25-yellowgreen?style=flat-square)](#testing)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Monorepo Structure](#monorepo-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Backend](#backend-setup)
  - [Frontend](#frontend-setup)
  - [VS Code Extension](#vs-code-extension-setup)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Overview

CodeDock is a self-hosted collaborative coding platform built for engineering teams. It replaces ad-hoc screen sharing with a structured workflow:

1. **Create a room** from the web control plane — choose a local workspace or a GitHub repository as the source
2. **Invite teammates** with short invite codes or generated invite tokens
3. **Launch directly into VS Code** with a one-time deep-link that opens the correct workspace and starts the collaboration session
4. **Collaborate in real time** — Yjs/CRDT document sync, cursor presence, and chat, all over a persistent WebSocket connection

The system is designed for always-on deployment. The WebSocket collaboration layer requires a persistent server — not a sleep-based host.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Web Control Plane                    │
│              Next.js 15 · Vercel (or self-hosted)       │
│  Dashboard · Room management · Invites · Launch trigger │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTPS / REST
┌───────────────────▼─────────────────────────────────────┐
│                   Go Backend                            │
│              net/http · Fly.io (fra region)             │
│  Auth · Room service · Invite service · Launch tokens   │
│  WebSocket gateway · CRDT relay · Snapshot persistence  │
└──────────┬─────────────────────┬───────────────────────┘
           │ SQL                 │ WebSocket
┌──────────▼──────────┐  ┌──────▼──────────────────────┐
│    PostgreSQL        │  │      VS Code Extension       │
│  Supabase / self-   │  │  TypeScript · gorilla/ws     │
│  hosted             │  │  Yjs sync · Cursor manager   │
└─────────────────────┘  │  Chat panel · Auth client    │
                         └──────────────────────────────┘
```

**Core tech stack:**

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.25, `net/http`, `gorilla/websocket` |
| Auth | JWT (`golang-jwt/jwt/v5`), bcrypt |
| Database | PostgreSQL 16, `lib/pq` |
| Real-time sync | Yjs / CRDT over WebSocket |
| Frontend | Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS |
| Extension | TypeScript, esbuild, VS Code Extension API |
| Backend hosting | Fly.io (`fra` region) |
| Frontend hosting | Vercel |
| DB hosting | Supabase (managed) or self-hosted PostgreSQL |

---

## Monorepo Structure

```
CodeDock/
├── main.go                        # Backend entry point
├── go.mod / go.sum                # Go module
├── Dockerfile                     # Backend container image
├── fly.toml                       # Fly.io deployment config
├── .github/
│   └── workflows/
│       └── fly-deploy.yml         # CI/CD → Fly.io
├── internal/
│   ├── auth/                      # JWT generation & middleware
│   ├── handlers/                  # HTTP request handlers
│   ├── hub/                       # WebSocket hub & client management
│   └── services/                  # Business logic (rooms, invites, launch, snapshots)
├── migration/                     # Ordered SQL migration files
├── codedock-web/                  # Next.js 15 frontend (web control plane)
│   ├── app/                       # App Router pages & layouts
│   ├── components/                # UI components
│   ├── hooks/                     # React data-fetching hooks
│   ├── lib/                       # API client & utilities
│   └── types/                     # Shared TypeScript types
├── extension/                     # VS Code extension
│   └── src/                       # TypeScript source
│       ├── extension.ts           # Entry point / lifecycle
│       ├── websocket.ts           # WebSocket manager
│       ├── yjs-sync.ts            # Yjs/CRDT document sync
│       ├── cursor-manager.ts      # Shared cursor presence
│       ├── chat.ts                # Chat panel
│       ├── api.ts                 # Backend API client
│       └── auth.ts                # Auth flow
├── codedock-test-dashboard/       # Internal test harness (not production)
└── scripts/                       # Utility scripts (migrations, debug exports)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Go | ≥ 1.25 |
| Node.js | ≥ 20 (v24 recommended) |
| npm | ≥ 10 |
| PostgreSQL | ≥ 14 |
| Git | ≥ 2.40 |

---

## Getting Started

### Backend Setup

```bash
# 1. Clone the repository
git clone https://github.com/jerryjuche/CodeDock.git
cd CodeDock

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env — see Environment Variables section below

# 3. Apply database migrations
#    Run each file in /migration in order:
psql "$DATABASE_URL" -f migration/001_create_extensions.sql
psql "$DATABASE_URL" -f migration/002_create_enums.sql
psql "$DATABASE_URL" -f migration/003_create_users.sql
psql "$DATABASE_URL" -f migration/004_create_trigger_function.sql
psql "$DATABASE_URL" -f migration/005_create_rooms.sql
psql "$DATABASE_URL" -f migration/006_create_room_members.sql
psql "$DATABASE_URL" -f migration/007_create_snapshots.sql
psql "$DATABASE_URL" -f migration/008_create_invite_tokens.sql
psql "$DATABASE_URL" -f migration/0002_phase1_control_plane.sql

# 4. Download Go dependencies
go mod download

# 5. Run the backend
go run main.go
# → Server starts on :8080 (or $PORT)
```

### Frontend Setup

```bash
# From the repository root:
cd codedock-web

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Set NEXT_PUBLIC_API_BASE_URL to your backend URL

# 3. Start the development server
npm run dev
# → Frontend starts on http://localhost:3000

# Production build
npm run build
npm run start
```

### VS Code Extension Setup

```bash
cd extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package as .vsix for manual install
npx vsce package

# Install locally
code --install-extension codedock-*.vsix
```

Once installed, configure the extension in VS Code settings:
- `codedock.serverUrl` — URL of your running CodeDock backend server (default: `https://codedock.fly.dev`)
  - For local development: `http://localhost:8080`
  - For production: Update to your deployed backend URL

---

## Environment Variables

### Backend (root `.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | HTTP server port |
| `DB_HOST` | Yes | — | PostgreSQL host |
| `DB_PORT` | Yes | — | PostgreSQL port (usually `5432`) |
| `DB_USER` | Yes | — | PostgreSQL username |
| `DB_PASSWORD` | Yes | — | PostgreSQL password |
| `DB_NAME` | Yes | — | PostgreSQL database name |
| `DB_SSLMODE` | No | `disable` | PostgreSQL SSL mode (`disable`, `require`, `verify-full`) |
| `JWT_SECRET` | Yes | — | Secret key used to sign JWT tokens |
| `WEB_ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated list of allowed CORS origins |

**Example `.env`:**
```dotenv
PORT=8080

DB_HOST=db.example.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_NAME=postgres
DB_SSLMODE=require

JWT_SECRET=your-long-random-secret-here

WEB_ALLOWED_ORIGINS=https://codedockapp.vercel.app
```

> **Never commit `.env`** — it is listed in `.gitignore`.

### Frontend (`codedock-web/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `http://localhost:8080` | Base URL of the CodeDock backend API |

**Example `codedock-web/.env.local` (for local development):**
```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

> For production on Vercel, set `NEXT_PUBLIC_API_BASE_URL` to your deployed backend URL in the Vercel project settings under **Environment Variables**.

---

## Database Migrations

Migrations live in `/migration/` as plain SQL files, named with an ordered prefix. Apply them sequentially against your PostgreSQL database:

| File | Description |
|------|-------------|
| `001_create_extensions.sql` | Enables `pgcrypto` |
| `002_create_enums.sql` | Defines `room_role` enum |
| `003_create_users.sql` | `users` table |
| `004_create_trigger_function.sql` | `updated_at` trigger |
| `005_create_rooms.sql` | `rooms` table |
| `006_create_room_members.sql` | `room_members` join table |
| `007_create_snapshots.sql` | `snapshots` table (Yjs state persistence) |
| `008_create_invite_tokens.sql` | `invite_tokens` table |
| `0002_phase1_control_plane.sql` | Phase 1 control plane schema (join codes, launch tokens, source metadata) |

> If using Supabase, run migrations via the Supabase SQL editor or the `psql` CLI against your project's connection string.

---

## API Reference

All protected routes require a `Bearer` JWT token in the `Authorization` header.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | No | Register a new user |
| `POST` | `/auth/login` | No | Login and receive a JWT |
| `GET` | `/auth/me` | Yes | Get current authenticated user |

### Rooms

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/rooms` | Yes | Create a room |
| `GET` | `/rooms` | Yes | List rooms for current user |
| `GET` | `/rooms/{roomId}` | Yes | Get room summary |
| `GET` | `/rooms/{roomId}/details` | Yes | Get full room details (source state, membership) |
| `GET` | `/rooms/{roomId}/presence` | Yes | Get member presence for a room |
| `POST` | `/rooms/{roomId}/source/local/bind` | Yes | Bind a local workspace path (host only) |
| `POST` | `/rooms/{roomId}/activation/toggle` | Yes | Toggle room active/inactive |
| `DELETE` | `/rooms/{roomId}` | Yes | Delete a room (host only) |

### Invites

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/join-code/resolve` | Yes | Resolve a join code and join the room |
| `GET` | `/rooms/{roomId}/invites` | Yes | List invite tokens for a room (host only) |
| `POST` | `/rooms/{roomId}/invites` | Yes | Create a new invite token |
| `POST` | `/rooms/{roomId}/invites/{inviteId}/revoke` | Yes | Revoke an invite token |

### Launch

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/rooms/{roomId}/open-in-vscode` | Yes | Generate a one-time VS Code launch deep-link |
| `POST` | `/vscode/launch/exchange` | No | Exchange a launch token (called by the extension) |

### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Liveness check |
| `GET` | `/ready` | No | Readiness check (verifies DB connectivity) |
| `GET` | `/ws` | Via token | WebSocket connection endpoint |

---

## Testing

The backend test suite covers auth, handlers, hub, and services:

```bash
# Run all Go tests
go test ./...

# Run with verbose output
go test -v ./...

# Run with coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

**Current test status:**

| Package | Status |
|---------|--------|
| `internal/auth` | ✅ Pass |
| `internal/handlers` | ✅ Pass |
| `internal/hub` | ✅ Pass |
| `internal/services` | ✅ Pass |

- **60 tests**, 0 failures
- **~66.7% coverage** across all packages

> Integration tests in `internal/handlers/integration_test.go` run against a real PostgreSQL instance. Set `TEST_DATABASE_URL` or the individual `DB_*` variables before running them.

---

## Deployment

### Backend → Fly.io

The backend is deployed to Fly.io in the `fra` (Frankfurt) region.

```bash
# Authenticate
flyctl auth login

# First-time setup (already configured via fly.toml)
flyctl launch

# Deploy
flyctl deploy

# Set secrets (run once per environment)
flyctl secrets set \
  DB_HOST=... \
  DB_PORT=5432 \
  DB_USER=... \
  DB_PASSWORD=... \
  DB_NAME=... \
  DB_SSLMODE=require \
  JWT_SECRET=... \
  WEB_ALLOWED_ORIGINS=https://codedockapp.vercel.app

# View logs
flyctl logs

# Check health
curl https://codedock.fly.dev/health
curl https://codedock.fly.dev/ready
```

The Fly configuration (`fly.toml`) keeps `auto_stop_machines = 'off'` and `min_machines_running = 1` to ensure the WebSocket server is always available.

### Frontend → Vercel

```bash
# From codedock-web/
vercel deploy --prod
```

Set the following environment variable in your Vercel project dashboard:

```
NEXT_PUBLIC_API_BASE_URL = https://api.codedockapp.vercel.app
```

(Replace with your actual deployed backend API URL)
```

### CI/CD

GitHub Actions automates backend deployment to Fly.io on push to `staging`:

```
.github/workflows/fly-deploy.yml
```

Required GitHub secret: `FLY_API_TOKEN`

### Docker (Backend)

```bash
# Build
docker build -t codedock-server .

# Run
docker run -p 8080:8080 \
  -e DB_HOST=... \
  -e DB_PORT=5432 \
  -e DB_USER=... \
  -e DB_PASSWORD=... \
  -e DB_NAME=... \
  -e DB_SSLMODE=require \
  -e JWT_SECRET=... \
  -e WEB_ALLOWED_ORIGINS=http://localhost:3000 \
  codedock-server
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with a clear message: `git commit -m "feat: describe your change"`
4. Push and open a pull request against `staging`

**Before submitting:**
- Run `go test ./...` — all tests must pass
- Run `go vet ./...` — no vet errors
- Run `npm run build` inside `codedock-web/` — build must succeed
- Do not commit `.env`, `.env.local`, or any secrets

---

## License

See [LICENSE](LICENSE) for details.

---

*Built by [@jerryjuche](https://github.com/jerryjuche)*