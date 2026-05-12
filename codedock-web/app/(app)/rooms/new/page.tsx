import CreateRoomForm from "@/components/rooms/create-room-form";

export default function NewRoomPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Create Room</h1>
      <p className="mt-2 text-[rgb(158,183,211)]">
        Create a new CodeDock room and choose the project source.
      </p>
      <div className="mt-6">
        <CreateRoomForm />
      </div>
    </main>
  );
}