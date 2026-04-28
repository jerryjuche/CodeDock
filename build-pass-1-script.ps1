$ErrorActionPreference = "Stop"

Set-Location "C:\Users\Jerry Koko\CodeDock"
$repoRoot = (Get-Location).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "Applying CodeDock UI Pass 1 (landing + auth)..." -ForegroundColor Cyan
Write-Host "Repo root: $repoRoot"

function Write-TextFile {
    param(
        [string]$RelativePath,
        [string]$Content
    )

    $fullPath = Join-Path $repoRoot $RelativePath
    $dir = Split-Path $fullPath -Parent

    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    if (Test-Path $fullPath) {
        Copy-Item $fullPath "$fullPath.bak.$timestamp" -Force
    }

    [System.IO.File]::WriteAllText($fullPath, $Content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Wrote $RelativePath"
}

$utilsTs = @'
export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}
'@

$logoTsx = @'
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      <Image
        src="/brand/codedock-logo.png"
        alt="CodeDock"
        width={420}
        height={140}
        priority={priority}
        className="h-auto w-[150px] sm:w-[175px] lg:w-[195px]"
      />
    </div>
  );
}
'@

$textRotateTsx = @'
"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export default function TextRotate({
  texts,
  interval = 2200,
  className,
}: {
  texts: string[];
  interval?: number;
  className?: string;
}) {
  const safeTexts = useMemo(() => texts.filter(Boolean), [texts]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (safeTexts.length <= 1) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % safeTexts.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [safeTexts, interval]);

  const current = safeTexts[index] ?? "";

  return (
    <span
      className={cn(
        "inline-flex min-w-[8ch] items-center justify-center rounded-xl bg-[rgb(239,102,46)] px-3 py-1 text-white shadow-[0_10px_28px_rgba(239,102,46,0.18)] transition-all duration-300",
        className,
      )}
    >
      {current}
    </span>
  );
}
'@

$skeletonTsx = @'
import { cn } from "@/lib/utils";

export default function Skeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("animate-pulse rounded-xl bg-white/8", className)} />;
}
'@

$marketingShellTsx = @'
import type { ReactNode } from "react";
import BrandLogo from "@/components/brand/logo";

export default function MarketingShell({
  children,
  showNav = true,
}: {
  children: ReactNode;
  showNav?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(36,166,242,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(239,102,46,0.10),transparent_18%),linear-gradient(180deg,rgba(4,22,49,1)_0%,rgba(1,26,61,1)_100%)] text-[rgb(234,244,255)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-6">
          <BrandLogo priority />
          {showNav ? (
            <nav className="hidden items-center gap-3 md:flex">
              <a href="/login" className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10">
                Log in
              </a>
              <a href="/register" className="rounded-xl bg-[rgb(239,102,46)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(249,145,53)]">
                Create account
              </a>
            </nav>
          ) : null}
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
'@

$authShellTsx = @'
import type { ReactNode } from "react";
import BrandLogo from "@/components/brand/logo";
import TextRotate from "@/components/fancy/text/text-rotate";

export default function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100vh-96px)] items-center gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden lg:block">
        <div className="space-y-6">
          <BrandLogo priority />
          <div className="space-y-4">
            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-white">
              Real-time collaboration that feels{" "}
              <TextRotate texts={["fast", "serious", "stable", "focused", "owned"]} className="align-middle" />
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[rgb(158,183,211)]">
              CodeDock gives engineering teams a focused control plane for shared coding sessions,
              launch flow, invites, and workspace readiness without giving up ownership.
            </p>
          </div>

          <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Self-hosted</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">Keep the collaboration stack under your control.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Room-based</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">Create rooms, invite teammates, and launch into VS Code.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Operational</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">Manage readiness, access, and session flow from one place.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-xl">
        <div className="rounded-[22px] border border-white/10 bg-[rgba(8,30,63,0.78)] p-7 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 space-y-2">
            <h2 className="text-3xl font-semibold text-white">{title}</h2>
            <p className="text-sm leading-7 text-[rgb(158,183,211)]">{description}</p>
          </div>
          {children}
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </section>
    </div>
  );
}
'@

$loginFormTsx = @'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function persistAuth(token: string, email: string) {
  const values: Array<[string, string]> = [
    ["codedock.token", token],
    ["codedock.auth.token", token],
    ["token", token],
    ["auth_token", token],
    ["codedock.user.email", email],
  ];

  for (const [key, value] of values) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }

  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new CustomEvent("codedock-auth-changed"));
}

export default function LoginForm() {
  const router = useRouter();
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Login failed");
      }

      const data = (await response.json()) as { token?: string; email?: string };

      if (!data.token) {
        throw new Error("Login succeeded but no token was returned.");
      }

      persistAuth(data.token, data.email ?? email);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="pt-1">
        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? "Signing in..." : "Log in"}
        </Button>
      </div>
    </form>
  );
}
'@

$registerFormTsx = @'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function persistAuth(token: string, email: string) {
  const values: Array<[string, string]> = [
    ["codedock.token", token],
    ["codedock.auth.token", token],
    ["token", token],
    ["auth_token", token],
    ["codedock.user.email", email],
  ];

  for (const [key, value] of values) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }

  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new CustomEvent("codedock-auth-changed"));
}

