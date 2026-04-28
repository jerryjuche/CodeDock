$ErrorActionPreference = "Stop"

Set-Location "C:\Users\Jerry Koko\CodeDock"
$repoRoot = (Get-Location).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "Fixing Next.js auth route conflict..." -ForegroundColor Cyan
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

# Remove duplicate direct routes if they exist
$duplicatePaths = @(
    "codedock-web/app/login/page.tsx",
    "codedock-web/app/register/page.tsx"
)

foreach ($relative in $duplicatePaths) {
    $full = Join-Path $repoRoot $relative
    if (Test-Path $full) {
        Copy-Item $full "$full.bak.$timestamp" -Force
        Remove-Item $full -Force
        Write-Host "Removed duplicate route $relative" -ForegroundColor Yellow
    }
}

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

Write-TextFile "codedock-web/app/(auth)/login/page.tsx" $loginPage
Write-TextFile "codedock-web/app/(auth)/register/page.tsx" $registerPage

Write-Host ""
Write-Host "Auth route conflict fixed." -ForegroundColor Green
Write-Host "Next commands:" -ForegroundColor Yellow
Write-Host 'Set-Location "C:\Users\Jerry Koko\CodeDock\codedock-web"'
Write-Host 'Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue'
Write-Host 'npx tsc --noEmit'
Write-Host 'npm run dev'