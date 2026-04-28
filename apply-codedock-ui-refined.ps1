
$ErrorActionPreference = "Stop"

function Write-File {
  param(
    [string]$Path,
    [string]$Content
  )

  $fullPath = Join-Path $repoRoot $Path
  $dir = Split-Path $fullPath -Parent
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  if (Test-Path $fullPath) {
    Copy-Item $fullPath "$fullPath.bak.$timestamp" -Force
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($fullPath, $Content.TrimStart("`n"), $utf8NoBom)
  Write-Host "Wrote $Path" -ForegroundColor Green
}

$repoRoot = (Get-Location).Path
if (-not (Test-Path (Join-Path $repoRoot "codedock-web"))) {
  throw "Run this script from the CodeDock repo root. codedock-web was not found."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "Applying refined CodeDock UI integration..." -ForegroundColor Cyan
Write-Host "Repo root: $repoRoot"

Write-File "codedock-web/lib/utils.ts" @'
export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}
'@

Write-File "codedock-web/app/globals.css" @'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --cd-bg: 1 26 61;
  --cd-bg-elevated: 9 34 72;
  --cd-panel: 8 30 63;
  --cd-panel-2: 13 40 81;
  --cd-border: 255 255 255;
  --cd-text: 234 244 255;
  --cd-text-muted: 158 183 211;
  --cd-cyan: 36 166 242;
  --cd-cyan-soft: 47 203 255;
  --cd-orange: 239 102 46;
  --cd-amber: 249 145 53;
  --cd-success: 42 211 139;
  --cd-danger: 255 90 107;
}

html,
body {
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(var(--cd-cyan), 0.12), transparent 24%),
    radial-gradient(circle at top right, rgba(var(--cd-orange), 0.10), transparent 18%),
    linear-gradient(180deg, rgba(4, 22, 49, 1) 0%, rgba(1, 26, 61, 1) 100%);
  color: rgb(var(--cd-text));
}

body {
  @apply antialiased;
}

* {
  border-color: rgba(var(--cd-border), 0.08);
}

a {
  @apply transition-colors;
}

::selection {
  background: rgba(var(--cd-cyan), 0.25);
  color: rgb(var(--cd-text));
}
'@

Write-File "codedock-web/components/reactbits/silk.tsx" @'
"use client";

import { useEffect, useMemo, useRef } from "react";

type SilkProps = {
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
  className?: string;
};

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;

  const int = parseInt(value, 16);

  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

export default function Silk({
  speed = 4,
  scale = 1,
  color = "#2FCBFF",
  noiseIntensity = 1.15,
  rotation = 0,
  className,
}: SilkProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rgb = useMemo(() => hexToRgb(color), [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let animationFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      context.clearRect(0, 0, width, height);
      context.save();

      context.translate(width / 2, height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.translate(-width / 2, -height / 2);

      for (let layer = 0; layer < 16; layer++) {
        const offset = layer * 18 * scale;
        const alpha = 0.05 + layer * 0.018;

        context.beginPath();

        for (let x = -40; x <= width + 40; x += 6) {
          const waveA =
            Math.sin((x + frame * speed + offset) * 0.008 * scale) * 18;
          const waveB =
            Math.cos((x - frame * speed * 0.7 + offset) * 0.014 * scale) * 10;
          const noise =
            Math.sin((x + layer * 21 + frame * 0.9) * 0.022) *
            8 *
            noiseIntensity;
          const y = height * 0.52 + offset - layer * 10 + waveA + waveB + noise;

          if (x === -40) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }

        context.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        context.lineWidth = 1.2;
        context.stroke();
      }

      context.restore();

      frame += 0.7;
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    draw();

    const observer = new ResizeObserver(() => resize());
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [rgb, rotation, scale, speed, noiseIntensity]);

  return <canvas ref={canvasRef} className={className ?? "h-full w-full"} />;
}
'@

Write-File "codedock-web/components/brand/logo.tsx" @'
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      <Image
        src="/brand/codedock-logo.png"
        alt="CodeDock"
        width={420}
        height={140}
        priority={priority}
        className="h-auto w-[145px] sm:w-[170px] lg:w-[190px]"
      />
    </div>
  );
}
'@

Write-File "codedock-web/components/backgrounds/silk-hero.tsx" @'
"use client";

import Silk from "@/components/reactbits/silk";

export default function SilkHero() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[20px]">
      <Silk
        speed={4}
        scale={1}
        color="#2FCBFF"
        noiseIntensity={1.15}
        rotation={0}
        className="h-full w-full"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(1,26,61,0.08),rgba(1,26,61,0.82))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,102,46,0.18),transparent_24%)]" />
    </div>
  );
}
'@

