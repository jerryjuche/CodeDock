$ErrorActionPreference = "Stop"

Set-Location "C:\Users\Jerry Koko\CodeDock"
$repoRoot = (Get-Location).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "Applying CodeDock UI Layout Fixes..." -ForegroundColor Cyan

function Write-FileSafe {
    param(
        [string]$Path,
        [string]$Content
    )

    $full = Join-Path $repoRoot $Path
    $dir = Split-Path $full -Parent

    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    if (Test-Path $full) {
        Copy-Item $full "$full.bak.$timestamp" -Force
    }

    [System.IO.File]::WriteAllText($full, $Content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Updated $Path"
}

# -------------------------
# HOMEPAGE FIX
# -------------------------

$home = @'
import Link from "next/link";
import MarketingShell from "@/components/marketing/marketing-shell";
import TextRotate from "@/components/fancy/text/text-rotate";

export default function HomePage() {
  return (
    <MarketingShell>
      <main className="grid min-h-[calc(100vh-120px)] items-center gap-12 py-8 lg:grid-cols-[1.1fr_0.9fr]">

        <section className="max-w-4xl space-y-8">
          <h1 className="max-w-3xl text-[40px] leading-[1.1] font-semibold tracking-tight text-white sm:text-[48px] lg:text-[56px]">
            Self-hosted collaborative coding that feels{" "}
            <span className="inline-flex items-center rounded-lg bg-[rgb(239,102,46)] px-3 py-1 text-white">
              <TextRotate texts={["owned", "stable", "fast", "focused"]} />
            </span>
          </h1>

          <p className="max-w-2xl text-sm leading-7 text-[rgb(158,183,211)]">
            CodeDock gives engineering teams a control plane for shared VS Code sessions,
            room lifecycle, invites, and launch readiness.
          </p>

          <div className="flex gap-3">
            <Link href="/register" className="rounded-lg bg-[rgb(239,102,46)] px-5 py-2 text-sm text-white">
              Create account
            </Link>
            <Link href="/login" className="rounded-lg border border-white/15 px-5 py-2 text-sm text-white">
              Log in
            </Link>
          </div>
        </section>

        <section className="lg:justify-self-end lg:translate-y-[-10px]">
          <div className="w-full max-w-[420px] rounded-xl border border-white/10 bg-[rgba(8,30,63,0.8)] p-5">
            <p className="text-xs text-[rgb(158,183,211)] uppercase">Why CodeDock</p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-white font-medium">Built for teams</p>
                <p className="text-sm text-[rgb(158,183,211)]">High signal UI.</p>
              </div>

              <div>
                <p className="text-white font-medium">Launch-aware</p>
                <p className="text-sm text-[rgb(158,183,211)]">Full session control.</p>
              </div>

              <div>
                <p className="text-white font-medium">VS Code native</p>
                <p className="text-sm text-[rgb(158,183,211)]">Seamless integration.</p>
              </div>
            </div>
          </div>
        </section>

      </main>
    </MarketingShell>
  );
}
'@

Write-FileSafe "codedock-web/app/page.tsx" $home


# -------------------------
# HEADER FIX
# -------------------------

$header = @'
import Link from "next/link";
import BrandLogo from "@/components/brand/logo";

export default function MarketingShell({ children, showNav = true }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#041631,#011a3d)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">

        <header className="flex items-center justify-between py-3">
          <Link href="/">
            <BrandLogo />
          </Link>

          {showNav && (
            <nav className="flex items-center gap-3">
              <Link href="/login" className="border border-white/15 px-4 py-2 rounded-lg text-sm">
                Log in
              </Link>

              <Link href="/register" className="bg-[rgb(239,102,46)] px-4 py-2 rounded-lg text-sm">
                Create account
              </Link>
            </nav>
          )}
        </header>

        {children}

      </div>
    </div>
  );
}
'@

Write-FileSafe "codedock-web/components/marketing/marketing-shell.tsx" $header


# -------------------------
# AUTH SHELL FIX
# -------------------------

$auth = @'
import TextRotate from "@/components/fancy/text/text-rotate";

export default function AuthShell({ title, description, children, footer }) {
  return (
    <div className="grid min-h-[calc(100vh-120px)] items-center gap-10 py-8 lg:grid-cols-[1.1fr_0.9fr]">

      <section className="hidden lg:block">
        <h1 className="text-4xl font-semibold text-white leading-[1.1]">
          Real-time collaboration that feels{" "}
          <span className="inline-flex items-center rounded-lg bg-[rgb(239,102,46)] px-3 py-1 text-white">
            <TextRotate texts={["stable", "fast", "owned"]} />
          </span>
        </h1>

        <p className="mt-4 text-sm text-[rgb(158,183,211)]">
          Launch and manage collaborative coding sessions professionally.
        </p>
      </section>

      <section className="mx-auto w-full max-w-md">
        <div className="rounded-lg border border-white/10 bg-[rgba(8,30,63,0.85)] p-6">
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-[rgb(158,183,211)] mt-2">{description}</p>

          <div className="mt-6">
            {children}
          </div>

          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </section>

    </div>
  );
}
'@

Write-FileSafe "codedock-web/components/auth/auth-shell.tsx" $auth


Write-Host ""
Write-Host "UI Layout Fixes Applied Successfully." -ForegroundColor Green
Write-Host "Run next:"
Write-Host "cd codedock-web"
Write-Host "npx tsc --noEmit"
Write-Host "npm run dev"