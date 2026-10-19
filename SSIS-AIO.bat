@echo off
title Satyam Stars - Start Menu
:menu
cls
echo ============================================
echo   Satyam Stars International School
echo ============================================
echo   1. Website (Admin Panel)      - localhost:3000
echo   2. Student App    (Flutter)   - localhost:5000
echo   3. Teacher App    (Flutter)   - localhost:5001
echo   4. Exit
echo ============================================
set /p choice=Choose a section to start (1-4):

if "%choice%"=="1" call :start_website & goto menu
if "%choice%"=="2" call "%~dp0Scratch\SATYAM-SCHOOL\start-student-app.bat" & goto menu
if "%choice%"=="3" call "%~dp0Scratch\SATYAM-SCHOOL\start-teacher-app.bat" & goto menu
if "%choice%"=="4" exit
goto menu

:start_website
setlocal
cd /d "%~dp0admin-panel"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install it from https://nodejs.org then try again.
  pause
  endlocal
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json not found in admin-panel - is the folder in the right place?
  pause
  endlocal
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules not found - running npm install first, this can take a minute...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. See the output above for details.
    pause
    endlocal
    exit /b 1
  )
)

echo Freeing port 3000 if already in use...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do taskkill /F /PID %%a >nul 2>&1

echo Starting Satyam Stars admin panel (website) on http://localhost:3000 ...
start "Satyam Admin Panel" cmd /k "npm run dev"

echo Waiting for the server to be ready...
:wait_website
timeout /t 1 >nul
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient('localhost',3000)).Close() } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait_website

echo Server is ready - opening browser...
start "" http://localhost:3000

endlocal
exit /b 0
