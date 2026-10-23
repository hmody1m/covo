# Optional: run Covo as a real Windows service (starts at boot, even before login).
# Uses NSSM (the Non-Sucking Service Manager). Run PowerShell as Administrator.
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) { winget install -e --id NSSM.NSSM --accept-source-agreements --accept-package-agreements }
$node = (Get-Command node).Source
nssm install Covo $node "server\index.js"
nssm set Covo AppDirectory $Root
nssm set Covo AppStdout (Join-Path $Root 'data\service.log')
nssm set Covo AppStderr (Join-Path $Root 'data\service.log')
nssm set Covo AppEnvironmentExtra PORT=8787
nssm start Covo
Write-Host 'Service "Covo" installed and started. Manage it in services.msc.' -ForegroundColor Green
