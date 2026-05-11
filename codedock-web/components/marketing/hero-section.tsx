import Link from "next/link";
import TextRotate from "@/components/fancy/text/text-rotate";

export default function HeroSection() {
  return (
    <section className="border-b border-white/[0.07] py-16 lg:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_420px]">
        {/* Left — headline + actions */}
        <div className="space-y-7">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-[rgba(36,166,242,0.25)] bg-[rgba(36,166,242,0.08)] px-3 py-1 text-xs font-medium tracking-widest text-[rgb(36,166,242)] uppercase">
              Self-hosted · VS Code · Engineering teams
            </p>

            <h1 className="max-w-2xl text-[40px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[52px] lg:text-[58px] text-balance">
              Collaborative coding that feels{" "}
              <TextRotate
                texts={["owned", "stable", "fast", "focused", "professional"]}
              />
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[rgb(158,183,211)]">
              CodeDock gives engineering teams a control plane for shared VS Code sessions,
              room lifecycle, invites, and launch readiness — without sacrificing ownership.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-[rgb(239,102,46)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[rgb(249,145,53)]"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Log in
            </Link>
            <span className="hidden text-xs text-[rgb(158,183,211)] sm:block">
              Free to self-host · MIT licensed
            </span>
          </div>
        </div>

        {/* Right — terminal card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[rgba(8,30,63,0.70)] shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl overflow-hidden">
          {/* Window chrome */}
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[rgba(255,90,107,0.7)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[rgba(249,145,53,0.7)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[rgba(42,211,139,0.5)]" />
            <span className="ml-2 text-[11px] text-[rgb(158,183,211)] opacity-60">
              codedock — session
            </span>
          </div>

          <div className="p-5 font-mono text-xs leading-6">
            <div className="text-[rgb(42,211,139)]">$ codedock room create --name feature/auth-refactor</div>
            <div className="mt-1 text-[rgb(158,183,211)]">
              <span className="text-[rgb(36,166,242)]">✓</span> Room created{" "}
              <span className="text-white opacity-70">r_7xkp9m</span>
            </div>
            <div className="mt-1 text-[rgb(158,183,211)]">
              <span className="text-[rgb(36,166,242)]">✓</span> Invite link generated
            </div>
            <div className="mt-1 text-[rgb(158,183,211)]">
              <span className="text-[rgb(36,166,242)]">✓</span> VS Code session ready
            </div>
            <div className="mt-3 text-[rgb(42,211,139)]">$ codedock room launch r_7xkp9m</div>
            <div className="mt-1 text-[rgb(158,183,211)]">
              Opening{" "}
              <span className="text-white">vscode://ms-vscode-remote.remote-ssh/…</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgb(42,211,139)]" />
              <span className="text-[rgb(42,211,139)]">3 collaborators online</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
