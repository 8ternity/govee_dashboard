# Exporte server/data/ pour migration (secrets Twitch retires du backup)
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$DataDir = Join-Path $Root "server\data"

if (-not (Test-Path $DataDir)) {
    Write-Host "ERREUR: $DataDir introuvable" -ForegroundColor Red
    exit 1
}

$Date = Get-Date -Format "yyyy-MM-dd"
$OutZip = Join-Path $Root "govee-dashboard-backup-$Date.zip"
$Staging = Join-Path $env:TEMP ("govee-backup-" + [guid]::NewGuid().ToString("N"))

try {
    New-Item -ItemType Directory -Path $Staging -Force | Out-Null

    Get-ChildItem -Path $DataDir -File | Where-Object { $_.Name -ne "twitch.json" } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Staging $_.Name) -Force
    }

    $TwitchPath = Join-Path $DataDir "twitch.json"
    if (Test-Path $TwitchPath) {
        $Twitch = Get-Content $TwitchPath -Raw | ConvertFrom-Json
        $Sensitive = @("clientId", "clientSecret", "accessToken", "refreshToken", "tokenExpiresAt")
        foreach ($k in $Sensitive) {
            if ($Twitch.PSObject.Properties.Name -contains $k) {
                $Twitch.PSObject.Properties.Remove($k)
            }
        }
        $Twitch | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $Staging "twitch.json") -Encoding UTF8
    }

    if (Test-Path $OutZip) { Remove-Item $OutZip -Force }
    Compress-Archive -Path "$Staging\*" -DestinationPath $OutZip -Force

    Write-Host "Backup cree (secrets Twitch retires):" -ForegroundColor Green
    Write-Host $OutZip
} finally {
    Remove-Item -LiteralPath $Staging -Recurse -Force -ErrorAction SilentlyContinue
}
