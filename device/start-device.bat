@echo off
REM Covo device runner for Windows — lets your Covo agent use this PC (with your approval).
REM 1) Put this file next to covo-device.js, tools.js, package.json
REM 2) Create device.config.json (copy device.config.example.json) with your server URL + token
REM 3) Double-click this file. To start with Windows: Win+R -> shell:startup -> put a shortcut to this file there.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org (LTS) & pause & exit /b 1)
if not exist node_modules ( echo Installing... & call npm install --no-audit --no-fund )
:loop
node covo-device.js %*
echo Runner stopped. Restarting in 5 seconds (close this window to quit)...
timeout /t 5 >nul
goto loop
