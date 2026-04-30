// components/rooms/invite-create-form.tsx
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
      window.alert(
        error instanceof Error ? error.message : "Invite creation failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h3 className="text-base font-semibold text-white">Create invite</h3>
      <p className="mt-0.5 text-sm text-[rgb(158,183,211)]">
        Both fields are optional. Leave blank for an unlimited, non-expiring token.
      </p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="expires-in-hours">
              Expires in hours{" "}
              <span className="text-[rgb(158,183,211)] font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="expires-in-hours"
              type="number"
              min={1}
              placeholder="e.g. 24"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max-uses">
              Max uses{" "}
              <span className="text-[rgb(158,183,211)] font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="max-uses"
              type="number"
              min={1}
              placeholder="e.g. 5"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-1">
          <Button type="submit" disabled={submitting} variant="cyan">
            {submitting ? "Creating…" : "Create invite token"}
          </Button>
        </div>
      </form>
    </Card>
  );
}