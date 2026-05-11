"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardHeader() {
  const { email } = useAuth();
  const displayName = email?.split("@")[0] ?? "there";

  return (
    <div className="border-b border-white/[0.06] bg-[rgba(4,18,44,0.5)] px-6 py-5 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgb(42,211,139)] shadow-[0_0_6px_rgba(42,211,139,0.7)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(42,211,139)]">
              Live
            </span>
          </div>
          <h1 className="mt-1.5 text-[22px] font-bold leading-tight tracking-tight text-white">
            Welcome back, <span className="text-[rgb(47,203,255)]">{displayName}</span>
          </h1>
          <p className="mt-0.5 text-sm text-[rgb(100,140,185)]">
            Manage your collaboration rooms and team sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/join"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-[rgb(158,183,211)] transition-all hover:bg-white/[0.09] hover:text-white"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M6 8h7M9 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.5 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Join room
          </Link>

          <Link
            href="/rooms/new"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[rgb(239,102,46)] px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(239,102,46,0.25)] transition-all hover:bg-[rgb(249,145,53)] hover:-translate-y-px"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            New room
          </Link>
        </div>
      </div>
    </div>
  );
}
