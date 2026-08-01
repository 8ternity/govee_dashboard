# Govee Dashboard — installation des dépendances + build frontend
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "`n=== Govee Dashboard — Installation ===" -ForegroundColor Cyan

# Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: Node.js introuvable. Installe-le depuis https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "Node $(node -v) / npm $(npm -v)"

# server
Write-Host "`n[1/3] server..." -ForegroundColor Yellow
Push-Location "$Root\server"
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

# client
Write-Host "`n[2/3] client..." -ForegroundColor Yellow
Push-Location "$Root\client"
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

Write-Host "`n[3/3] build frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

# data folder
$dataDir = "$Root\server\data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
    Write-Host "Dossier server/data/ créé."
}

Write-Host "`n=== Terminé ===" -ForegroundColor Green
Write-Host "Lancer:  cd server; npm run dev"
Write-Host "Ouvrir:  http://localhost:3001`n"
