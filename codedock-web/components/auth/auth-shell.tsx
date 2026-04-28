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
    <div className="grid min-h-[calc(100vh-96px)] items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden lg:block">
        <div className="max-w-2xl space-y-6">
          <div className="space-y-4">
            <h1 className="text-5xl font-semibold tracking-tight text-white">
              Real-time collaboration that feels{" "}
              <TextRotate
                texts={["focused", "stable", "fast", "owned", "professional"]}
                className="align-middle"
              />
            </h1>
            <p className="text-base leading-8 text-[rgb(158,183,211)]">
              CodeDock gives engineering teams a focused control plane for shared coding sessions,
              launch flow, invites, and workspace readiness without giving up ownership.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Self-hosted</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Keep the collaboration stack under your control.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Room-based</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Create rooms, invite teammates, and launch cleanly into VS Code.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Operational</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Manage readiness, access, and session flow from one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-lg items-center">
        <div className="w-full rounded-[22px] border border-white/10 bg-[rgba(8,30,63,0.82)] p-7 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 space-y-2">
            <h2 className="text-3xl font-semibold text-white">{title}</h2>
            <p className="text-sm leading-7 text-[rgb(158,183,211)]">{description}</p>
          </div>

          {children}

          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </section>
    </div>
  );
}