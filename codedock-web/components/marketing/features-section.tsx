const features = [
  {
    label: "Own your infrastructure",
    description:
      "Deploy CodeDock to any server you control. No third-party relay, no vendor lock-in, no data leaving your network.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    label: "Room-based workflow",
    description:
      "Scope every session to a named room. Create, invite, track readiness, and launch — all from one control plane.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "VS Code native",
    description:
      "Rooms open directly into VS Code Remote sessions. No browser-based editor compromise — use the real tool.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    label: "Invite control",
    description:
      "Generate scoped invite codes per room. Grant access precisely — no org-wide blast, no accidental exposure.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    label: "Launch readiness",
    description:
      "Know at a glance if a room is ready to accept connections. Status checks surface blockers before the session starts.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    label: "Team-scale sessions",
    description:
      "Designed for engineering orgs. Manage multiple active rooms, track collaborators, and maintain session hygiene.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
];

export default function FeaturesSection() {
  return (
    <section className="border-b border-white/[0.07] py-14">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[rgb(36,166,242)]">
            Features
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            Everything a team session needs
          </h2>
        </div>
        <p className="hidden max-w-xs text-sm leading-relaxed text-[rgb(158,183,211)] sm:block">
          No noise, no consumer-app compromises — built for the engineer&apos;s workflow.
        </p>
      </div>

      <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3 bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.07]">
        {features.map((f) => (
          <div
            key={f.label}
            className="bg-[rgba(4,22,49,0.95)] p-6 transition hover:bg-[rgba(8,30,63,0.95)]"
          >
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(36,166,242,0.10)] text-[rgb(36,166,242)]">
              {f.icon}
            </div>
            <div className="text-sm font-semibold text-white">{f.label}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-[rgb(158,183,211)]">
              {f.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
