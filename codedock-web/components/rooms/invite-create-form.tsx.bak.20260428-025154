"use client";

import { useState } from "react";
import { useInvites } from "@/hooks/use-invites";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InviteCreateForm({ roomId }: { roomId: string }) {
  const { createInvite } = useInvites(roomId);
  const [expiresInHours, setExpiresInHours] = useState("");
  const [maxUses, setMaxUses] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await createInvite({
        expires_in_hours: expiresInHours ? Number(expiresInHours) : undefined,
        max_uses: maxUses ? Number(maxUses) : undefined
      });
      setExpiresInHours("");
      setMaxUses("");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Invite creation failed");
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold">Create Invite</h3>
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="expires-in-hours">Expires In Hours</Label>
          <Input
            id="expires-in-hours"
            type="number"
            min={1}
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="max-uses">Max Uses</Label>
          <Input
            id="max-uses"
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
        </div>
        <Button type="submit">Create Invite Token</Button>
      </form>
    </Card>
  );
}
