import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full">
        <div className="mb-6">
          <Link href="/" className="text-sm text-zinc-400 hover:text-white">
            ← Back to home
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}