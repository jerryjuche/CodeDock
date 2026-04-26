"use client";

import JoinCodeForm from "@/components/dashboard/join-code-form";
import RoomList from "@/components/dashboard/room-list";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-zinc-400">
          Manage rooms, join by code, and launch collaboration sessions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <RoomList />
        <JoinCodeForm />
      </div>
    </main>
  );
}