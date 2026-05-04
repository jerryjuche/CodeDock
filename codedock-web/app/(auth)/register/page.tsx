import Link from "next/link";
import MarketingShell from "@/components/marketing/marketing-shell";
import AuthShell from "@/components/auth/auth-shell";
import RegisterForm from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <MarketingShell showNav={false}>
      <AuthShell
        title="Create your CodeDock account"
        description="Set up access to the collaboration control plane and start launching shared coding sessions."
      >
        <RegisterForm />
      </AuthShell>
    </MarketingShell>
  );
}