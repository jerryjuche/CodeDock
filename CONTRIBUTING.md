# Contributing to CodeDock

Thank you for your interest in contributing to CodeDock! We welcome contributions from developers of all skill levels to help make collaborative coding in VS Code better.

---

## Repository Structure

CodeDock is structured as a monorepos containing:
- **Root**: Go backend code (`main.go`, `internal/`, `migration/`).
- **`codedock-web`**: Next.js frontend application.
- **`extension`**: VS Code extension source code and build config.
- **`codedock-test-dashboard`**: Web dashboard for testing real-time events.

---

## Local Development Setup

To contribute to any part of CodeDock, you will need to clone the repository and set up the components locally.

### 1. Prerequisites
- **Go** (version 1.20 or later)
- **Node.js** (LTS version, 18 or later)
- **npm** or **pnpm**
- **VS Code** (for extension development)

### 2. Backend Setup (Go)
The backend acts as the signaling and Yjs sync server.
1. Install dependencies:
   ```bash
   go mod download
   ```
2. Set up environment variables. Copy `.env.example` to `.env` and fill in local configs:
   ```bash
   cp .env.example .env
   ```
3. Run the backend server locally:
   ```bash
   go run main.go
   ```

### 3. Frontend Setup (Next.js)
The frontend web app handles authentication, room creation, and invitations.
1. Navigate to the `codedock-web` directory:
   ```bash
   cd codedock-web
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment variables file and configure it:
   ```bash
   cp .env.example .env.local
   ```
4. Run the Next.js development server:
   ```bash
   npm run dev
   ```

### 4. Extension Setup (VS Code)
The VS Code extension integrates Yjs and WebSockets with editor states.
1. Navigate to the `extension` directory:
   ```bash
   cd extension
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Open the `extension` directory in VS Code.
4. Press **`F5`** (or go to **Run and Debug** -> click **Launch Extension**) to open a new VS Code window (Extension Development Host) running your local build.

---

## Code Guidelines & Standards

- **Go**: Follow standard Go formatting patterns (`go fmt`) and write comprehensive test suites where possible.
- **TypeScript**: We use ESLint and Prettier. Run linting commands before committing:
  ```bash
  # Inside extension or codedock-web
  npm run lint
  ```
- **Secrets**: **Never** commit `.env` or credential files. Ensure your changes respect `.gitignore` filters.

---

## Pull Request Guidelines

1. **Create a Branch**: Create a feature or bugfix branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Commit Messages**: Write clear, descriptive, and imperative commit messages (e.g. `feat: add posthog telemetry wrapper`).
3. **Verify Builds**: Ensure your code compiles locally:
   - Go: `go build`
   - Extension: `npm run compile` (under `extension/`)
   - Frontend: `npm run build` (under `codedock-web/`)
4. **Submit PR**: Open a Pull Request on GitHub with a description of your changes, links to related issues, and verification/testing steps.
