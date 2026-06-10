// components/rooms/join-room-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useJoinCode } from "@/hooks/use-join-code";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import posthog from "posthog-js";

export default function JoinRoomForm() {
  const router = useRouter();
  const { resolveCode, loading } = useJoinCode();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      setError("Join code must be exactly 6 characters.");
      return;
    }

    posthog.capture("room_join_started", { code: normalized });

    try {
      const result = await resolveCode(normalized);
      posthog.capture("room_joined", { roomId: result.room.id, code: normalized });
      router.push(`/rooms/${result.room.id}`);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to join room. Verify the code and try again.";
      setError(errorMessage);
      posthog.capture("room_join_failed", { error: errorMessage, code: normalized });
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
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            maxLength={6}
            required
            className="font-mono tracking-[0.18em] uppercase"
          />
        </div>

        {error ? (
          <p className="rounded-[12px] border border-[rgba(255,90,107,0.3)] bg-[rgba(255,90,107,0.08)] px-4 py-3 text-sm text-[rgb(255,160,170)]">
            {error}
          </p>
        ) : null}

        <div className="pt-2">
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Joining..." : "Join room"}
          </Button>
        </div>
      </form>
    </Card>
  );
}