Write-File "codedock-web/components/ui/card.tsx" @'
import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-white/10 bg-[rgba(8,30,63,0.74)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}
'@

Write-File "codedock-web/components/ui/button.tsx" @'
import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive";
type ButtonSize = "default" | "sm" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[rgb(239,102,46)] text-white shadow-[0_10px_24px_rgba(239,102,46,0.22)] hover:bg-[rgb(249,145,53)]",
  outline:
    "border border-white/15 bg-white/5 text-white hover:bg-white/10",
  secondary:
    "bg-[rgba(36,166,242,0.14)] text-[rgb(234,244,255)] hover:bg-[rgba(36,166,242,0.22)]",
  ghost:
    "bg-transparent text-[rgb(234,244,255)] hover:bg-white/6",
  destructive:
    "bg-[rgba(255,90,107,0.18)] text-white hover:bg-[rgba(255,90,107,0.28)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center overflow-hidden rounded-[12px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
          "hover:-translate-y-[1px] active:translate-y-0",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        <span
          className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.16),transparent)] transition-transform duration-700 group-hover:translate-x-[120%]"
          aria-hidden="true"
        />
        <span className="relative z-10">{children}</span>
      </button>
    );
  },
);

Button.displayName = "Button";
'@

Write-File "codedock-web/components/ui/input.tsx" @'
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-[12px] border border-white/12 bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm text-white outline-none transition-all",
          "placeholder:text-[rgb(158,183,211)]",
          "focus:border-[rgba(36,166,242,0.55)] focus:bg-[rgba(255,255,255,0.06)] focus:ring-2 focus:ring-[rgba(36,166,242,0.16)]",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
'@

Write-File "codedock-web/components/ui/label.tsx" @'
import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "mb-2 inline-block text-sm font-medium text-[rgb(234,244,255)]",
        className,
      )}
      {...props}
    />
  );
}
'@

Write-File "codedock-web/components/layout/app-header.tsx" @'
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
'@

Write-File "codedock-web/components/rooms/room-source-badge.tsx" @'
import { cn } from "@/lib/utils";

export default function RoomSourceBadge({
  sourceType,
}: {
  sourceType: string;
}) {
  const label =
    sourceType === "github_repo"
      ? "GitHub repo"
      : sourceType === "local_workspace"
        ? "Local workspace"
        : sourceType;

  const tone =
    sourceType === "github_repo"
      ? "bg-[rgba(36,166,242,0.16)] text-[rgb(47,203,255)]"
      : "bg-[rgba(239,102,46,0.16)] text-[rgb(249,145,53)]";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        tone,
      )}
    >
      {label}
    </span>
  );
}
'@

Write-File "codedock-web/components/rooms/open-in-vscode-button.tsx" @'
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLaunch } from "@/hooks/use-launch";

export default function OpenInVSCodeButton({
  roomId,
  launchAllowed,
  launchReason,
}: {
  roomId: string;
  launchAllowed: boolean;
  launchReason?: string;
}) {
  const { openRoom, loading } = useLaunch(roomId);
  const disabled = loading || !launchAllowed;

  return (
    <Card>
      <h3 className="text-lg font-semibold text-white">Open in VS Code</h3>
      <p className="mt-2 text-sm text-[rgb(158,183,211)]">
        Generate a one-time launch link and continue the room inside VS Code.
      </p>

      {!launchAllowed && launchReason ? (
        <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/10 p-3 text-sm text-amber-100">
          {launchReason}
        </div>
      ) : null}

      <div className="mt-5">
        <Button disabled={disabled} onClick={() => void openRoom()}>
          {loading ? "Opening..." : "Open in VS Code"}
        </Button>
      </div>
    </Card>
  );
}
'@

Write-File "codedock-web/components/rooms/invite-list.tsx" @'
"use client";

