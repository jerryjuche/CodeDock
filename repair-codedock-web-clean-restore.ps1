$ErrorActionPreference = "Stop"

Set-Location "C:\Users\Jerry Koko\CodeDock"

$repoRoot = (Get-Location).Path
$currentWeb = Join-Path $repoRoot "codedock-web"

$snapshotCandidates = @(
  "codedock-full-snapshot-20260427-151713",
  "codedock-full-snapshot-20260427-151623"
)

$snapshotSource = $null
foreach ($name in $snapshotCandidates) {
  $candidate = Join-Path $repoRoot "$name\source\codedock-web"
  if (Test-Path $candidate) {
    $snapshotSource = $candidate
    break
  }
}

if (-not $snapshotSource) {
  throw "Could not find a snapshot source folder."
}

if (-not (Test-Path $currentWeb)) {
  throw "Current codedock-web folder not found: $currentWeb"
}

Write-Host "Using snapshot source:" -ForegroundColor Green
Write-Host "  $snapshotSource"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$tmpNodeModules = Join-Path $repoRoot "__codedock_web_node_modules_tmp_$timestamp"
$tmpEnvLocal = Join-Path $repoRoot "__codedock_web_envlocal_tmp_$timestamp"
$tmpLogoDir = Join-Path $repoRoot "__codedock_web_logo_tmp_$timestamp"

# Preserve local-only items
if (Test-Path (Join-Path $currentWeb "node_modules")) {
  Move-Item (Join-Path $currentWeb "node_modules") $tmpNodeModules
}

if (Test-Path (Join-Path $currentWeb ".env.local")) {
  Move-Item (Join-Path $currentWeb ".env.local") $tmpEnvLocal
}

if (Test-Path (Join-Path $currentWeb "public\brand\codedock-logo.png")) {
  New-Item -ItemType Directory -Force -Path $tmpLogoDir | Out-Null
  Move-Item (Join-Path $currentWeb "public\brand\codedock-logo.png") (Join-Path $tmpLogoDir "codedock-logo.png")
}

Write-Host "Removing stale .next cache if present..." -ForegroundColor Cyan
if (Test-Path (Join-Path $currentWeb ".next")) {
  Remove-Item (Join-Path $currentWeb ".next") -Recurse -Force
}

Write-Host "Cleaning current codedock-web contents..." -ForegroundColor Cyan
Get-ChildItem $currentWeb -Force | Remove-Item -Recurse -Force

Write-Host "Restoring snapshot contents..." -ForegroundColor Cyan
Copy-Item "$snapshotSource\*" $currentWeb -Recurse -Force

# Restore preserved items
if (Test-Path $tmpNodeModules) {
  Move-Item $tmpNodeModules (Join-Path $currentWeb "node_modules")
}

if (Test-Path $tmpEnvLocal) {
  Move-Item $tmpEnvLocal (Join-Path $currentWeb ".env.local")
}

if (Test-Path (Join-Path $tmpLogoDir "codedock-logo.png")) {
  New-Item -ItemType Directory -Force -Path (Join-Path $currentWeb "public\brand") | Out-Null
  Move-Item (Join-Path $tmpLogoDir "codedock-logo.png") (Join-Path $currentWeb "public\brand\codedock-logo.png")
  Remove-Item $tmpLogoDir -Recurse -Force
}

Write-Host ""
Write-Host "Clean restore complete." -ForegroundColor Green
Write-Host ""
Write-Host "Now run these commands:" -ForegroundColor Yellow
Write-Host 'Set-Location "C:\Users\Jerry Koko\CodeDock\codedock-web"'
Write-Host 'Get-ChildItem'
Write-Host 'npx tsc --noEmit'
Write-Host 'npm run dev'