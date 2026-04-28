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
                    {invite.is_revoked ? " Â· revoked" : ""}
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