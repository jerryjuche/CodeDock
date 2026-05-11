import type { ReactNode } from "react";
import Link from "next/link";
import BrandLogo from "@/components/brand/logo";

export default function MarketingShell({
  children,
  showNav = true,
}: {
  children: ReactNode;
  showNav?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(36,166,242,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(239,102,46,0.10),transparent_18%),linear-gradient(180deg,rgba(4,22,49,1)_0%,rgba(1,26,61,1)_100%)] text-[rgb(234,244,255)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 pt-5 pb-8 sm:px-8 lg:px-10">
        <header className="mb-8 flex items-center justify-between gap-6 border-b border-white/[0.06] pb-5">
          <Link href="/" className="shrink-0">
            <BrandLogo priority />
          </Link>

          {showNav ? (
            <nav className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm text-[rgb(158,183,211)] transition hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.1]"
              >
                Create account
              </Link>
            </nav>
          ) : (
            <Link
              href="/"
              className="hidden items-center gap-1.5 text-sm text-[rgb(158,183,211)] transition hover:text-white md:inline-flex"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to home
            </Link>
          )}
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
