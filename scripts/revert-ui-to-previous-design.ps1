Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

# Snapshot name to restore from
$snapshotName = "codedock-full-snapshot-20260427-151713"

$currentWeb = Join-Path $repoRoot "codedock-web"
$backupWeb = Join-Path $repoRoot "codedock-web.backup-$timestamp"

$snapshotFolderSource = Join-Path $repoRoot "$snapshotName\source\codedock-web"
$snapshotArchive = Join-Path $repoRoot "$snapshotName.tar.gz"

$tempExtractRoot = Join-Path $env:TEMP "codedock-restore-$timestamp"
$tempSource = Join-Path $tempExtractRoot "$snapshotName\source\codedock-web"

if (-not (Test-Path $currentWeb)) {
    throw "Current codedock-web folder not found at: $currentWeb"
}

Write-Host "Backing up current codedock-web to:" -ForegroundColor Cyan
Write-Host "  $backupWeb"

# Preserve useful local-only artifacts if they exist
$preserveNodeModules = $null
$preserveEnvLocal = $null

if (Test-Path (Join-Path $currentWeb "node_modules")) {
    $preserveNodeModules = Join-Path $repoRoot "codedock-web.node_modules.$timestamp"
    Move-Item (Join-Path $currentWeb "node_modules") $preserveNodeModules
}

if (Test-Path (Join-Path $currentWeb ".env.local")) {
    $preserveEnvLocal = Join-Path $repoRoot "codedock-web.envlocal.$timestamp"
    Move-Item (Join-Path $currentWeb ".env.local") $preserveEnvLocal
}

Move-Item $currentWeb $backupWeb

$newSource = $null

if (Test-Path $snapshotFolderSource) {
    Write-Host "Using snapshot folder source:" -ForegroundColor Green
    Write-Host "  $snapshotFolderSource"
    $newSource = $snapshotFolderSource
}
elseif (Test-Path $snapshotArchive) {
    Write-Host "Using snapshot archive source:" -ForegroundColor Green
    Write-Host "  $snapshotArchive"

    New-Item -ItemType Directory -Force -Path $tempExtractRoot | Out-Null

    tar -xzf $snapshotArchive -C $tempExtractRoot
    if (-not (Test-Path $tempSource)) {
        throw "Archive extracted, but codedock-web source was not found in: $tempSource"
    }

    $newSource = $tempSource
}
else {
    throw "Neither snapshot folder nor archive was found.`nExpected one of:`n  $snapshotFolderSource`n  $snapshotArchive"
}

Write-Host "Restoring codedock-web from snapshot..." -ForegroundColor Cyan
Copy-Item $newSource $currentWeb -Recurse -Force

if ($preserveNodeModules -and (Test-Path $preserveNodeModules)) {
    Write-Host "Restoring preserved node_modules..." -ForegroundColor Yellow
    Move-Item $preserveNodeModules (Join-Path $currentWeb "node_modules")
}

if ($preserveEnvLocal -and (Test-Path $preserveEnvLocal)) {
    Write-Host "Restoring preserved .env.local..." -ForegroundColor Yellow
    Move-Item $preserveEnvLocal (Join-Path $currentWeb ".env.local")
}

Write-Host ""
Write-Host "Restore complete." -ForegroundColor Green
Write-Host "Current UI restored from snapshot: $snapshotName"
Write-Host "Backup of your overwritten UI is here:"
Write-Host "  $backupWeb"

Write-Host ""
Write-Host "Next commands:" -ForegroundColor Cyan
Write-Host '  Set-Location "C:\Users\Jerry Koko\CodeDock\codedock-web"'
Write-Host '  npx tsc --noEmit'
Write-Host '  npm run dev'  