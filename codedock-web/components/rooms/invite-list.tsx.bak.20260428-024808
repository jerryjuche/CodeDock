"use client";

import { useInvites } from "@/hooks/use-invites";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InviteList({ roomId }: { roomId: string }) {
  const { invites, loading, error, revokeInvite } = useInvites(roomId);

  return (
    <Card>
      <h2 className="text-xl font-semibold">Invite Tokens</h2>
      <p className="mt-2 text-sm text-zinc-400">Manage room-specific invite tokens.</p>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div>Loading invites...</div>
        ) : error ? (
          <div>{error}</div>
        ) : invites.length === 0 ? (
          <div className="text-sm text-zinc-400">No invite tokens yet.</div>
        ) : (
          invites.map((invite) => (
            <div
              key={invite.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-sm font-semibold">{invite.code}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    uses: {invite.uses_count}
                    {invite.max_uses ? ` / ${invite.max_uses}` : ""}
                    {invite.is_revoked ? " · revoked" : ""}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => revokeInvite(invite.id)}>
                  Revoke
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
