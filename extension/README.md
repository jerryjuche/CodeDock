# CodeDock

Self-hosted real-time collaborative coding for VS Code.
Own your server. Own your data. No SaaS subscription.

---

## Requirements

A running CodeDock backend. See:
https://github.com/jerryjuche/CodeDock

---

## Installation

1. Install the extension from the VS Code Marketplace
   or press `F5` inside the `extension/` folder to run in development mode.

2. Configure your backend URL in VS Code settings:
   - Open Settings → search for `codedock`
   - Set `CodeDock: Server URL` to your backend address
   - Default: `http://localhost:8080`

---

## Commands

| Command                          | Description                         |
| -------------------------------- | ----------------------------------- |
| `CodeDock: Login`                | Log in to your CodeDock account     |
| `CodeDock: Logout`               | Log out and clear session           |
| `CodeDock: Join Room`            | Join an existing collaboration room |
| `CodeDock: Create Room`          | Create a new collaboration room     |
| `CodeDock: Open Chat`            | Open the integrated chat panel      |
| `CodeDock: Disconnect from Room` | Disconnect from current room        |

---

## Configuration

| Setting              | Default                 | Description                       |
| -------------------- | ----------------------- | --------------------------------- |
| `codedock.serverUrl` | `http://localhost:8080` | Base URL of your CodeDock backend |

---

## Development Setup

```bash
# clone the repository
git clone https://github.com/jerryjuche/CodeDock
cd CodeDock/extension

# install dependencies
npm install

# compile TypeScript
npm run compile

# watch mode — recompiles on save
npm run watch
```

Press `F5` in VS Code with the `extension/` folder open to launch the
Extension Development Host.

---

## Running The Backend

The backend must be running before the extension can connect.

```bash
# from the CodeDock repository root
go run main.go
```

---

## Known Limitations

- No token refresh — sessions expire after 24 hours and require re-login
- Invite token UI not yet built — room sharing requires manual ID exchange
- Cursor awareness does not include file path — remote cursors only render
  correctly when both users are editing the same file

---

## License

MIT
