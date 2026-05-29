<div align="center">

<img src="https://code-dock-beige.vercel.app/brand/codedock-logo.png" alt="CodeDock" width="140" />

# CodeDock

**Real-time collaborative coding sessions for VS Code and Antigravity — room-based, invite-driven, self-hosted.**

Create a room from the web, invite your team, and launch straight into a shared coding session in **VS Code** or **Antigravity** with real-time document sync, cursor presence, and integrated chat.

---

[🌐 Web App](https://code-dock-beige.vercel.app) &nbsp;·&nbsp; [📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock) &nbsp;·&nbsp; [💻 GitHub](https://github.com/jerryjuche/CodeDock) &nbsp;·&nbsp; [🐛 Report Issue](https://github.com/jerryjuche/CodeDock/issues)

---

[![Install from Marketplace](https://img.shields.io/badge/Install-VS%20Code%20Marketplace-0078D4?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock)
&nbsp;
[![Open Web App](https://img.shields.io/badge/Open-Web%20App-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://code-dock-beige.vercel.app)
&nbsp;
[![View on GitHub](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jerryjuche/CodeDock)

![Version](https://img.shields.io/badge/Version-3.1.0-7C3AED?style=flat-square)
&nbsp;
![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)
&nbsp;
![Launch Targets](https://img.shields.io/badge/Launch-VS%20Code%20%7C%20Antigravity-06B6D4?style=flat-square)
&nbsp;
![Self-Hosted](https://img.shields.io/badge/Backend-Self--Hosted-0F172A?style=flat-square)
&nbsp;
![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)

</div>

---

## What is CodeDock?

CodeDock is a **full-stack collaborative coding platform** that replaces ad-hoc screen sharing with structured, room-based coding sessions. It consists of three integrated components:

| Component | Description |
|-----------|-------------|
| **Web Control Plane** | Create rooms, manage invites, toggle room activation, and monitor session activity — all from your browser. |
| **VS Code / Antigravity Extension** | Join rooms, sync documents in real time, see teammates' cursors, and chat — works in both **VS Code** and **Antigravity**. |
| **Self-Hosted Backend** | A Go server you own and operate. JWT auth, PostgreSQL persistence, WebSocket relay — no third-party dependencies. |

> **💡 Quick Access Links**
>
> | Resource | URL |
> |----------|-----|
> | Web App | [code-dock-beige.vercel.app](https://code-dock-beige.vercel.app) |
> | VS Code Marketplace | [marketplace.visualstudio.com](https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock) |
> | GitHub Repository | [github.com/jerryjuche/CodeDock](https://github.com/jerryjuche/CodeDock) |
> | Issue Tracker | [github.com/jerryjuche/CodeDock/issues](https://github.com/jerryjuche/CodeDock/issues) |

---

## How It Works

```
1. Create a Room          →  From the web control plane, choose a local workspace or GitHub repo
2. Invite Teammates       →  Share a short join code or a generated invite token
3. Activate the Room      →  Toggle the room "active" so guests can join
4. Launch into Your IDE   →  One-click deep-link opens VS Code or Antigravity with the correct workspace
5. Collaborate Live       →  Real-time document sync, live cursors, and integrated chat
```

### Host Flow

1. Sign in at [code-dock-beige.vercel.app](https://code-dock-beige.vercel.app)
2. Create a new room from the dashboard
3. Configure the source — local workspace or GitHub repository
4. Share the invite code with your team
5. Toggle the room **Active** and click **Open IDE** → choose **VS Code** or **Antigravity**
6. Your chosen editor opens, the session starts, and guests can join

### Guest Flow

1. Receive an invite code from the host
2. Join via the web app or directly in VS Code with `CodeDock: Join Room`
3. Once the host activates the room, click **Open IDE** → choose **VS Code** or **Antigravity**
4. Your chosen editor opens with the workspace automatically synced and ready

---

## Features

### 🔄 Real-Time Document Sync (CRDT)
Conflict-free document synchronization powered by [Yjs](https://github.com/yjs/yjs). Every keystroke is propagated to all participants through a binary WebSocket protocol — no polling, no delays, no merge conflicts.

### 👥 Live Cursor Presence
See where your teammates are typing in real time. Each participant gets a uniquely colored cursor with their email displayed inline, with automatic cleanup of stale cursors.

### 💬 Integrated Chat
A built-in chat panel directly inside VS Code. Send messages without leaving your editor — all communication flows through the same WebSocket connection.

### 🚀 One-Click Launch — VS Code & Antigravity
Generate a secure, one-time deep-link from the web control plane that opens **VS Code** or **Antigravity** directly into the correct workspace and starts the collaboration session automatically. Choose your preferred editor from the launch modal — no manual configuration needed.

### 🏠 Room-Based Workflow
Create, activate, and manage rooms from a dedicated web dashboard. Rooms support host/guest separation, invite-code access, activation toggles, and workspace readiness checks before guests can join.

### 📂 Workspace Hydration
Guests automatically receive the host's workspace structure. The extension handles workspace manifest exchange, file bootstrapping, and incremental sync so every participant sees the same project.

### 🔗 GitHub Repository Support
Link rooms directly to a GitHub repository. The extension automatically clones the repo to a managed `~/.codedock/rooms/` directory, checks out the correct branch, and keeps it synced.

### 📊 Activity Timeline & Code Review
Track every edit, join, and connection event through the web dashboard's activity timeline. Review per-member code contributions with a full diff viewer — see exactly what each teammate changed, line by line.

### 🔐 Secure Authentication
JWT-based auth with bcrypt password hashing. Tokens are stored securely in VS Code's built-in secret storage — never written to disk or exposed in settings.

### 🔌 Automatic Reconnection
If the WebSocket connection drops, the extension automatically reconnects with exponential backoff and jitter. Queued messages are flushed on reconnection so no edits are lost.

---

## Getting Started

### 1. Install the Extension

**From the VS Code Marketplace:**

Search for **"CodeDock"** in the Extensions view (`Ctrl+Shift+X`), or run from the command palette:

```
ext install jerryjuche.codedock
```

**Manual install from `.vsix`:**

```bash
code --install-extension codedock-3.1.0.vsix
```

### 2. Configure the Backend

Open VS Code Settings (`Ctrl+,`) and set:

```json
{
  "codedock.serverUrl": "https://codedock.fly.dev",
  "codedock.webAppUrl": "https://code-dock-beige.vercel.app/"
}
```

> If you're running a self-hosted backend, point `codedock.serverUrl` to your server's URL.

### 3. Sign In

Open the command palette (`Ctrl+Shift+P`) and run:

```
CodeDock: Login
```

Enter your CodeDock account credentials. Your auth token is securely stored in VS Code's secret storage.

### 4. Create or Join a Room

- **Create:** Open a project folder, then run `CodeDock: Create Room`
- **Join:** Run `CodeDock: Join Room` and enter the room ID or invite code
- **From the Web:** Use the web control plane at [code-dock-beige.vercel.app](https://code-dock-beige.vercel.app) to create a room and click **Open IDE**

---

## Commands

All commands are available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `CodeDock: Login` | Sign in to your CodeDock account |
| `CodeDock: Logout` | Sign out and clear stored credentials |
| `CodeDock: Create Room` | Create a new collaboration room from the current workspace |
| `CodeDock: Join Room` | Join an existing room by ID or invite code |
| `CodeDock: Open Chat` | Open the integrated chat panel |
| `CodeDock: Disconnect from Room` | Leave the current collaboration session |
| `CodeDock: Show Actions` | Open the CodeDock quick-action menu |
| `CodeDock: Open CodeDock Web App` | Open the web control plane in your browser |
| `CodeDock: Show CodeDock Logs` | Open the output channel for debugging |

> **Tip:** Click the **$(rocket) CodeDock** status bar item (bottom-right) to quickly access all actions.

---

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codedock.serverUrl` | `https://codedock.fly.dev` | Base URL of the CodeDock backend API |
| `codedock.webAppUrl` | `https://code-dock-beige.vercel.app/` | URL of the CodeDock web control plane |

---

## Requirements

| Requirement | Details |
|-------------|---------|
| **VS Code / Antigravity** | VS Code **1.85+** or Antigravity with CodeDock extension installed |
| **CodeDock Backend** | A running CodeDock server (self-hosted or the default `codedock.fly.dev`) |
| **Account** | A registered CodeDock account on the backend |
| **Network** | WebSocket connectivity to the backend server |

---

## Web Control Plane

The web app at [code-dock-beige.vercel.app](https://code-dock-beige.vercel.app) is the primary management interface:

- **Dashboard** — View all your rooms, their activation status, and connected members
- **Room Details** — Manage source configuration, invites, member presence, and launch controls
- **Invite Management** — Generate and revoke invite tokens for controlled access
- **Activity Timeline** — Track member joins, connections, and file edits in real time
- **Code Review** — View per-member code contributions with a side-by-side diff viewer
- **IDE Launch** — Generate secure deep-links to open rooms directly in VS Code or Antigravity

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Launch link doesn't open VS Code | Verify `codedock.serverUrl` points to the backend, not the web app |
| "Room is not available" | The host hasn't activated the room yet — wait or ask the host to toggle activation |
| WebSocket disconnects frequently | Check network connectivity; the extension will auto-reconnect with backoff |
| Guest can't see host's files | Ensure the host has opened a project folder and the room is active |
| Auth token expired | Run `CodeDock: Login` to re-authenticate |

For detailed debugging, run `CodeDock: Show CodeDock Logs` to view the output channel.

**Still stuck?** [Open an issue on GitHub →](https://github.com/jerryjuche/CodeDock/issues)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│              Web Control Plane                   │
│         Next.js 15 · Vercel-hosted               │
│   Dashboard · Rooms · Invites · Launch · Review  │
└──────────────────┬───────────────────────────────┘
                   │ HTTPS / REST
┌──────────────────▼───────────────────────────────┐
│              Go Backend Server                   │
│         net/http · Fly.io-hosted                 │
│   Auth · Rooms · Invites · WebSocket Gateway     │
│   CRDT Relay · Snapshot Persistence              │
└─────────┬────────────────────┬───────────────────┘
          │ SQL                │ WebSocket (wss://)
┌─────────▼─────────┐  ┌──────▼───────────────────┐
│    PostgreSQL      │  │   VS Code Extension      │
│    (Supabase)      │  │   Yjs/CRDT Sync Engine   │
└────────────────────┘  │   Cursor Presence        │
                        │   Chat · Auth Client     │
                        └──────────────────────────┘
```

| Layer | Technology |
|-------|------------|
| Backend | Go, `net/http`, `gorilla/websocket`, JWT, bcrypt |
| Database | PostgreSQL (Supabase or self-hosted) |
| Real-time Sync | Yjs CRDT over binary WebSocket protocol |
| Frontend | Next.js 15, React, TypeScript, Tailwind CSS |
| Extension | TypeScript, esbuild, VS Code Extension API, `ws` |

---

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the [repository](https://github.com/jerryjuche/CodeDock)
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and commit: `git commit -m "feat: describe your change"`
4. Push and open a pull request against `staging`

**Before submitting:** ensure all backend tests pass with `go test ./...` and the frontend builds with `npm run build` inside `codedock-web/`.

---

## License

[MIT](LICENSE) — Copyright © 2026 [Jerry Juche](https://github.com/jerryjuche)

---

<div align="center">

**Built with 🚀 by [@jerryjuche](https://github.com/jerryjuche)**

[Web App](https://code-dock-beige.vercel.app) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock) · [GitHub](https://github.com/jerryjuche/CodeDock) · [Issues](https://github.com/jerryjuche/CodeDock/issues)

</div>
