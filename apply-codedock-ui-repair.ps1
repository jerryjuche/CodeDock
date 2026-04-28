$ErrorActionPreference = "Stop"

Set-Location "C:\Users\Jerry Koko\CodeDock"
$repoRoot = (Get-Location).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "Applying CodeDock UI repair patch..." -ForegroundColor Cyan
Write-Host "Repo root: $repoRoot"

function Write-TextFile {
    param(
        [string]$RelativePath,
        [string]$Content
    )

    $fullPath = Join-Path $repoRoot $RelativePath
    $dir = Split-Path $fullPath -Parent

    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    if (Test-Path $fullPath) {
        Copy-Item $fullPath "$fullPath.bak.$timestamp" -Force
    }

    [System.IO.File]::WriteAllText($fullPath, $Content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Wrote $RelativePath"
}

$roomTs = @'
export type Room = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  source_type: "local_workspace" | "github_repo";
  source_metadata: Record<string, unknown>;
  primary_join_code: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type RoomMembership = {
  role: "host" | "editor";
};

export type RoomSourceState = {
  type: "local_workspace" | "github_repo" | string;
  ready: boolean;
  host_bound: boolean;
  status: string;
  launch_allowed: boolean;
  launch_reason?: string;
  workspace_label?: string;
  repo_owner?: string;
  repo_name?: string;
  branch?: string;
};

export type RoomDetails = {
  room: Room;
  membership: RoomMembership;
  source_state: RoomSourceState;
};

export type RoomPresenceMember = {
  user_id: string;
  email: string;
  role: "host" | "editor" | string;
  connected: boolean;
};

export type RoomPresence = {
  members: RoomPresenceMember[];
  connected_count: number;
  total_members: number;
};
'@

$roomsApi = @'
import { apiRequest } from "./client";
import type { Room, RoomDetails, RoomPresence } from "@/types/room";

export function getRooms(token: string) {
  return apiRequest<Room[]>("/rooms", { token });
}

export function getRoom(token: string, roomId: string) {
  return apiRequest<Room>(`/rooms/${roomId}`, { token });
}

export function getRoomDetails(token: string, roomId: string) {
  return apiRequest<RoomDetails>(`/rooms/${roomId}/details`, { token });
}

export function getRoomPresence(token: string, roomId: string) {
  return apiRequest<RoomPresence>(`/rooms/${roomId}/presence`, { token });
}

export function createRoom(
  token: string,
  payload: {
    name: string;
    source_type: "local_workspace" | "github_repo";
    source_metadata?: Record<string, unknown>;
  },
) {
  return apiRequest<Room>("/rooms", {
    method: "POST",
    token,
    body: payload,
  });
}

export function resolveJoinCode(token: string, code: string) {
  return apiRequest<{
    room: Room;
    membership: {
      role: "host" | "editor";
      joined: boolean;
    };
  }>("/join-code/resolve", {
    method: "POST",
    token,
    body: { code },
  });
}

export function deleteRoom(token: string, roomId: string) {
  return apiRequest<{ success: boolean }>(`/rooms/${roomId}`, {
    method: "DELETE",
    token,
  });
}
'@

$presenceHook = @'
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getRoomPresence } from "@/lib/api/rooms";
import type { RoomPresence } from "@/types/room";

export function useRoomPresence(roomId: string) {
  const { token, hydrated } = useAuth();
  const [presence, setPresence] = useState<RoomPresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hydrated) return;

    if (!token) {
      setLoading(false);
      setError("You are not logged in.");
      return;
    }

    try {
      const data = await getRoomPresence(token, roomId);
      setPresence(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load presence");
    } finally {
      setLoading(false);
    }
  }, [token, hydrated, roomId]);

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      void load();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [load]);

  return {
    presence,
    loading,
    error,
    reload: load,
  };
}
'@

$inviteCreate = @'
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InviteCreateForm({
  onCreate,
}: {
  onCreate: (payload: {
    expires_in_hours?: number;
    max_uses?: number;
  }) => Promise<unknown>;
}) {
  const [expiresInHours, setExpiresInHours] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await onCreate({
        expires_in_hours: expiresInHours ? Number(expiresInHours) : undefined,
        max_uses: maxUses ? Number(maxUses) : undefined,
      });

      setExpiresInHours("");
      setMaxUses("");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Invite creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-white">Create invite</h3>

      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="expires-in-hours">Expires in hours</Label>
          <Input
            id="expires-in-hours"
            type="number"
            min={1}
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="max-uses">Max uses</Label>
          <Input
            id="max-uses"
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create invite token"}
        </Button>
      </form>
    </Card>
  );
}
'@

