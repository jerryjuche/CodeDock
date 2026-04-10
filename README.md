# CodeDock
CodeDock is a self-hosted, low-latency collaborative coding platform that enables multiple developers to edit code simultaneously inside their editor, with real-time synchronization, presence awareness, and integrated team communication.


Below is a clean compiled handoff brief you can paste into a new chat to continue the work without losing context.

---

# CodeDock — Deployment + Hosting Decision Handoff Brief

## Full summary and next-session continuation pack

### April 10, 2026

This handoff captures the current state of CodeDock, the hosting decisions already reasoned through, what changed, what is now recommended, and the exact next direction.

Primary source project handoff reviewed in this session: 

---

## 1. Project identity

**Project:** CodeDock
**Repo:** `github.com/jerryjuche/CodeDock`
**Core product:** self-hosted real-time collaborative coding platform for VS Code and compatible editors
**Core stack:**

* Go backend
* PostgreSQL
* WebSocket gateway
* Yjs/CRDT sync
* VS Code extension in TypeScript

The product requires **persistent realtime collaboration**. The most important infrastructure fact is that the collaboration layer depends on a stable WebSocket backend. Sleep-based hosting is therefore a serious architectural problem, not just an inconvenience. 

---

## 2. Build status from the prior handoff

Backend and extension are already far along.

### Backend completed

* database schema/migrations
* JWT auth
* room management
* WebSocket gateway
* CRDT relay
* snapshot service
* invite token exchange

### Extension completed

* orchestrator/lifecycle
* auth
* API client
* WebSocket manager
* Yjs sync
* cursor manager
* chat panel
* protocol/types/utils

### Testing state

* 60 tests
* zero failures
* total coverage around 66.7%

These details came from the uploaded project handoff and remain the baseline technical status. 

---

## 3. Original hosting decision from older handoff

The earlier plan was:

* **Koyeb** for the Go backend
* **Supabase** for PostgreSQL

That earlier decision existed because Koyeb had been treated as a free always-on backend option and Render had been ruled out due to sleep. The older handoff explicitly chose Koyeb because sleep is catastrophic for CodeDock’s WebSocket sessions. 

---

## 4. What changed

During this session, current platform reality was re-evaluated.

### Updated conclusion about Koyeb

Koyeb is no longer a clean answer for the “fully free, always-on” requirement.

The practical outcome:

* Koyeb is no longer the preferred zero-cost persistent backend target for CodeDock
* if Koyeb requires Pro for the setup being attempted, it should not be forced at this stage
* paying for Koyeb Pro is not justified for this current phase

### Why this matters

CodeDock is not just an HTTP app. It is a persistent collaborative system using WebSockets. That means the backend host must be treated as part of the collaboration protocol itself.

So the hosting decision has now changed.

---

## 5. Current recommended infrastructure direction

## Recommended architecture now

### Core recommendation

* **Oracle Cloud Always Free VM** → host the Go backend and the WebSocket server
* **Supabase Free** → managed PostgreSQL
* **Appwrite is optional and not core**

### Stronger refined recommendation

If a managed platform is needed beyond the raw VM, use:

* **Oracle VM** for the realtime collaboration backend
* **Supabase** for the non-WebSocket app layer

This became the preferred replacement for using Appwrite as the supporting layer.

---

## 6. Decision on Appwrite

Appwrite was considered.

### Conclusion

Appwrite is **not** the preferred answer for CodeDock’s current hosting problem.

Why:

* Appwrite is better for app-platform features than for hosting the existing custom Go collaboration server
* it does not cleanly replace the Go + WebSocket + Yjs collaboration core
* using it as the main backend layer would push the project toward a broader architectural rewrite

### Acceptable use of Appwrite

Appwrite could still be used later for:

* storage
* auth-adjacent product surfaces
* registration portal support
* dashboard surfaces

But it is **not** the preferred supporting platform right now.

### Preferred alternative to Appwrite

**Supabase** is the preferred alternative because it aligns better with:

* the project’s Postgres foundation
* the existing Go architecture
* the need for a clean support layer without rewriting the collaboration system

---

## 7. Final hosting strategy now favored

