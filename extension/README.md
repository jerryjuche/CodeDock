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

1. Install CodeDock from the VS Code Marketplace or manually install the generated `.vsix`.
2. Configure `codedock.serverUrl` in VS Code settings.
3. Run `CodeDock: Login` and sign in with your CodeDock account.
4. Create a room or join an existing room using an invite code.
5. Open the room and choose **VS Code** or **Antigravity** when launching.

## Commands

Available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `CodeDock: Login`
- `CodeDock: Logout`
- `CodeDock: Join Room`
- `CodeDock: Create Room`
- `CodeDock: Open Chat`
- `CodeDock: Disconnect from Room`
- `CodeDock: Show Actions`
- `CodeDock: Open CodeDock Web App`
- `CodeDock: Show CodeDock Logs`

## Settings

| Setting              | Description                           |
| -------------------- | ------------------------------------- |
| `codedock.serverUrl` | Base URL of the CodeDock backend API  |
| `codedock.webAppUrl` | URL of the CodeDock web control plane |

**Example:**

```json
{
  "codedock.serverUrl": "https://your-codedock-server.example.com",
  "codedock.webAppUrl": "https://code-dock-beige.vercel.app/"
}
```

## Requirements

- VS Code **1.85** or newer
- A running CodeDock backend
- A CodeDock account registered on the backend

## Installation

### Marketplace install

Search for **CodeDock** in the VS Code Extensions view, or run:

```bash
ext install jerryjuche.codedock
```

### Manual install from `.vsix`

```bash
code --install-extension codedock-3.0.0.vsix
```

## Troubleshooting

- If launch fails, verify `codedock.serverUrl` and `codedock.webAppUrl`
- Ensure the backend is reachable from your editor environment
- Check the **CodeDock** output channel for detailed logs
- Report bugs at [github.com/jerryjuche/CodeDock/issues](https://github.com/jerryjuche/CodeDock/issues)

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
