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
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <header className="flex h-14 items-center justify-between gap-6 border-b border-white/[0.07]">
          <Link href="/" className="shrink-0">
            <BrandLogo priority />
          </Link>

          {showNav ? (
            <nav className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-4 py-1.5 text-sm text-[rgb(158,183,211)] transition hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-[rgb(239,102,46)] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[rgb(249,145,53)]"
              >
                Get started
              </Link>
            </nav>
          ) : (
            <Link
              href="/"
              className="text-sm text-[rgb(158,183,211)] transition hover:text-white"
            >
              ← Back to home
            </Link>
          )}
        </header>

        {children}
      </div>
    </div>
  );
}
