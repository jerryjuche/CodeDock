"use client";

import JoinCodeForm from "@/components/dashboard/join-code-form";

export default function JoinPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Join Room</h1>
      <p className="mt-2 text-zinc-400">
        Enter a 6-character invite code to join a room.
      </p>

      <div className="mt-6">
        <JoinCodeForm />
      </div>
    </main>
  );
}