import type { RoomInviteToken } from "@/types/invite";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InviteList({
  invites,
  loading,
  error,
  onRevoke,
}: {
  invites: RoomInviteToken[];
  loading: boolean;
  error: string | null;
  onRevoke: (inviteId: string) => Promise<void>;
}) {
  return (
    <Card>
      <h2 className="text-xl font-semibold text-white">Invite tokens</h2>
      <p className="mt-2 text-sm text-[rgb(158,183,211)]">
        Manage room-specific invite tokens for collaborators.
      </p>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="text-sm text-[rgb(158,183,211)]">Loading invites...</div>
        ) : error ? (
          <div className="text-sm text-red-300">{error}</div>
        ) : invites.length === 0 ? (
          <div className="text-sm text-[rgb(158,183,211)]">No invite tokens yet.</div>
        ) : (
          invites.map((invite) => (
            <div
              key={invite.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-sm font-semibold text-white">
                    {invite.code}
                  </div>
                  <div className="mt-1 text-xs text-[rgb(158,183,211)]">
                    uses: {invite.uses_count}
                    {invite.max_uses ? ` / ${invite.max_uses}` : ""}
                    {invite.is_revoked ? " · revoked" : ""}
                  </div>
                </div>

                <Button
                  variant="secondary"
                  disabled={invite.is_revoked}
                  onClick={() => void onRevoke(invite.id)}
                >
                  {invite.is_revoked ? "Revoked" : "Revoke"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
'@

Write-File "codedock-web/components/rooms/source-state-card.tsx" @'
import { Card } from "@/components/ui/card";
import type { RoomSourceState } from "@/types/room";

function readableStatus(state: RoomSourceState) {
  switch (state.status) {
    case "ready":
      return "Ready";
    case "repo_configured":
      return "Repository configured";
    case "repo_not_configured":
      return "Repository not configured";
    case "host_workspace_required":
      return "Host must select a project folder in VS Code";
    case "waiting_for_host_workspace":
      return "Waiting for host workspace";
    case "clone_not_ready":
      return "Repository is not provisioned yet";
    default:
      return state.status || "Unknown";
  }
}

export default function SourceStateCard({
  sourceState,
}: {
  sourceState: RoomSourceState;
}) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-white">Source readiness</h3>
      <p className="mt-2 text-sm text-[rgb(158,183,211)]">
        {readableStatus(sourceState)}
      </p>

      <div className="mt-5 space-y-3 text-sm text-white">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[rgb(158,183,211)]">Type</span>
          <span>{sourceState.type}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-[rgb(158,183,211)]">Ready</span>
          <span>{sourceState.ready ? "Yes" : "No"}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-[rgb(158,183,211)]">Launch allowed</span>
          <span>{sourceState.launch_allowed ? "Yes" : "No"}</span>
        </div>

        {sourceState.launch_reason ? (
          <div className="rounded-2xl border border-amber-300/15 bg-amber-300/10 p-3 text-sm text-amber-100">
            {sourceState.launch_reason}
          </div>
        ) : null}

        {sourceState.workspace_label ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-[rgb(158,183,211)]">Workspace</span>
            <span>{sourceState.workspace_label}</span>
          </div>
        ) : null}

        {sourceState.repo_owner || sourceState.repo_name ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[rgb(158,183,211)]">Repo owner</span>
              <span>{sourceState.repo_owner || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[rgb(158,183,211)]">Repo name</span>
              <span>{sourceState.repo_name || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[rgb(158,183,211)]">Branch</span>
              <span>{sourceState.branch || "—"}</span>
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
'@

Write-File "codedock-web/components/rooms/presence-card.tsx" @'
import { Card } from "@/components/ui/card";
import type { RoomPresence } from "@/types/room";

export default function PresenceCard({
  presence,
  loading,
  error,
}: {
  presence: RoomPresence | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-white">Members</h3>

      {loading ? (
        <p className="mt-3 text-sm text-[rgb(158,183,211)]">Loading presence...</p>
      ) : error ? (
        <p className="mt-3 text-sm text-red-300">{error}</p>
      ) : !presence ? (
        <p className="mt-3 text-sm text-[rgb(158,183,211)]">
          No presence data available.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-[rgb(158,183,211)]">
            {presence.connected_count} connected · {presence.total_members} total
          </p>

          <div className="mt-4 space-y-3">
            {presence.members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              >
                <div>
                  <div className="text-sm font-medium text-white">{member.email}</div>
                  <div className="text-xs text-[rgb(158,183,211)]">{member.role}</div>
                </div>

                <div
                  className={`text-xs font-medium ${
                    member.connected ? "text-emerald-300" : "text-[rgb(158,183,211)]"
                  }`}
                >
                  {member.connected ? "Connected" : "Offline"}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
'@

Write-File "codedock-web/components/rooms/room-header.tsx" @'
import SilkHero from "@/components/backgrounds/silk-hero";
import RoomSourceBadge from "@/components/rooms/room-source-badge";
import type { RoomDetails } from "@/types/room";

export default function RoomHeader({
  details,
}: {
  details: RoomDetails;
}) {
  const { room, membership } = details;

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
          <div className="rounded-[14px] border border-white/10 bg-white/[0.05] p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(158,183,211)]">
              Join code
            </div>
            <div className="mt-2 font-mono text-lg text-white">
              {room.primary_join_code}
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
'@

Write-File "codedock-web/components/rooms/delete-room-button.tsx" @'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { deleteRoom } from "@/lib/api/rooms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DeleteRoomButton({
  roomId,
  roomName,
}: {
  roomId: string;
  roomName: string;
}) {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    const confirmed = window.confirm(
      `Delete "${roomName}"? This will end the session for all users.`,
    );

    if (!confirmed) return;
    if (!token) {
      window.alert("You are not logged in.");
      return;
    }

    setLoading(true);
    try {
      await deleteRoom(token, roomId);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to delete room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-white">Danger zone</h3>
      <p className="mt-2 text-sm text-[rgb(158,183,211)]">
        Deleting a room ends the session and removes future access through the control plane.
      </p>

      <div className="mt-5">
        <Button variant="destructive" onClick={onDelete} disabled={loading}>
          {loading ? "Deleting..." : "Delete room"}
        </Button>
      </div>
    </Card>
  );
}
'@

Write-File "codedock-web/components/rooms/room-details-page.tsx" @'
"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useRoomDetails } from "@/hooks/use-room-details";
import { useRoomPresence } from "@/hooks/use-room-presence";
import { useInvites } from "@/hooks/use-invites";
import RoomHeader from "@/components/rooms/room-header";
import PresenceCard from "@/components/rooms/presence-card";
import SourceStateCard from "@/components/rooms/source-state-card";
import InviteList from "@/components/rooms/invite-list";
import InviteCreateForm from "@/components/rooms/invite-create-form";
import OpenInVSCodeButton from "@/components/rooms/open-in-vscode-button";
import DeleteRoomButton from "@/components/rooms/delete-room-button";
import { Button } from "@/components/ui/button";

export default function RoomDetailsPageClient({ roomId }: { roomId: string }) {
  const { details, loading, error } = useRoomDetails(roomId);
  const {
    presence,
    loading: presenceLoading,
    error: presenceError,
  } = useRoomPresence(roomId);

  const {
    invites,
    loading: invitesLoading,
    error: invitesError,
    createInvite,
    revokeInvite,
  } = useInvites(roomId);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
        <Card>Loading room details...</Card>
      </main>
    );
  }

  if (error || !details) {
    const friendly =
      error?.toLowerCase().includes("forbidden")
        ? "You no longer have access to this room."
        : error?.toLowerCase().includes("not found")
          ? "This session has ended or the room no longer exists."
          : error ?? "Room not found.";

    return (
      <main className="mx-auto max-w-4xl px-6 py-10 sm:px-8">
        <Card className="text-center">
          <h1 className="text-2xl font-semibold text-white">Session ended</h1>
          <p className="mt-3 text-sm text-[rgb(158,183,211)]">{friendly}</p>
          <div className="mt-6">
            <Link href="/dashboard">
              <Button>Back to dashboard</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const isHost = details.membership.role === "host";

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-8 sm:px-8 lg:px-10">
      <RoomHeader details={details} />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <PresenceCard
            presence={presence}
            loading={presenceLoading}
            error={presenceError}
          />

          {isHost ? (
            <>
              <InviteList
                invites={invites}
                loading={invitesLoading}
                error={invitesError}
                onRevoke={revokeInvite}
              />
              <InviteCreateForm onCreate={createInvite} />
            </>
          ) : (
            <Card>
              <h3 className="text-lg font-semibold text-white">Access</h3>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                You joined this room as an editor. Invite management is available only to the host.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <SourceStateCard sourceState={details.source_state} />
          <OpenInVSCodeButton
            roomId={roomId}
            launchAllowed={details.source_state.launch_allowed}
            launchReason={details.source_state.launch_reason}
          />
          {isHost ? (
            <DeleteRoomButton roomId={roomId} roomName={details.room.name} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
'@

Write-Host ""
Write-Host "Refined CodeDock UI integration applied." -ForegroundColor Green
Write-Host "Make sure your logo exists at codedock-web/public/brand/codedock-logo.png" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next commands:" -ForegroundColor Cyan
Write-Host 'Set-Location "C:\Users\Jerry Koko\CodeDock\codedock-web"'
Write-Host 'npx tsc --noEmit'
Write-Host 'npm run dev'
