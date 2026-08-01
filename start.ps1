# Demarre Govee Dashboard (http://localhost:3001)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$ServerDir = Join-Path $Root "server"
$DistDir = Join-Path $Root "client\dist"

if (-not (Test-Path (Join-Path $ServerDir "node_modules"))) {
    Write-Host 'Dependances manquantes. Lance d''abord: .\install.ps1' -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $DistDir)) {
    Write-Host "Build frontend manquant. Lance: cd client; npm run build" -ForegroundColor Yellow
    exit 1
}

$port = netstat -ano 2>$null | Select-String ":3001.*LISTENING"
if ($port) {
    Write-Host "Port 3001 deja utilise - app peut-etre deja demarree." -ForegroundColor Yellow
    Write-Host "http://localhost:3001"
    exit 0
}

Write-Host "Demarrage Govee Dashboard..." -ForegroundColor Cyan
Write-Host "http://localhost:3001"
Write-Host ""

Set-Location $ServerDir
npm run dev
