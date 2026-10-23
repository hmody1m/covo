# ─────────────────────────────────────────────────────────────────────────────
# Covo — one-time Windows installer
# Right-click → "Run with PowerShell"  (or: powershell -ExecutionPolicy Bypass -File install-windows.ps1)
#   • installs Node.js LTS via winget if missing
#   • installs dependencies
#   • creates Desktop + Start-menu shortcuts
#   • optional: start automatically when you log in, and open the Windows firewall for your phone
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $Root
Write-Host "`nCovo installer — $Root`n" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js not found. Installing Node.js LTS with winget...' -ForegroundColor Yellow
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
  } else {
    Write-Host 'winget is not available. Install Node.js LTS from https://nodejs.org then run this again.' -ForegroundColor Red
    Start-Process 'https://nodejs.org/en/download'
    exit 1
  }
}
Write-Host ("Node " + (node -v))

Write-Host 'Installing dependencies...'
npm install --omit=dev --no-audit --no-fund

# Shortcuts
$shell = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) {
  $lnk = $shell.CreateShortcut((Join-Path $dir 'Covo.lnk'))
  $lnk.TargetPath = Join-Path $Root 'start.bat'
  $lnk.WorkingDirectory = "$Root"
  $lnk.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
  $lnk.Save()
}
Write-Host 'Shortcuts created (Desktop + Start menu).' -ForegroundColor Green

$auto = Read-Host 'Start Covo automatically when you log in? (y/N)'
if ($auto -match '^[yY]') {
  $startup = [Environment]::GetFolderPath('Startup')
  $vbs = Join-Path $startup 'Covo (hidden).vbs'
  # Runs the server hidden in the background
  "Set s = CreateObject(""WScript.Shell"")`r`ns.CurrentDirectory = ""$Root""`r`ns.Run ""cmd /c node server\index.js > data\server.log 2>&1"", 0, False" | Out-File -Encoding ASCII $vbs
  Write-Host "Autostart enabled: $vbs" -ForegroundColor Green
}

$fw = Read-Host 'Allow phones/tablets on your Wi-Fi to connect (opens TCP 8787 in Windows Firewall, needs admin)? (y/N)'
if ($fw -match '^[yY]') {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -Command `"New-NetFirewallRule -DisplayName 'Covo 8787' -Direction Inbound -Protocol TCP -LocalPort 8787 -Action Allow -Profile Private`""
  $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)' } | Select-Object -First 1).IPAddress
  Write-Host "On your phone open: http://$ip`:8787" -ForegroundColor Green
}

Write-Host "`nDone. Double-click 'Covo' on your Desktop to start.`n" -ForegroundColor Cyan
$go = Read-Host 'Start now? (Y/n)'
if ($go -notmatch '^[nN]') { Start-Process (Join-Path $Root 'start.bat') }
