// components/rooms/room-header.tsx
"use client";

import { useState } from "react";
import SilkHero from "@/components/backgrounds/silk-hero";
import RoomSourceBadge from "@/components/rooms/room-source-badge";
import type { RoomDetails } from "@/types/room";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — fail silently, text is still visible
    }
  }

  return (
    <button
      onClick={() => void handleCopy()}
      className="ml-2 rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors"
      style={
        copied
          ? { color: "rgb(42,211,139)", background: "rgba(42,211,139,0.1)" }
          : { color: "rgb(158,183,211)", background: "rgba(255,255,255,0.06)" }
      }
      aria-label="Copy join code"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function RoomHeader({ details }: { details: RoomDetails }) {
  const { room, membership } = details;
  const primaryJoinCodeExpired = room.created_at
    ? new Date(room.created_at).getTime() + 5 * 60 * 1000 < Date.now()
    : false;

  return (
    <section className="relative overflow-hidden rounded-[20px] border border-white/10">
      <SilkHero />

      <div className="relative z-10 flex flex-col gap-6 px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-center gap-3">
          <RoomSourceBadge sourceType={room.source_type} />
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-[rgb(234,244,255)]">
            {membership.role}
          </span>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-[rgb(234,244,255)]">
            {room.is_active ? "active" : "ended"}
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {room.name}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[rgb(158,183,211)] sm:text-base">
            Manage source readiness, invites, members, and launch state for this CodeDock session.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[14px] border border-white/10 bg-white/[0.05] p-4" style={primaryJoinCodeExpired ? { opacity: 0.5 } : {}}>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(158,183,211)] flex justify-between items-center">
              <span>Join code</span>
              {primaryJoinCodeExpired && <span className="text-[10px] text-[rgb(255,160,170)] font-medium normal-case tracking-normal">Expired</span>}
            </div>
            <div className="mt-2 flex items-center gap-1">
              <span className={`font-mono text-lg ${primaryJoinCodeExpired ? "text-white/40 line-through select-none" : "text-white"}`}>
                {room.primary_join_code}
              </span>
              {!primaryJoinCodeExpired && <CopyButton value={room.primary_join_code} />}
            </div>
          </div>

          <div className="rounded-[14px] border border-white/10 bg-white/[0.05] p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(158,183,211)]">
              Slug
            </div>
            <div className="mt-2 text-lg text-white">{room.slug}</div>
          </div>

          <div className="rounded-[14px] border border-white/10 bg-white/[0.05] p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(158,183,211)]">
              Source
            </div>
            <div className="mt-2 text-lg text-white">{room.source_type}</div>
          </div>
        </div>
      </div>
    </section>
  );
}