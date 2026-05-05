// components/rooms/invite-list.tsx
"use client";

import { useState } from "react";
import type { RoomInviteToken } from "@/types/invite";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — fail silently
    }
  }

  return (
    <button
      onClick={() => void handleCopy()}
      className="ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors"
      style={
        copied
          ? { color: "rgb(42,211,139)", background: "rgba(42,211,139,0.1)" }
          : { color: "rgb(158,183,211)", background: "rgba(255,255,255,0.06)" }
      }
      aria-label={`Copy invite code ${code}`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function InviteStatusChip({ invite }: { invite: RoomInviteToken }) {
  if (invite.is_revoked) {
    return (
      <span className="inline-flex items-center rounded-full bg-[rgba(255,90,107,0.12)] px-2.5 py-0.5 text-[11px] font-medium text-[rgb(255,160,170)]">
        Revoked
      </span>
    );
  }

  const exhausted =
    invite.max_uses != null && invite.uses_count >= invite.max_uses;
  if (exhausted) {
    return (
      <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-[rgb(158,183,211)]">
        Exhausted
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(42,211,139,0.1)] px-2.5 py-0.5 text-[11px] font-medium text-[rgb(42,211,139)]">
      <span className="h-1 w-1 rounded-full bg-[rgb(42,211,139)]" />
      Active
    </span>
  );
}

export default function InviteList({
  invites,
  loading,
  error,
  onRevoke,
  onRetry,
}: {
  invites: RoomInviteToken[];
  loading: boolean;
  error: string | null;
  onRevoke: (inviteId: string) => Promise<void>;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Invite tokens</h2>
          <p className="mt-0.5 text-sm text-[rgb(158,183,211)]">
            Room-specific tokens for collaborator access.
          </p>
        </div>
        {!loading && !error && invites.length > 0 && (
          <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-[rgb(158,183,211)]">
            {invites.length}
          </span>
        )}
      </div>

      <div className="mt-5 space-y-2.5">
        {loading ? (
          <div className="space-y-2.5">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-white/[0.03]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-[rgb(255,160,170)] mb-3">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 text-xs font-medium rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        ) : invites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-6 text-center">
            <p className="text-sm text-[rgb(158,183,211)]">
              No invite tokens yet. Create one below.
            </p>
          </div>
        ) : (
          invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5"
            >
              <div className="min-w-0">
                {/* Token code row */}
                <div className="flex items-center">
                  <span className="font-mono text-sm font-semibold tracking-[0.14em] text-white">
                    {invite.code}
                  </span>
                  {!invite.is_revoked && <CopyCodeButton code={invite.code} />}
                </div>
                {/* Meta row */}
                <div className="mt-1 flex items-center gap-2 text-[11px] text-[rgb(158,183,211)]">
                  <InviteStatusChip invite={invite} />
                  <span>
                    {invite.uses_count}
                    {invite.max_uses != null
                      ? ` / ${invite.max_uses}`
                      : ""}{" "}
                    uses
                  </span>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                disabled={invite.is_revoked}
                onClick={() => void onRevoke(invite.id)}
              >
                {invite.is_revoked ? "Revoked" : "Revoke"}
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
