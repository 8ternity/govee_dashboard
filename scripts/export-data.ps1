# Exporte server/data/ pour migration (inclut clés Twitch)
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$DataDir = Join-Path $Root "server\data"

if (-not (Test-Path $DataDir)) {
    Write-Host "ERREUR: $DataDir introuvable" -ForegroundColor Red
    exit 1
}

$Date = Get-Date -Format "yyyy-MM-dd"
$OutZip = Join-Path $Root "govee-dashboard-backup-$Date.zip"

if (Test-Path $OutZip) { Remove-Item $OutZip -Force }

Compress-Archive -Path "$DataDir\*" -DestinationPath $OutZip -Force

Write-Host "Backup créé:" -ForegroundColor Green
Write-Host $OutZip
Write-Host "`nContient: twitch.json, devices, presets, settings..."
Write-Host "Sur l'autre PC: .\scripts\import-data.ps1 -ZipFile <chemin>`n"
