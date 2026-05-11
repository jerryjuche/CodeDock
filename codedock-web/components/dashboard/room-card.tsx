// components/dashboard/room-card.tsx
"use client";

import Link from "next/link";
import type { Room } from "@/types/room";

function colorFromText(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

function RoomAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const bg = colorFromText(name);
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg"
      style={{ background: bg, boxShadow: `0 0 18px ${bg}55` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function SourceBadge({ sourceType }: { sourceType: string }) {
  const isGithub = sourceType === "github_repo";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        isGithub
          ? "bg-[rgba(36,166,242,0.12)] text-[rgb(47,203,255)]"
          : "bg-[rgba(239,102,46,0.12)] text-[rgb(249,145,53)]"
      }`}
    >
      {isGithub ? (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M8 1a7 7 0 00-2.21 13.64c.35.06.48-.15.48-.34v-1.17c-1.95.42-2.36-.94-2.36-.94-.32-.81-.77-1.02-.77-1.02-.63-.43.05-.42.05-.42.7.05 1.07.72 1.07.72.62 1.07 1.63.76 2.03.58.06-.45.24-.76.44-.94-1.55-.18-3.19-.78-3.19-3.47 0-.77.27-1.4.72-1.89-.07-.18-.31-.9.07-1.86 0 0 .59-.19 1.93.72a6.7 6.7 0 011.75-.24c.59 0 1.19.08 1.75.24 1.34-.91 1.93-.72 1.93-.72.38.96.14 1.68.07 1.86.45.49.72 1.12.72 1.89 0 2.7-1.64 3.29-3.2 3.47.25.22.47.64.47 1.29v1.92c0 .19.13.4.48.34A7 7 0 008 1z" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden="true">
          <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <path d="M9.5 11.5h5M12 9v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
      {isGithub ? "GitHub" : "Local"}
    </span>
  );
}

export default function RoomCard({ room }: { room: Room }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[20px] border border-white/[0.08] bg-[rgba(8,30,63,0.70)] backdrop-blur-xl transition-all duration-200 hover:border-white/[0.16] hover:shadow-[0_24px_56px_rgba(0,0,0,0.38)]">
      {/* Top accent line */}
      <div
        className="h-[2px] w-full"
        style={{
          background: room.is_active
            ? "linear-gradient(90deg, rgba(42,211,139,0.6), rgba(36,166,242,0.4), transparent)"
            : "linear-gradient(90deg, rgba(100,140,185,0.2), transparent)",
        }}
      />

      <div className="flex flex-1 flex-col p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <RoomAvatar name={room.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold text-white">{room.name}</h3>
              {room.is_active && (
                <span
                  className="shrink-0 inline-block h-1.5 w-1.5 rounded-full bg-[rgb(42,211,139)]"
                  style={{ boxShadow: "0 0 6px rgba(42,211,139,0.7)" }}
                  aria-label="Active"
                />
              )}
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-[rgb(100,140,185)]">{room.slug}</p>
          </div>
          <SourceBadge sourceType={room.source_type} />
        </div>

        {/* Join code */}
        <div className="mt-4 flex items-center gap-2.5 rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-3.5 py-2">
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-[rgb(100,140,185)]" aria-hidden="true">
            <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 8h.01M8 8h.01M11 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[rgb(100,140,185)]">Code</span>
          <span className="font-mono text-sm font-bold tracking-[0.2em] text-white">
            {room.primary_join_code}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/rooms/${room.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[rgba(36,166,242,0.12)] px-3 py-2 text-sm font-semibold text-[rgb(36,166,242)] transition-all duration-150 hover:bg-[rgba(36,166,242,0.20)] hover:text-[rgb(47,203,255)]"
          >
            Open room
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <Link
            href={`/rooms/${room.id}`}
            title="Open in VS Code"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[rgb(100,140,185)] transition-all hover:border-[rgba(36,166,242,0.3)] hover:bg-[rgba(36,166,242,0.08)] hover:text-[rgb(36,166,242)]"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M15 3L5 10.5L15 18M5 3l10 7.5L5 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
