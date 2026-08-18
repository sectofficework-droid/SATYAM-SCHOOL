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
echo   4. Attendance Kiosk (Flutter) - localhost:5002
echo   5. Exit
echo ============================================
set /p choice=Choose a section to start (1-5):

if "%choice%"=="1" call "%~dp0start-website.bat" & goto menu
if "%choice%"=="2" call "%~dp0start-student-app.bat" & goto menu
if "%choice%"=="3" call "%~dp0start-teacher-app.bat" & goto menu
if "%choice%"=="4" call "%~dp0start-attendance-app.bat" & goto menu
if "%choice%"=="5" exit
goto menu
