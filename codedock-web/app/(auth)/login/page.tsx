import { Suspense } from "react";
import Link from "next/link";
import MarketingShell from "@/components/marketing/marketing-shell";
import AuthShell from "@/components/auth/auth-shell";
import LoginForm from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <MarketingShell showNav={false}>
      <AuthShell
        title="Log in to CodeDock"
        description="Access your rooms, launch sessions, and continue collaboration from the control plane."
      >
        <Suspense fallback={<div>Loading login...</div>}>
          <LoginForm />
        </Suspense>
      </AuthShell>
    </MarketingShell>
  );
}