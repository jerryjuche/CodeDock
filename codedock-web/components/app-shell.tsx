"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/brand/logo";

function navClass(active: boolean) {
  return active
    ? "rounded-lg px-3 py-2 text-sm font-medium text-white bg-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    : "rounded-lg px-3 py-2 text-sm font-medium text-[rgb(158,183,211)] hover:bg-white/5 hover:text-white transition-colors";
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { email, logoutSession } = useAuth();

  function handleLogout() {
    logoutSession();
    router.replace("/login");
  }

  const displayName = email?.split("@")[0] ?? "Signed in";

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(36,166,242,0.12), transparent 24%), " +
          "radial-gradient(circle at top right, rgba(239,102,46,0.10), transparent 18%), " +
          "linear-gradient(180deg, rgba(4,22,49,1) 0%, rgba(1,26,61,1) 100%)",
      }}
    >
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[rgba(1,26,61,0.82)] backdrop-blur-xl">
        {/* ... rest unchanged ... */}
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Brand + Nav */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(239,102,46)] shadow-[0_0_18px_rgba(239,102,46,0.3)]">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M8 1L14.928 5V11L8 15L1.072 11V5L8 1Z"
                    fill="white"
                    opacity="0.9"
                  />
                </svg>
              </div>
              <span className="text-base font-semibold tracking-tight text-white">
                CodeDock
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href="/dashboard"
                className={navClass(pathname === "/dashboard")}
              >
                Dashboard
              </Link>
              <Link href="/join" className={navClass(pathname === "/join")}> 
                Join
              </Link>
              <Link href="/activity" className={navClass(pathname === "/activity")}> 
                Activity
              </Link>
              <Link
                href="/rooms/new"
                className={navClass(pathname === "/rooms/new")}
              >
                New Room
              </Link>
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <div className="hidden flex-col items-end md:flex">
              <span className="text-xs font-semibold leading-none text-white">
                {displayName}
              </span>
              {email ? (
                <span className="mt-0.5 text-[10px] text-[rgb(158,183,211)]">
                  {email}
                </span>
              ) : null}
            </div>

            <div className="h-5 w-px bg-white/10" />

            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div>{children}</div>
    </div>
  );
}
