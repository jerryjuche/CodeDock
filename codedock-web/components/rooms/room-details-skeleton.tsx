// components/rooms/room-details-skeleton.tsx
import { Card } from "@/components/ui/card";
import Skeleton from "@/components/ui/skeleton";

export default function RoomDetailsSkeleton() {
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-8 sm:px-8 lg:px-10">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Presence Card Skeleton */}
          <Card className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </Card>

          {/* Invites Section Skeleton */}
          <Card className="p-6">
            <Skeleton className="h-6 w-24 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Source State Card Skeleton */}
          <Card className="p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>

          {/* Launch Button Skeleton */}
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-10 w-full mt-5" />
          </Card>
        </div>
      </div>
    </main>
  );
}
