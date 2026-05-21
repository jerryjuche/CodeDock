"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useRoomDetails } from "@/hooks/use-room-details";
import { useRoomPresence } from "@/hooks/use-room-presence";
import { useRoomActivities } from "@/hooks/use-room-activities";
import { useInvites } from "@/hooks/use-invites";
import { useAuth } from "@/hooks/use-auth";
import { useRoomSync } from "@/hooks/use-room-sync";
import RoomDetailsSkeleton from "@/components/rooms/room-details-skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { RoomPresenceMember } from "@/types/room";

// Dynamically import heavy components
const RoomHeader = dynamic(() => import("@/components/rooms/room-header"), {
  loading: () => <div className="h-16 bg-white/5 rounded-lg animate-pulse" />,
});

const PresenceCard = dynamic(() => import("@/components/rooms/presence-card"), {
  loading: () => <div className="h-32 bg-white/5 rounded-lg animate-pulse" />,
});

const MemberDetailsModal = dynamic(
  () => import("@/components/rooms/member-details-modal"),
  {
    loading: () => <div className="h-32 bg-white/5 rounded-lg animate-pulse" />,
  },
);

const SourceStateCard = dynamic(
  () => import("@/components/rooms/source-state-card"),
  {
    loading: () => <div className="h-48 bg-white/5 rounded-lg animate-pulse" />,
  },
);

const InviteList = dynamic(() => import("@/components/rooms/invite-list"), {
  loading: () => <div className="h-24 bg-white/5 rounded-lg animate-pulse" />,
});

const InviteCreateForm = dynamic(
  () => import("@/components/rooms/invite-create-form"),
  {
    loading: () => <div className="h-16 bg-white/5 rounded-lg animate-pulse" />,
  },
);

const OpenIDEButton = dynamic(
  () => import("@/components/rooms/open-ide-button"),
  {
    loading: () => <div className="h-32 bg-white/5 rounded-lg animate-pulse" />,
  },
);

const DeleteRoomButton = dynamic(
  () => import("@/components/rooms/delete-room-button"),
  {
    loading: () => (
      <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse" />
    ),
  },
);

const LeaveRoomButton = dynamic(
  () => import("@/components/rooms/leave-room-button"),
  {
    loading: () => (
      <div className="h-10 w-full bg-white/5 rounded-lg animate-pulse" />
    ),
  },
);

const Button = dynamic(
  () =>
    import("@/components/ui/button").then((mod) => ({ default: mod.Button })),
  {
    loading: () => (
      <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse" />
    ),
  },
);

export default function RoomDetailsPageClient({ roomId }: { roomId: string }) {
  const { userId } = useAuth();
  useRoomSync(roomId);
  const { details, loading, error, reload } = useRoomDetails(roomId);
  const {
    presence,
    loading: presenceLoading,
    error: presenceError,
    reload: reloadPresence,
  } = useRoomPresence(roomId);

  const {
    activities,
    loading: activitiesLoading,
    error: activitiesError,
    reload: reloadActivities,
  } = useRoomActivities(roomId);

  const {
    invites,
    loading: invitesLoading,
    error: invitesError,
    createInvite,
    revokeInvite,
    reload: reloadInvites,
  } = useInvites(roomId);

  const [selectedMember, setSelectedMember] =
    useState<RoomPresenceMember | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  if (loading) {
    return <RoomDetailsSkeleton />;
  }

  if (error || !details) {
    const isWaitingRoom = error?.trim() === "room_not_activated";

    if (isWaitingRoom) {
      return (
        <main className="mx-auto max-w-4xl px-6 py-10 sm:px-8">
          <Card className="text-center p-12">
            <h1 className="text-2xl font-semibold text-white">Waiting Room</h1>
            <p className="mt-3 text-sm text-[rgb(158,183,211)]">
              The host has not activated this room for guests yet. Please wait...
            </p>
            <div className="mt-6 flex justify-center">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 animate-[progress_1s_ease-in-out_infinite] bg-[rgb(42,211,139)] rounded-full" />
              </div>
            </div>
            <style jsx>{`
              @keyframes progress {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
              }
            `}</style>
          </Card>
        </main>
      );
    }

    const friendly = error?.toLowerCase().includes("forbidden")
      ? "You no longer have access to this room."
      : error?.toLowerCase().includes("not found")
        ? "This session has ended or the room no longer exists."
        : (error ?? "Room not found.");

    return (
      <main className="mx-auto max-w-4xl px-6 py-10 sm:px-8">
        <Card className="text-center p-12">
          <h1 className="text-2xl font-semibold text-white">Session ended</h1>
          <p className="mt-3 text-sm text-[rgb(158,183,211)]">{friendly}</p>
          <div className="mt-6">
            <Link href="/dashboard">
              <Button>Back to dashboard</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const isHost =
    details.membership.role === "host" || details.room.owner_user_id === userId;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-8 sm:px-8 lg:px-10">
      <ErrorBoundary>
        <RoomHeader details={details} />
      </ErrorBoundary>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <ErrorBoundary>
            <PresenceCard
              presence={presence}
              loading={presenceLoading}
              error={presenceError}
              onRetry={reloadPresence}
              onMemberClick={(member) => {
                setSelectedMember(member);
                setModalOpen(true);
              }}
            />
          </ErrorBoundary>

          {isHost ? (
            <>
              <ErrorBoundary>
                <InviteList
                  invites={invites}
                  loading={invitesLoading}
                  error={invitesError}
                  onRevoke={revokeInvite}
                  onRetry={reloadInvites}
                />
              </ErrorBoundary>
              <ErrorBoundary>
                <InviteCreateForm onCreate={createInvite} />
              </ErrorBoundary>
            </>
          ) : (
            <Card>
              <h3 className="text-lg font-semibold text-white">Access</h3>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                You joined this room as an editor. Invite management is
                available only to the host.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <ErrorBoundary>
            <SourceStateCard
              sourceState={details.source_state}
              roomId={roomId}
              isHost={isHost}
              onActivated={reload}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <OpenIDEButton
              roomId={roomId}
              launchAllowed={details.source_state.launch_allowed}
              launchReason={details.source_state.launch_reason}
              isHost={isHost}
            />
          </ErrorBoundary>
          
          {isHost ? (
            <ErrorBoundary>
              <DeleteRoomButton roomId={roomId} roomName={details.room.name} />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary>
              <LeaveRoomButton roomId={roomId} />
            </ErrorBoundary>
          )}
        </div>
      </div>

      {modalOpen && selectedMember && (
        <MemberDetailsModal
          member={selectedMember}
          activities={activities}
          roomId={roomId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </main>
  );
}

