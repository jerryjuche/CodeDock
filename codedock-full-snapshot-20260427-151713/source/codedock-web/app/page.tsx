import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-6 px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-10 shadow-xl">
        <h1 className="text-4xl font-semibold tracking-tight">CodeDock</h1>
        <p className="mt-3 max-w-xl text-zinc-400">
          Web control plane for rooms, invites, launch tokens, and VS Code collaboration.
        </p>
        <div className="mt-6 flex gap-3">
          <Link className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black" href="/login">
            Login
          </Link>
          <Link className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium" href="/register">
            Register
          </Link>
          <Link className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
