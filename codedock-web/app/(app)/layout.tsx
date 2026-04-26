import AuthGuard from "@/components/auth/auth-guard";
import AppShell from "@/components/app-shell";

export default function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}