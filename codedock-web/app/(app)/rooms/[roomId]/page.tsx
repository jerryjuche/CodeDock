import RoomDetailsPageClient from "@/components/rooms/room-details-page";

type Props = {
  params: Promise<{
    roomId: string;
  }>;
};

export default async function RoomDetailsPage({ params }: Props) {
  const { roomId } = await params;
  return <RoomDetailsPageClient roomId={roomId} />;
}