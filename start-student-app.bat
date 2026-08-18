@echo off
setlocal
set FLUTTER=C:\flutter\bin\flutter.bat
cd /d "%~dp0mobile-app"

if not exist "%FLUTTER%" (
  echo [ERROR] Flutter SDK not found at %FLUTTER%.
  echo See mobile-app\FLUTTER_SETUP_GUIDE.md to install it.
  pause
  exit /b 1
)

if not exist "lib\main_student.dart" (
  echo [ERROR] lib\main_student.dart not found - is mobile-app in the right place?
  pause
  exit /b 1
)

if not exist "assets\icons" (
  echo Creating missing assets\icons folder referenced in pubspec.yaml...
  mkdir "assets\icons"
)

if not exist "web" (
  echo Web platform folder not found - adding it...
  call "%FLUTTER%" create --platforms=web .
)

if not exist ".dart_tool" (
  echo Installing Flutter package dependencies, this can take a minute...
  call "%FLUTTER%" pub get
  if errorlevel 1 (
    echo [ERROR] flutter pub get failed. See the output above for details.
    pause
    exit /b 1
  )
)

echo Freeing port 5000 if already in use...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 "') do taskkill /F /PID %%a >nul 2>&1

echo Starting Student app (Flutter Web) on http://localhost:5000 ...
call "%FLUTTER%" run -t lib\main_student.dart -d chrome --web-port=5000
pause
