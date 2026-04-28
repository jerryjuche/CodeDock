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
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-6">
          <Link href="/" className="shrink-0">
            <BrandLogo priority />
          </Link>

          {showNav ? (
            <nav className="hidden items-center gap-3 md:flex">
              <Link
                href="/login"
                className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-[rgb(239,102,46)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(249,145,53)]"
              >
                Create account
              </Link>
            </nav>
          ) : (
            <Link
              href="/"
              className="hidden text-sm text-[rgb(158,183,211)] transition hover:text-white md:inline-flex"
            >
              â† Back to home
            </Link>
          )}
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}