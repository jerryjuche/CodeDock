// components/dashboard/join-code-form.tsx
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
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      setError("Invite code must be exactly 6 characters.");
      return;
    }

    try {
      const result = await resolveCode(normalized);
      router.push(`/rooms/${result.room.id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to join room. Check the code and try again.",
      );
    }
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-white">Join by code</h2>
      <p className="mt-1 text-sm text-[rgb(158,183,211)]">
        Enter a 6-character invite code.
      </p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="join-code">Invite code</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            maxLength={6}
            placeholder="7KQ2MP"
            className="font-mono tracking-[0.22em] text-center text-base uppercase"
            required
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[12px] border border-[rgba(255,90,107,0.25)] bg-[rgba(255,90,107,0.08)] px-4 py-3"
          >
            <p className="text-sm text-[rgb(255,160,170)]">{error}</p>
          </div>
        ) : null}

        <Button disabled={loading} type="submit" className="w-full">
          {loading ? "Joining…" : "Join room"}
        </Button>
      </form>
    </Card>
  );
}