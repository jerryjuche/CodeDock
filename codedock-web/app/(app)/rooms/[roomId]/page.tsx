import InviteCreateForm from "@/components/rooms/invite-create-form";
import InviteList from "@/components/rooms/invite-list";
import OpenInVSCodeButton from "@/components/rooms/open-in-vscode-button";
import RoomHeader from "@/components/rooms/room-header";

type Props = {
  params: Promise<{
    roomId: string;
  }>;
};

export default async function RoomDetailsPage({ params }: Props) {
  const { roomId } = await params;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <RoomHeader roomId={roomId} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <InviteList roomId={roomId} />
        <div className="space-y-6">
          <InviteCreateForm roomId={roomId} />
          <OpenInVSCodeButton roomId={roomId} />
        </div>
      </div>
    </main>
  );
}