$joinHook = @'
"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { resolveJoinCode } from "@/lib/api/rooms";

export function useJoinCode() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  async function resolveCode(code: string) {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    setLoading(true);
    try {
      return await resolveJoinCode(token, code);
    } finally {
      setLoading(false);
    }
  }

  return {
    resolveCode,
    loading,
  };
}
'@

$createRoomForm = @'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { createRoom } from "@/lib/api/rooms";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type SourceType = "local_workspace" | "github_repo";

export default function CreateRoomForm() {
  const router = useRouter();
  const { token } = useAuth();

  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("local_workspace");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("main");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!token) {
      window.alert("You are not logged in.");
      return;
    }

    setSubmitting(true);

    try {
      const payload =
        sourceType === "github_repo"
          ? {
              name,
              source_type: sourceType,
              source_metadata: {
                repo_owner: repoOwner,
                repo_name: repoName,
                branch: branch || "main",
              },
            }
          : {
              name,
              source_type: sourceType,
            };

      const room = await createRoom(token, payload);
      router.push(`/rooms/${room.id}`);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to create room");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Create room</h1>
        <p className="mt-2 text-sm text-[rgb(158,183,211)]">
          Start a new collaboration room and configure its source type.
        </p>
      </div>

      <form className="space-y-5" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="room-name">Room name</Label>
          <Input
            id="room-name"
            placeholder="e.g. CodeDock core platform"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="source-type">Source type</Label>
          <select
            id="source-type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className="flex h-11 w-full rounded-[12px] border border-white/12 bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm text-white outline-none transition-all focus:border-[rgba(36,166,242,0.55)] focus:bg-[rgba(255,255,255,0.06)] focus:ring-2 focus:ring-[rgba(36,166,242,0.16)]"
          >
            <option value="local_workspace" className="bg-[rgb(1,26,61)]">
              Local workspace
            </option>
            <option value="github_repo" className="bg-[rgb(1,26,61)]">
              GitHub repository
            </option>
          </select>
        </div>

        {sourceType === "github_repo" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="repo-owner">Repo owner</Label>
              <Input
                id="repo-owner"
                placeholder="e.g. jerryjuche"
                value={repoOwner}
                onChange={(e) => setRepoOwner(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="repo-name">Repo name</Label>
              <Input
                id="repo-name"
                placeholder="e.g. CodeDock"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-[14px] border border-white/8 bg-white/[0.03] p-4 text-sm text-[rgb(158,183,211)]">
            The host will bind a local project folder later from VS Code before guests can launch the room.
          </div>
        )}

        <div className="pt-2">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Creating..." : "Create room"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
'@

$joinRoomForm = @'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useJoinCode } from "@/hooks/use-join-code";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function JoinRoomForm() {
  const router = useRouter();
  const { resolveCode, loading } = useJoinCode();
  const [code, setCode] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      const result = await resolveCode(code.trim().toUpperCase());
      router.push(`/rooms/${result.room.id}`);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to join room");
    }
  }

  return (
    <Card className="mx-auto max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Join room</h1>
        <p className="mt-2 text-sm text-[rgb(158,183,211)]">
          Enter a host-provided join code to access an existing CodeDock session.
        </p>
      </div>

      <form className="space-y-5" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="join-code">Join code</Label>
          <Input
            id="join-code"
            placeholder="e.g. A1B2C3"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="font-mono tracking-[0.18em] uppercase"
          />
        </div>

        <div className="pt-2">
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Joining..." : "Join room"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
'@

Write-TextFile "codedock-web/types/room.ts" $roomTs
Write-TextFile "codedock-web/lib/api/rooms.ts" $roomsApi
Write-TextFile "codedock-web/hooks/use-room-presence.ts" $presenceHook
Write-TextFile "codedock-web/components/rooms/invite-create-form.tsx" $inviteCreate
Write-TextFile "codedock-web/hooks/use-join-code.ts" $joinHook
Write-TextFile "codedock-web/components/rooms/create-room-form.tsx" $createRoomForm
Write-TextFile "codedock-web/components/rooms/join-room-form.tsx" $joinRoomForm

Write-Host ""
Write-Host "CodeDock UI repair patch applied." -ForegroundColor Green
Write-Host "Next commands:" -ForegroundColor Yellow
Write-Host 'Set-Location "C:\Users\Jerry Koko\CodeDock\codedock-web"'
Write-Host 'npx tsc --noEmit'
Write-Host 'npm run dev'
