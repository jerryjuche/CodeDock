import CodeReviewPageClient from "@/components/rooms/code-review-page";

type Props = {
  params: Promise<{
    roomId: string;
    userId: string;
  }>;
};

export default async function CodeReviewPage({ params }: Props) {
  const { roomId, userId } = await params;
  return <CodeReviewPageClient roomId={roomId} userId={userId} />;
}
