<div align="center">

<img src="https://code-dock-beige.vercel.app/brand/codedock-logo.png" alt="CodeDock" width="140" />

<br />

# CodeDock

**Self-hosted real-time collaborative coding for VS Code**

Built for developers and teams that need a simple room-based workflow, reliable launch flow, and native VS Code collaboration.

<br />

[![Open CodeDock](https://img.shields.io/badge/Open-CodeDock%20Web%20App-111827?style=for-the-badge&logo=vercel&logoColor=white)](https://code-dock-beige.vercel.app)
[![Create Account](https://img.shields.io/badge/Create-Account-22C55E?style=for-the-badge&logo=auth0&logoColor=white)](https://code-dock-beige.vercel.app/register)
[![Install from Marketplace](https://img.shields.io/badge/Install-VS%20Code%20Marketplace-0078D4?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock)
[![View on GitHub](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jerryjuche/CodeDock)
[![Report an Issue](https://img.shields.io/badge/Report-Issue-EA4335?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jerryjuche/CodeDock/issues)

<br />

![Version](https://img.shields.io/badge/Version-0.1.4-7C3AED?style=flat-square)
![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)
![Self-Hosted](https://img.shields.io/badge/Self--Hosted-Yes-0F172A?style=flat-square)
![Room Based](https://img.shields.io/badge/Room--Based-Workflow-F97316?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)

</div>

---

## What is CodeDock?

CodeDock is a VS Code extension plus a web control plane for room-based collaboration.

It helps hosts create rooms, share workspace sessions, and lets guests open the room in VS Code only when the session is ready.

The extension handles launch tokens, workspace binding, and live room state for the editor.

---

## Quick Start

1. Install the extension: [Marketplace](https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock)
2. Open the web app: [https://code-dock-beige.vercel.app](https://code-dock-beige.vercel.app)
3. Register: [https://code-dock-beige.vercel.app/register](https://code-dock-beige.vercel.app/register)
4. Log in: [https://code-dock-beige.vercel.app/login](https://code-dock-beige.vercel.app/login)
5. Create a room and share the invite code
6. Open the room in VS Code with **Open IDE**

---

## Features

* Room-based collaboration with host/guest separation
* Invite-code join flow
* Web app launches VS Code through the extension
* Guests wait until the host source is ready
* Configurable backend and web app URL
* Periodic update checks for the extension

---

## VS Code Commands

* `codedock.login` — sign in
* `codedock.logout` — sign out
* `codedock.joinRoom` — join a room
* `codedock.createRoom` — create a room
* `codedock.openWebApp` — open the web app
* `codedock.disconnectRoom` — leave the room

---

## Important Links

* Web App: [https://code-dock-beige.vercel.app](https://code-dock-beige.vercel.app)
* Register: [https://code-dock-beige.vercel.app/register](https://code-dock-beige.vercel.app/register)
* Login: [https://code-dock-beige.vercel.app/login](https://code-dock-beige.vercel.app/login)
* Marketplace: [https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock](https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock)
* GitHub: [https://github.com/jerryjuche/CodeDock](https://github.com/jerryjuche/CodeDock)
* Issues: [https://github.com/jerryjuche/CodeDock/issues](https://github.com/jerryjuche/CodeDock/issues)

---

## Requirements

* VS Code 1.85 or newer
* CodeDock extension installed
* CodeDock account from the web app
* Access to your CodeDock backend or hosted service

---

## Configuration

Settings under `codedock`:

* `serverUrl` — backend API endpoint
* `webAppUrl` — web app URL opened by the extension
* `autoUpdate` — enable release checks
* `updateCheckIntervalMinutes` — how often checks run

---

## License

MIT
