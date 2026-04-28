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