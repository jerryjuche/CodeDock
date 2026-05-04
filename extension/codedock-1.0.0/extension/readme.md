<div align="center">

<img src="https://raw.githubusercontent.com/jerryjuche/CodeDock/staging/extension/images/codedock.jpg" alt="CodeDock" width="160" />

# CodeDock

**Self-hosted real-time collaborative coding for VS Code**

Bring live collaboration directly into the editor — built for engineering teams that want speed, control, and full infrastructure ownership.

[![Install from Marketplace](https://img.shields.io/badge/Install-VS%20Code%20Marketplace-0078D4?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock)
&nbsp;
[![View on GitHub](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jerryjuche/CodeDock)
&nbsp;
[![Report an Issue](https://img.shields.io/badge/Report-Issue-EA4335?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jerryjuche/CodeDock/issues)

![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)
&nbsp;
![Self-Hosted](https://img.shields.io/badge/Self--Hosted-Yes-0F172A?style=flat-square)
&nbsp;
![Real-Time](https://img.shields.io/badge/Real--Time-Collaboration-06B6D4?style=flat-square)
&nbsp;
![Version](https://img.shields.io/badge/Version-0.1.4-7C3AED?style=flat-square)

</div>

---

## What is CodeDock?

CodeDock is a VS Code extension that enables real-time collaborative coding sessions without giving up control of your infrastructure.

It connects the editor to a self-hosted CodeDock backend — a Go server that handles rooms, presence, WebSocket sync, and session management. Your code and collaboration data stay on infrastructure you control, not a third-party cloud you depend on.

The workflow is simple:

1. A host creates a **room** from the CodeDock web control plane
2. Teammates join using a **6-character invite code**
3. Everyone opens the room in VS Code with a **one-click launch link**
4. The extension handles the rest — real-time sync, cursor presence, and chat

---

## Why CodeDock?

Most real-time collaboration tools bolt collaboration onto existing editors as an afterthought, or they require routing your code and session data through a third-party server you do not control.

CodeDock is built from the opposite direction:

| | CodeDock | Cloud-first tools |
|---|---|---|
| **Infrastructure** | You own it | Vendor-controlled |
| **Data routing** | Through your server | Third-party cloud |
| **Session persistence** | Your deployment | Vendor-managed |
| **Editor integration** | Native VS Code | Extension / plugin |
| **Team workflow** | Room-based, structured | Ad-hoc |

**The result:** fast, structured collaboration that stays inside the engineering environment you already work in.

---

## Features

### Available now

- **Authentication** — Log in to your CodeDock account from inside the editor. Your session is stored securely and persists across editor restarts.

- **Room management** — Create new collaboration rooms or join existing ones using a short invite code, directly from the VS Code command palette.

- **Integrated chat** — Open a dedicated chat panel inside the editor to communicate with room members without leaving VS Code.

- **Session control** — Connect to a room, see your active session state, and disconnect cleanly when done.

- **Self-hosted backend** — Point the extension at any CodeDock server you run. No mandatory cloud accounts or third-party routing.

- **Configurable server URL** — Set your backend URL once in VS Code settings and the extension connects automatically.

### Built-in technical capabilities

The extension ships with a full real-time collaboration engine underneath the current UI surface:

- **Yjs / CRDT document sync** — Conflict-free document state synchronization across all connected clients using the Yjs CRDT framework
- **WebSocket connection manager** — Persistent, auto-reconnecting WebSocket connection to the CodeDock server
- **Cursor presence** — Shared cursor and selection state across room members
- **Snapshot persistence** — Document state snapshots are stored server-side, so sessions survive disconnects
- **Protocol layer** — Typed message protocol for all client–server communication

### On the roadmap

- Live multi-user editing with visible cursor decorations
- Room member list with online/offline presence indicators
- Source-aware session launch (GitHub repo and local workspace modes)
- Richer chat panel with message history
- Notification support for room events

---

## Getting Started

### Requirements

- VS Code **1.85** or later
- A running **CodeDock backend** (self-hosted) — see [CodeDock on GitHub](https://github.com/jerryjuche/CodeDock) for setup
- A CodeDock account registered on your backend

### Installation

Install from the VS Code Marketplace:

1. Open VS Code
2. Press `Ctrl+P` (macOS: `Cmd+P`) to open Quick Open
3. Paste the following and press Enter:

```
ext install jerryjuche.codedock
```

Or search **CodeDock** in the Extensions panel (`Ctrl+Shift+X`).

**Manual install from `.vsix`:**

```bash
code --install-extension codedock-0.1.4.vsix
```

---

## Configuration

After installing, configure your backend URL in VS Code settings.

Open `settings.json` (`Ctrl+Shift+P` → *Preferences: Open User Settings (JSON)*) and add:

```json
{
  "codedock.serverUrl": "https://your-codedock-server.example.com"
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `codedock.serverUrl` | `string` | `https://codedock.fly.dev` | Base URL of your CodeDock backend server |

> If you are running the backend locally for development, set this to `http://localhost:8080`.

---

## Usage

All CodeDock commands are available from the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).

### Authenticate

```
CodeDock: Login
```

Enter your email and password. Your session token is stored securely in VS Code's secret storage.

```
CodeDock: Logout
```

Clears your session from the editor.

### Rooms

```
CodeDock: Create Room
```

Opens a prompt to create a new collaboration room. Provide a room name and source type.

```
CodeDock: Join Room
```

Enter a 6-character invite code to join an existing room.

```
CodeDock: Open Room in VS Code
```

When a room is ready and launch is enabled, opens the active collaboration session in your workspace.

### Chat & Session

```
CodeDock: Open Chat
```

Opens the integrated chat panel for the active room.

```
CodeDock: Disconnect
```

Ends your WebSocket connection and leaves the active session cleanly.

---

## How It Works

```
┌──────────────────────────────┐
│       VS Code + Extension    │
│                              │
│  Auth · Rooms · Chat · Sync  │
└──────────┬───────────────────┘
           │ WebSocket + REST
           │
┌──────────▼───────────────────┐
│     CodeDock Backend (Go)    │
│                              │
│  Auth · Rooms · WebSocket    │
│  Invite tokens · Snapshots   │
│  CRDT relay · Launch tokens  │
└──────────┬───────────────────┘
           │ SQL
           │
┌──────────▼───────────────────┐
│        PostgreSQL             │
│  Users · Rooms · Members     │
│  Snapshots · Invite tokens   │
└──────────────────────────────┘
```

The extension maintains a persistent WebSocket connection to the CodeDock server for real-time events. REST calls handle authentication, room management, and invite operations. Document state is synchronized using Yjs CRDTs, giving conflict-free merging of edits across all connected clients. Snapshots are periodically persisted server-side so sessions can survive client disconnects.

---

## Self-Hosting the Backend

The CodeDock extension is designed to connect to **your own backend**, not a shared cloud service.

To run your own CodeDock server:

1. Clone the repository: `git clone https://github.com/jerryjuche/CodeDock.git`
2. Configure your PostgreSQL database and environment variables
3. Apply the included migrations in `migration/`
4. Run `go run main.go` or deploy with the provided `Dockerfile`

Full backend setup documentation is available in the [repository README](https://github.com/jerryjuche/CodeDock#readme).

---

## Security

- Passwords are hashed with **bcrypt** at cost 12 on the server — they are never stored in plaintext
- Authentication tokens are **JWT**-based with server-side secret signing
- The extension stores your session token using **VS Code's built-in secret storage API**, not plaintext settings
- All communication between the extension and backend uses **HTTPS / WSS** in production
- CORS is enforced server-side — only your configured origin is accepted

---

## Compatibility

| Environment | Status |
|---|---|
| VS Code 1.85+ | ✅ Supported |
| VS Code Insiders | ✅ Supported |
| Cursor | Should work — untested |
| Windows | ✅ |
| macOS | ✅ |
| Linux | ✅ |

---

## Known Limitations

- Live co-editing decorations (visible remote cursors) are part of the underlying engine but not yet surfaced in the UI — this is the primary active development area
- The extension requires a network-accessible CodeDock backend — it does not work offline or in air-gapped environments without a locally running server
- Room creation from inside VS Code creates the room on the server but the full room setup flow (invites, source configuration) is managed from the web control plane

---

## Feedback & Issues

Found a bug or want to request a feature?

Open an issue on GitHub: [github.com/jerryjuche/CodeDock/issues](https://github.com/jerryjuche/CodeDock/issues)

Please include:
- Your VS Code version
- Your CodeDock extension version
- What you expected to happen
- What actually happened
- Any relevant output from the **Output panel** → `CodeDock` channel

---

## Changelog

See [CHANGELOG.md](https://github.com/jerryjuche/CodeDock/blob/staging/extension/CHANGELOG.md) for the full version history.

---

## License

[MIT](https://github.com/jerryjuche/CodeDock/blob/staging/extension/LICENSE)

---

<div align="center">

Built by [jerryjuche](https://github.com/jerryjuche) &nbsp;·&nbsp; [GitHub](https://github.com/jerryjuche/CodeDock) &nbsp;·&nbsp; [Report Issue](https://github.com/jerryjuche/CodeDock/issues)

</div>