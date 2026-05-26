<div align="center">

<img src="https://code-dock-beige.vercel.app/brand/codedock-logo.png" alt="CodeDock" width="160" />

# CodeDock

**Self-hosted room-based collaboration for VS Code, with launch support for VS Code and Antigravity.**

Create shared sessions from your CodeDock backend, join with a short invite code, and open your workspace when the session is ready.

[![Install from Marketplace](https://img.shields.io/badge/Install-VS%20Code%20Marketplace-0078D4?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock)
&nbsp;
[![View on GitHub](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jerryjuche/CodeDock)
&nbsp;
[![Report an Issue](https://img.shields.io/badge/Report-Issue-EA4335?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jerryjuche/CodeDock/issues)

![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)
&nbsp;
![Self-Hosted](https://img.shields.io/badge/Self--Hosted-Yes-0F172A?style=flat-square)
&nbsp;
![Launch Targets](https://img.shields.io/badge/Launch-VS%20Code%20%7C%20Antigravity-06B6D4?style=flat-square)
&nbsp;
![Version](https://img.shields.io/badge/Version-2.8.0-7C3AED?style=flat-square)

</div>

---

## Overview

CodeDock is a VS Code extension that connects your editor to a self-hosted CodeDock backend. It provides room-based collaboration, invite-driven joins, and ready-state workspace launch flows.

The extension supports both **VS Code** and **Antigravity** launch targets through the shared room workflow.

## Highlights

- Self-hosted collaboration using your own CodeDock backend
- Room-based workflow with host/guest separation
- Invite-code based join flow
- Launch rooms to **VS Code** or **Antigravity**
- Secure auth token storage in VS Code secret storage
- Live session state and workspace readiness checks

## Features

- **Create and join rooms** from the VS Code command palette
- **Open rooms only when ready** so guests land in a hydrated session
- **Launch target selection** for VS Code or Antigravity editors
- **Integrated chat, presence, and session controls**
- **Backend configuration** via extension settings
- **Built for self-hosted deployments** and private teams

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
code --install-extension codedock-3.0.0.vsix
```

---

## Configuration

After installing, configure your backend URL in VS Code settings.

Open `settings.json` (`Ctrl+Shift+P` → _Preferences: Open User Settings (JSON)_) and add:

```json
{
  "codedock.serverUrl": "https://your-codedock-server.example.com"
}
```

| Setting              | Type     | Default                    | Description                              |
| -------------------- | -------- | -------------------------- | ---------------------------------------- |
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

## Support

- Web App: https://code-dock-beige.vercel.app
- GitHub: https://github.com/jerryjuche/CodeDock
- Issues: https://github.com/jerryjuche/CodeDock/issues
- Marketplace: https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock

---

### Notes for marketplace listing

- Supports launch targets: **VS Code** and **Antigravity**
- Designed for **self-hosted backend deployments**
- Ideal for teams that need structured, invite-based collaboration

---

## License

MIT

<div align="center">
Built by [jerryjuche](https://github.com/jerryjuche) · [GitHub](https://github.com/jerryjuche/CodeDock)
</div>

┌──────────▼───────────────────┐
│ PostgreSQL │
│ Users · Rooms · Members │
│ Snapshots · Invite tokens │
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
```
