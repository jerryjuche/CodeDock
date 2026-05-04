// components/auth/auth-shell.tsx
// Layout ONLY — zero logic here. AuthShell wraps auth pages.
// Left panel: marketing copy + feature cards
// Right panel: the form rendered via {children}
import type { ReactNode } from "react";
import TextRotate from "@/components/fancy/text/text-rotate";

export default function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid items-center gap-10 pb-12 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
      {/* ── Left: marketing / feature copy ─────────────────────────── */}
      <section className="hidden lg:block">
        <div className="max-w-xl space-y-8">
          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight text-white">
              Real-time collaboration
              <br />
              that feels{" "}
              <TextRotate
                texts={["focused", "stable", "fast", "owned", "professional"]}
                className="align-middle"
              />
            </h1>
            <p className="text-base leading-[1.8] text-[rgb(158,183,211)]">
              CodeDock gives engineering teams a focused control plane for
              shared coding sessions, launch flow, invites, and workspace
              readiness — without giving up ownership.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Self-hosted",
                body: "Keep the collaboration stack under your control.",
              },
              {
                title: "Room-based",
                body: "Create rooms, invite teammates, and launch cleanly into VS Code.",
              },
              {
                title: "Operational",
                body: "Manage readiness, access, and session flow from one place.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="text-sm font-semibold text-white">
                  {card.title}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[rgb(158,183,211)]">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      

      {/* ── Right: form card ─────────────────────────────────────────── */}
      <section className="mx-auto flex w-full max-w-lg items-center">
        <div className="w-full rounded-[22px] border border-white/10 bg-[rgba(8,30,63,0.82)] p-7 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
          {/* Form title block */}
          <div className="mb-6 space-y-1.5">
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            <p className="text-sm leading-relaxed text-[rgb(158,183,211)]">
              {description}
            </p>
          </div>

          {/* Injected form */}
          {children}

          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </section>
    </div>
  );
}