## Best current stack for the project

### Minimal and practical

* Oracle Cloud Always Free Ubuntu VM
* Go backend running directly on the VM
* systemd to manage the process
* Caddy in front for HTTPS and reverse proxy
* Supabase Free for PostgreSQL

### Optional later additions

* Appwrite only if later needed for side features
* GitHub Actions deployment later
* Docker later if operational complexity grows

This is the leanest correct setup for proving realtime collaboration live at zero dollars.

---

## 8. Why Oracle Cloud is now the best fit

Oracle Cloud is a better fit than Koyeb for the current need because the project’s most important requirement is **control over a persistent WebSocket server**.

### What Oracle gives

Oracle gives a raw VM and infrastructure primitives.

### What that means

Oracle is not a managed deployment platform like Koyeb or Railway.

It means the developer becomes responsible for:

* server provisioning
* SSH access
* Linux setup
* reverse proxy
* HTTPS
* service restart behavior
* deployment method
* logging
* network rules
* operational management

### Why that is still acceptable

For this phase, the goal is not polished cloud automation.
The goal is:

* get the realtime system live
* validate multi-user collaboration
* test actual WebSocket behavior under a public server
* keep it at $0

Oracle fits that better than the managed platforms that no longer satisfy the free persistent-hosting constraint.

---

## 9. Oracle Cloud operating model that must be remembered

For this project, Oracle Cloud should be understood as:

**“a Linux server in the cloud that you control.”**

Not:

* push-to-deploy PaaS
* automatic platform restarts and SSL
* built-in GitHub deployment flow

### What will need to be set up on Oracle

* Ubuntu VM
* public IP
* SSH access
* security rules for ports
* Git and Go installed
* CodeDock source on the VM
* compiled Go binary
* systemd service for the app
* Caddy reverse proxy
* HTTPS via Caddy
* environment variables for DB and JWT
* manual deploy workflow initially

---

## 10. Minimal recommended Oracle setup

### Use this exact practical shape

* **Ubuntu VM**
* **Go binary directly**
* **systemd**
* **Caddy**
* **ports 22, 80, 443**
* **Supabase as DB**
* **manual deploy via SSH + git pull + go build + restart**

### Why direct Go binary first

Direct binary deployment is preferred over Docker at this stage because it is:

* easier to debug
* easier to understand
* fewer moving parts
* better for first live validation

Docker can come later.

### Why Caddy over Nginx first

Caddy is preferred initially because:

* simpler config
* easier HTTPS
* lower setup friction
* good fit for first deployment

---

## 11. How deployment should work initially

### Manual deployment flow

For now, deployment should be manual.

Typical process:

1. push code to GitHub
2. SSH into Oracle VM
3. `git pull`
4. `go build`
5. restart the `codedock` systemd service
6. inspect logs
7. test via extension

This is the best first live deployment model because it minimizes complexity while the product is still being validated.

### Not recommended yet

Do not start with:

* CI/CD-heavy deploy automation
* Kubernetes
* load balancers
* multiple app instances
* complex container orchestration

---

## 12. Operational controls and admin panel discussion

A custom admin panel was discussed.

### Conclusion

Yes, a broader control panel can be built.

### What is a good first version

The recommended first version is an **application operations dashboard**, not a full cloud control plane.

It should expose:

* backend health
* DB health
* uptime
* active WebSocket connections
* active rooms
* recent logs
* memory and CPU
* version/build info
* safe restart/status actions

### What it should not be

It should **not** be:

* a remote shell
* arbitrary command executor
* direct browser-to-Oracle control layer
* full VM power controls in v1

### Safe architecture for the control panel

Use:

* React admin UI
* secure backend admin endpoints
* optional safe wrapper around `systemd`
* audit logging for admin actions

### Safe actions to allow

* service status
* restart service
* stop service
* start service
* view app health and metrics

### Advanced later features

Potential future panel features:

* room inspector
* connection analytics
* snapshot diagnostics
* transport/reconnect metrics
* deploy history
* maintenance mode
* log filtering
* feature flags

---

## 13. Still-open important project items from the older handoff

