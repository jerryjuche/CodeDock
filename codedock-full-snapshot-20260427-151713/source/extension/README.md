<div align="center">

<img src="./images/codedock.jpg" alt="CodeDock Logo" width="140" />

# CodeDock

### Self-hosted real-time collaborative coding for VS Code

<p>
  Bring live collaboration directly into the editor — built for engineering teams that want speed, ownership, and control.
</p>

<p>
  <a href="https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock">
    <img src="https://img.shields.io/badge/Install-VS%20Code%20Marketplace-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install from VS Code Marketplace" />
  </a>
  <a href="https://github.com/jerryjuche/CodeDock">
    <img src="https://img.shields.io/badge/View-Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="View Repository" />
  </a>
  <a href="https://github.com/jerryjuche/CodeDock/issues">
    <img src="https://img.shields.io/badge/Report-Issue-EA4335?style=for-the-badge&logo=github&logoColor=white" alt="Report Issue" />
  </a>
</p>

<p>
  <img src="https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white" alt="VS Code 1.85+" />
  <img src="https://img.shields.io/badge/Self--Hosted-Yes-0F172A?style=flat-square" alt="Self Hosted" />
  <img src="https://img.shields.io/badge/Real--Time-Collaboration-06B6D4?style=flat-square" alt="Real Time Collaboration" />
  <img src="https://img.shields.io/badge/Powered%20by-VS%20Code%20Extension-7C3AED?style=flat-square" alt="VS Code Extension" />
</p>

</div>

---

## Overview

CodeDock is a VS Code extension built to make collaborative coding feel native inside the editor.

Instead of pushing developers into disconnected tools and fragmented workflows, CodeDock brings real-time collaboration closer to the code itself. It is designed for teams that want a fast, integrated experience while still keeping control of their own infrastructure.

Whether you are pairing on a feature, coordinating within a shared room, or building a self-hosted engineering workflow, CodeDock is built to keep collaboration where it belongs: inside the development environment.

---

## Why CodeDock

Most collaboration tools treat code like just another document.

CodeDock is built from a different philosophy.

It is designed specifically for software teams that need live coordination without giving up control of their stack. The extension connects VS Code to a self-hosted backend, giving teams the ability to collaborate in real time while keeping infrastructure, deployment, and workflow ownership in their hands.

### Core principles

- **Self-hosted first**  
  Run collaboration on infrastructure you control.

- **Built for engineers**  
  Designed around development workflows, not generic document editing.

- **Native to the editor**  
  Work where your code already lives.

- **Real-time by design**  
  Collaboration is part of the product foundation, not an afterthought.

- **Structured for growth**  
  Built to evolve into a richer collaborative development platform.

---

## Features

### Current capabilities

- Login and logout from inside VS Code
- Create collaboration rooms
- Join existing rooms
- Open integrated chat
- Disconnect from active room sessions
- Configure a custom backend server URL
- Connect to self-hosted CodeDock infrastructure

### Platform direction

CodeDock is being developed toward a more complete collaborative development experience, including support for:

- live multi-user editing
- synchronized collaboration state
- room-based workflows
- team presence
- persistent collaboration sessions
- richer editor-native communication

---

## Quick Start

### 1. Install CodeDock

Install the extension from the VS Code Marketplace or from a local `.vsix` package.

### 2. Configure your backend

Set your backend URL in VS Code settings:

```json
{
  "codedock.serverUrl": "https://codedock.fly.dev"
}