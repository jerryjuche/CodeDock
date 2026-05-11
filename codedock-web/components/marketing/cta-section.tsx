import Link from "next/link";

export default function CtaSection() {
  return (
    <section className="py-14">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            Ready to run your own CodeDock?
          </h2>
          <p className="text-sm text-[rgb(158,183,211)]">
            Free to self-host. MIT licensed. No cloud dependency required.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-[rgb(239,102,46)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[rgb(249,145,53)]"
          >
            Create account
          </Link>
          <a
            href="https://github.com/jerryjuche/CodeDock"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.021C22 6.484 17.522 2 12 2z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </div>

      <div className="mt-10 border-t border-white/[0.07] pt-6 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-[rgb(158,183,211)] opacity-60">
          © {new Date().getFullYear()} CodeDock. Built for engineering teams.
        </p>
        <div className="flex items-center gap-5 text-xs text-[rgb(158,183,211)] opacity-60">
          <Link href="/login" className="hover:opacity-100 transition">Log in</Link>
          <Link href="/register" className="hover:opacity-100 transition">Register</Link>
        </div>
      </div>
    </section>
  );
}
