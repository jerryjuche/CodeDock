$ErrorActionPreference = "Stop"

Set-Location "C:\Users\Jerry Koko\CodeDock"
$repoRoot = (Get-Location).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "Applying CodeDock Pass 1.1 layout fixes..." -ForegroundColor Cyan
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

$authGroupLayout = @'
import type { ReactNode } from "react";

export default function AuthGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
'@

$marketingShell = @'
import type { ReactNode } from "react";
import Link from "next/link";
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
          <Link href="/" className="shrink-0">
            <BrandLogo priority />
          </Link>

          {showNav ? (
            <nav className="hidden items-center gap-3 md:flex">
              <Link
                href="/login"
                className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-[rgb(239,102,46)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(249,145,53)]"
              >
                Create account
              </Link>
            </nav>
          ) : (
            <Link
              href="/"
              className="hidden text-sm text-[rgb(158,183,211)] transition hover:text-white md:inline-flex"
            >
              ← Back to home
            </Link>
          )}
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
'@

$authShell = @'
import type { ReactNode } from "react";
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
    <div className="grid min-h-[calc(100vh-96px)] items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden lg:block">
        <div className="max-w-2xl space-y-6">
          <div className="space-y-4">
            <h1 className="text-5xl font-semibold tracking-tight text-white">
              Real-time collaboration that feels{" "}
              <TextRotate
                texts={["focused", "stable", "fast", "owned", "professional"]}
                className="align-middle"
              />
            </h1>
            <p className="text-base leading-8 text-[rgb(158,183,211)]">
              CodeDock gives engineering teams a focused control plane for shared coding sessions,
              launch flow, invites, and workspace readiness without giving up ownership.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Self-hosted</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Keep the collaboration stack under your control.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Room-based</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Create rooms, invite teammates, and launch cleanly into VS Code.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Operational</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Manage readiness, access, and session flow from one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-lg items-center">
        <div className="w-full rounded-[22px] border border-white/10 bg-[rgba(8,30,63,0.82)] p-7 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl sm:p-8">
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

$homePage = @'
import Link from "next/link";
import MarketingShell from "@/components/marketing/marketing-shell";
import TextRotate from "@/components/fancy/text/text-rotate";

export default function HomePage() {
  return (
    <MarketingShell>
      <main className="grid min-h-[calc(100vh-96px)] items-center gap-12 py-12 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="max-w-4xl space-y-8">
          <div className="space-y-4">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Self-hosted collaborative coding that feels{" "}
              <TextRotate
                texts={["owned", "stable", "fast", "focused", "professional"]}
              />
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[rgb(158,183,211)]">
              CodeDock gives engineering teams a control plane for shared VS Code sessions,
              room lifecycle, invites, and launch readiness without sacrificing ownership.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-xl bg-[rgb(239,102,46)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[rgb(249,145,53)]"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-white/12 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Log in
            </Link>
          </div>

          <div className="grid max-w-4xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Own your stack</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Deploy and operate collaboration on your own infrastructure.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Room workflow</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Create rooms, invite collaborators, and launch directly into VS Code.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-white">Control plane first</div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Manage session readiness, access, and launch from one place.
              </p>
            </div>
          </div>
        </section>

        <section className="lg:justify-self-end">
          <div className="w-full max-w-[440px] rounded-[24px] border border-white/10 bg-[rgba(8,30,63,0.76)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[rgb(158,183,211)]">
                Why CodeDock
              </p>

              <div className="space-y-4">
                <div>
                  <div className="text-xl font-semibold text-white">
                    Built for engineering teams
                  </div>
                  <p className="mt-1 text-sm leading-7 text-[rgb(158,183,211)]">
                    High-signal collaboration UI without consumer-app noise.
                  </p>
                </div>

                <div>
                  <div className="text-xl font-semibold text-white">
                    Launch-aware workflow
                  </div>
                  <p className="mt-1 text-sm leading-7 text-[rgb(158,183,211)]">
                    Readiness, invites, and workspace flow stay visible from the control plane.
                  </p>
                </div>

                <div>
                  <div className="text-xl font-semibold text-white">
                    Made for VS Code
                  </div>
                  <p className="mt-1 text-sm leading-7 text-[rgb(158,183,211)]">
                    Rooms are created on the web and launched directly into editor sessions.
                  </p>
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

$loginPage = @'
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

$registerPage = @'
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

Write-TextFile "codedock-web/app/(auth)/layout.tsx" $authGroupLayout
Write-TextFile "codedock-web/components/marketing/marketing-shell.tsx" $marketingShell
Write-TextFile "codedock-web/components/auth/auth-shell.tsx" $authShell
Write-TextFile "codedock-web/app/page.tsx" $homePage
Write-TextFile "codedock-web/app/(auth)/login/page.tsx" $loginPage
Write-TextFile "codedock-web/app/(auth)/register/page.tsx" $registerPage

Write-Host ""
Write-Host "CodeDock Pass 1.1 layout fixes applied." -ForegroundColor Green
Write-Host "Next commands:" -ForegroundColor Yellow
Write-Host 'Set-Location "C:\Users\Jerry Koko\CodeDock\codedock-web"'
Write-Host 'Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue'
Write-Host 'npx tsc --noEmit'
Write-Host 'npm run dev'
