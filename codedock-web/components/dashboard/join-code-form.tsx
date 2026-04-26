"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useJoinCode } from "@/hooks/use-join-code";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function JoinCodeForm() {
  const router = useRouter();
  const { resolveCode, loading } = useJoinCode();
  const [code, setCode] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      window.alert("Invite code must be 6 characters");
      return;
    }

    try {
      const result = await resolveCode(normalized);
      router.push(`/rooms/${result.room.id}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Join failed");
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold">Join by Code</h2>
      <p className="mt-2 text-sm text-zinc-400">Enter a 6-character invite code.</p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="join-code">Invite Code</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="7KQ2MP"
            required
          />
        </div>

        <Button disabled={loading} type="submit">
          {loading ? "Joining..." : "Join Room"}
        </Button>
      </form>
    </Card>
  );
}