The prior uploaded handoff identified open items that still matter. 

### Critical item still called out

In `internal/hub/hub.go`, inside `trackAndSnapshot()`, snapshots are still using a placeholder file path `"default"` and must be updated to parse the real file path from the binary payload. This is still an important backend correctness issue before final end-to-end confidence. 

### Other important pending items

* invite generation endpoint
* React web app / registration UI
* token refresh flow
* awareness file path correctness
* extension packaging
* status bar item

These were already identified in the uploaded project handoff and remain the broader roadmap after deployment. 

---

## 14. Current strategic conclusion

## Final stance after this whole session

### Do not do this now

* do not pay for Koyeb Pro
* do not treat Appwrite as the main collaboration backend
* do not overbuild the infrastructure before the first public realtime validation

### Do this instead

* move the backend host to Oracle Cloud Always Free
* keep the Go collaboration backend intact
* use Supabase as the preferred supporting managed backend service
* deploy with a minimal VM-based setup
* validate realtime collaboration live first
* add polish, automation, and broader control features later

---

## 15. Best next implementation order

Use this sequence next.

### Phase 1 — infrastructure foundation

1. create Oracle Cloud account
2. choose an Always Free eligible region with capacity
3. create a compartment for CodeDock
4. create VCN/subnet
5. launch Ubuntu VM on an Always Free eligible shape
6. assign public IP
7. open ports 22, 80, 443

### Phase 2 — server setup

8. SSH into VM
9. install Git, Go, and Caddy
10. clone CodeDock repo
11. build Go backend
12. set environment variables
13. create `systemd` service
14. start service and inspect logs

### Phase 3 — public routing

15. point domain/subdomain to VM public IP
16. configure Caddy reverse proxy
17. confirm HTTPS works
18. confirm backend reachable over public URL

### Phase 4 — correctness check

19. patch and verify `trackAndSnapshot()` real file path parsing if not yet done
20. run backend tests/build checks again
21. validate DB connectivity and app startup

### Phase 5 — realtime validation

22. update VS Code extension server URL
23. connect two clients
24. join same room
25. open same file
26. test sync, cursors, chat, reconnect

### Phase 6 — only after success

27. decide whether to add admin panel
28. decide whether to automate deploys
29. decide whether Appwrite is needed at all
30. continue with invite endpoint, web UI, and token refresh

---

## 16. Sharp summary in one paragraph

CodeDock is already technically advanced enough that the main blocker is no longer core product architecture but finding the right zero-cost hosting model for a persistent WebSocket backend. Koyeb is no longer the preferred free solution, Appwrite is not the right main backend fit, and the strongest current approach is Oracle Cloud Always Free for the Go/WebSocket server plus Supabase for the managed app/database layer. The next step is to deploy a minimal Oracle VM stack using Ubuntu, a direct Go binary, systemd, Caddy, and manual deploys, then run the first real public multi-user collaboration test. 

---

## 17. Paste-ready continuation prompt for the next chat

Use this in a new session:

```text
We are continuing CodeDock deployment planning.

Current decision:
- Do not use Koyeb Pro
- Oracle Cloud Always Free is now the preferred host for the Go backend and persistent WebSocket server
- Supabase is the preferred supporting backend service
- Appwrite is not the main backend choice and is optional later

Project:
- CodeDock is a self-hosted real-time collaborative coding platform
- Stack: Go backend, PostgreSQL, WebSocket, Yjs, VS Code extension
- The backend must stay stable for realtime WebSocket collaboration

Deployment approach chosen:
- Oracle Ubuntu VM
- Go binary directly on the VM
- systemd for service management
- Caddy for reverse proxy and HTTPS
- ports 22, 80, 443 open
- manual deployment first via SSH + git pull + go build + systemctl restart

Important pending backend issue:
- internal/hub/hub.go trackAndSnapshot() still needs to parse real file path from binary payload instead of using "default"

Please continue from here and help me do the Oracle deployment in the safest zero-cost way, step by step, without overengineering.
```

---

If you want, I can also turn this into a cleaner **formal markdown handoff document** you can save as `CodeDock_Oracle_Deployment_Handoff.md`.

