import Link from "next/link";
import MarketingShell from "@/components/marketing/marketing-shell";
import TextRotate from "@/components/fancy/text/text-rotate";

export default function HomePage() {
  return (
    <MarketingShell>
      <main className="grid items-center gap-12 pb-12 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pb-16 lg:pt-20">
        {/* ── Left column ─────────────────────────────────── */}
        <section className="max-w-3xl space-y-10">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(36,166,242,0.28)] bg-[rgba(36,166,242,0.08)] px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgb(36,166,242)]" />
            <span className="text-xs font-medium tracking-widest text-[rgb(36,166,242)] uppercase">
              Self-hosted · VS Code
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-5">
            <h1 className="text-balance text-[42px] font-semibold leading-[1.08] tracking-tight text-white sm:text-[52px] lg:text-[58px]">
              Collaborative coding
              <br className="hidden sm:block" />
              {" "}that feels{" "}
              <TextRotate
                texts={["owned", "stable", "fast", "focused", "professional"]}
              />
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[rgb(158,183,211)]">
              CodeDock gives engineering teams a control plane for shared VS Code
              sessions, room lifecycle, invites, and launch readiness — without
              sacrificing ownership.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-[rgb(239,102,46)] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(239,102,46,0.32)] transition hover:bg-[rgb(249,145,53)] hover:shadow-[0_0_36px_rgba(239,102,46,0.44)]"
            >
              Create account
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.05] px-5 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.09]"
            >
              Log in
            </Link>
          </div>

          {/* Feature cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: (
                  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
                    <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                ),
                title: "Own your stack",
                body: "Deploy and operate collaboration on your own infrastructure.",
              },
              {
                icon: (
                  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M4 10a6 6 0 1 1 12 0A6 6 0 0 1 4 10Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 7v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
                title: "Room workflow",
                body: "Create rooms, invite collaborators, and launch into VS Code.",
              },
              {
                icon: (
                  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M3 5h14M3 10h14M3 15h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ),
                title: "Control plane first",
                body: "Manage session readiness, access, and launch from one place.",
              },
            ].map(({ icon, title, body }) => (
              <div
                key={title}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition hover:border-white/[0.12] hover:bg-white/[0.06]"
              >
                <div className="mb-3 inline-flex rounded-lg border border-white/[0.08] bg-white/[0.06] p-2 text-[rgb(36,166,242)]">
                  {icon}
                </div>
                <div className="text-sm font-semibold text-white">{title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-[rgb(158,183,211)]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Right column — "Why CodeDock" panel ─────────── */}
        <section className="lg:justify-self-end">
          <div className="relative w-full max-w-[420px] overflow-hidden rounded-[20px] border border-white/[0.08] bg-[rgba(8,30,63,0.72)] p-7 shadow-[0_24px_64px_rgba(0,0,0,0.36)] backdrop-blur-2xl">

            {/* Subtle inner glow top-right */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[rgba(36,166,242,0.07)] blur-3xl"
            />

            <div className="relative space-y-6">
              {/* Panel header */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgb(36,166,242)]">
                  Why CodeDock
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(42,211,139,0.12)] px-2.5 py-1 text-[10px] font-medium text-[rgb(42,211,139)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[rgb(42,211,139)]" />
                  Available now
                </span>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.07]" />

              {/* Items */}
              <div className="space-y-5">
                {[
                  {
                    num: "01",
                    heading: "Built for engineering teams",
                    body: "High-signal collaboration UI without consumer-app noise.",
                  },
                  {
                    num: "02",
                    heading: "Launch-aware workflow",
                    body: "Readiness, invites, and workspace flow stay visible from the control plane.",
                  },
                  {
                    num: "03",
                    heading: "Made for VS Code",
                    body: "Rooms are created on the web and launched directly into editor sessions.",
                  },
                ].map(({ num, heading, body }) => (
                  <div key={num} className="flex gap-4">
                    <span className="mt-0.5 shrink-0 text-xs font-semibold tabular-nums text-[rgba(36,166,242,0.5)]">
                      {num}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-white">{heading}</div>
                      <p className="mt-1 text-sm leading-relaxed text-[rgb(158,183,211)]">{body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.07]" />

              {/* Footer CTA */}
              <Link
                href="/register"
                className="flex w-full items-center justify-between rounded-xl bg-[rgba(239,102,46,0.12)] px-4 py-3 text-sm font-medium text-[rgb(239,102,46)] transition hover:bg-[rgba(239,102,46,0.2)]"
              >
                <span>Get started — it&apos;s free</span>
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
