"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

function navClass(active: boolean) {
  return active
    ? "rounded-xl bg-zinc-800 px-3 py-2 text-sm font-medium text-white"
    : "rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white";
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { email, logoutSession } = useAuth();

  function handleLogout() {
    logoutSession();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
              CodeDock
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              <Link
                href="/dashboard"
                className={navClass(pathname === "/dashboard")}
              >
                Dashboard
              </Link>
              <Link
                href="/join"
                className={navClass(pathname === "/join")}
              >
                Join
              </Link>
              <Link
                href="/rooms/new"
                className={navClass(pathname === "/rooms/new")}
              >
                Create Room
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-sm text-zinc-400 md:block">
              {email ?? "Signed in"}
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div>{children}</div>
    </div>
  );
}