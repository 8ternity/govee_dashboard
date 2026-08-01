param(
    [Parameter(Mandatory = $true)]
    [string]$ZipFile
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$DataDir = Join-Path $Root "server\data"

if (-not (Test-Path $ZipFile)) {
    Write-Host "ERREUR: Fichier introuvable: $ZipFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

$Backup = Join-Path $DataDir ("_backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
if (Test-Path (Join-Path $DataDir "twitch.json")) {
    Write-Host "Sauvegarde ancienne config -> $Backup"
    Copy-Item $DataDir $Backup -Recurse -Force
}

Expand-Archive -Path $ZipFile -DestinationPath $DataDir -Force

Write-Host "Import terminé dans server/data/" -ForegroundColor Green
Write-Host "Relance le serveur puis: Twitch -> Tester la connexion`n"
