@echo off
REM ─────────────────────────────────────────────────────────────
REM  Covo — start on Windows (double-click me)
REM ─────────────────────────────────────────────────────────────
title Covo
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Run scripts\windows\install-windows.ps1 ^(right-click ^> Run with PowerShell^) or install Node.js LTS from https://nodejs.org
  echo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies ^(first run only^)...
  call npm install --omit=dev --no-audit --no-fund
)
if "%PORT%"=="" set PORT=8787
echo.
echo  Covo is starting on http://localhost:%PORT%
echo  Phone on the same Wi-Fi: http://YOUR-PC-IP:%PORT%   (see docs\DEPLOY_WINDOWS.md)
echo  Close this window to stop.
echo.
start "" http://localhost:%PORT%
node server\index.js
pause
