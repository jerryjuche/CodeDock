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