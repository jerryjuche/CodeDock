"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rooms/new", label: "Create room" },
  { href: "/join", label: "Join room" },
];

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[rgba(1,26,61,0.78)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 sm:px-8 lg:px-10">
        <Link href="/dashboard" className="shrink-0">
          <BrandLogo priority />
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "min-w-[108px]",
                    active ? "shadow-[0_8px_24px_rgba(36,166,242,0.15)]" : "",
                  )}
                >
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}