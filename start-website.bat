@echo off
setlocal
cd /d "%~dp0admin-panel"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install it from https://nodejs.org then try again.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json not found in admin-panel - is the folder in the right place?
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules not found - running npm install first, this can take a minute...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. See the output above for details.
    pause
    exit /b 1
  )
)

echo Starting Satyam Stars admin panel (website) on http://localhost:3000 ...
call npm run dev
pause
