// app/(app)/dashboard/page.tsx
// Layout only — all logic lives in RoomList and JoinCodeForm hooks unchanged.
import RoomList from "@/components/dashboard/room-list";
import JoinCodeForm from "@/components/dashboard/join-code-form";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-[rgb(158,183,211)]">
          Your active collaboration rooms and quick-join access.
        </p>
      </div>

      {/* Main layout: rooms (primary) + join panel (secondary) */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Room list — fills available space */}
        <RoomList />

        {/* Sidebar: join by code */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <JoinCodeForm />
        </div>
      </div>
    </main>
  );
}