export default function RegisterForm() {
  const router = useRouter();
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Registration failed");
      }

      const data = (await response.json()) as { token?: string; email?: string };

      if (!data.token) {
        throw new Error("Registration succeeded but no token was returned.");
      }

      persistAuth(data.token, data.email ?? email);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="pt-1">
        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </div>
    </form>
  );
}
'@

$homePageTsx = @'
import Link from "next/link";
import MarketingShell from "@/components/marketing/marketing-shell";
import BrandLogo from "@/components/brand/logo";
import TextRotate from "@/components/fancy/text/text-rotate";

export default function HomePage() {
  return (
    <MarketingShell>
      <main className="grid min-h-[calc(100vh-96px)] items-center gap-12 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <BrandLogo priority />
          <div className="space-y-4">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Self-hosted collaborative coding that feels{" "}
              <TextRotate texts={["fast", "owned", "focused", "stable", "professional"]} />
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[rgb(158,183,211)]">
              CodeDock gives engineering teams a control plane for shared VS Code sessions,
              room lifecycle, invites, and launch readiness without sacrificing ownership.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl bg-[rgb(239,102,46)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[rgb(249,145,53)]">
              Create account
            </Link>
            <Link href="/login" className="rounded-xl border border-white/12 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10">
              Log in
            </Link>
          </div>

          <div className="grid max-w-4xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Own your stack</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">Deploy and operate collaboration on your own infrastructure.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Room workflow</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">Create rooms, invite collaborators, and launch into VS Code cleanly.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Control plane first</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">Manage session readiness, access, and launch from one place.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-[rgba(8,30,63,0.72)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[rgb(158,183,211)]">Why CodeDock</p>
              <div className="space-y-3">
                <div>
                  <div className="text-xl font-semibold text-white">Built for engineering teams</div>
                  <p className="mt-1 text-sm text-[rgb(158,183,211)]">High-signal collaboration UI without consumer-app noise.</p>
                </div>
                <div>
                  <div className="text-xl font-semibold text-white">Launch-aware workflow</div>
                  <p className="mt-1 text-sm text-[rgb(158,183,211)]">Readiness, invites, and workspace flow stay visible from the control plane.</p>
                </div>
                <div>
                  <div className="text-xl font-semibold text-white">Made for VS Code</div>
                  <p className="mt-1 text-sm text-[rgb(158,183,211)]">Rooms are created on the web and launched directly into editor sessions.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
'@

$loginPageTsx = @'
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
        footer={
          <p className="text-sm text-[rgb(158,183,211)]">
            New to CodeDock?{" "}
            <Link href="/register" className="font-medium text-white underline underline-offset-4">
              Create an account
            </Link>
          </p>
        }
      >
        <LoginForm />
      </AuthShell>
    </MarketingShell>
  );
}
'@

$registerPageTsx = @'
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
        footer={
          <p className="text-sm text-[rgb(158,183,211)]">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-white underline underline-offset-4">
              Log in
            </Link>
          </p>
        }
      >
        <RegisterForm />
      </AuthShell>
    </MarketingShell>
  );
}
'@

Write-TextFile "codedock-web/lib/utils.ts" $utilsTs
Write-TextFile "codedock-web/components/brand/logo.tsx" $logoTsx
Write-TextFile "codedock-web/components/fancy/text/text-rotate.tsx" $textRotateTsx
Write-TextFile "codedock-web/components/ui/skeleton.tsx" $skeletonTsx
Write-TextFile "codedock-web/components/marketing/marketing-shell.tsx" $marketingShellTsx
Write-TextFile "codedock-web/components/auth/auth-shell.tsx" $authShellTsx

$loginFormPath = Join-Path $repoRoot "codedock-web/components/auth/login-form.tsx"
if (-not (Test-Path $loginFormPath)) {
    Write-TextFile "codedock-web/components/auth/login-form.tsx" $loginFormTsx
} else {
    Write-Host "Skipped codedock-web/components/auth/login-form.tsx (already exists)"
}

$registerFormPath = Join-Path $repoRoot "codedock-web/components/auth/register-form.tsx"
if (-not (Test-Path $registerFormPath)) {
    Write-TextFile "codedock-web/components/auth/register-form.tsx" $registerFormTsx
} else {
    Write-Host "Skipped codedock-web/components/auth/register-form.tsx (already exists)"
}

Write-TextFile "codedock-web/app/page.tsx" $homePageTsx
Write-TextFile "codedock-web/app/login/page.tsx" $loginPageTsx
Write-TextFile "codedock-web/app/register/page.tsx" $registerPageTsx

Write-Host ""
Write-Host "CodeDock UI Pass 1 applied." -ForegroundColor Green
Write-Host "Make sure your logo exists at codedock-web/public/brand/codedock-logo.png" -ForegroundColor Yellow
Write-Host "Next commands:" -ForegroundColor Yellow
Write-Host 'Set-Location "C:\Users\Jerry Koko\CodeDock\codedock-web"'
Write-Host 'npx tsc --noEmit'
Write-Host 'npm run dev'
