# Builds one app flavor (teacher/student/attendance) and installs it
# straight onto the connected BlueStacks instance - no manual "find the APK,
# drag it onto BlueStacks" step needed after this.
#
# Usage:
#   ./build_and_install.ps1 -Flavor student
#   ./build_and_install.ps1 -Flavor teacher -BuildType release
#
# Assumes exactly one adb device is connected (true today - BlueStacks is
# the only one). If more than one device/emulator is ever connected at once,
# `adb install` will refuse and ask for -s <serial>; not handled here since
# it doesn't match the current setup.

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("teacher", "student", "attendance")]
  [string]$Flavor,

  [ValidateSet("debug", "release")]
  [string]$BuildType = "debug"
)

Set-Location $PSScriptRoot

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
  $fallback = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
  if (Test-Path $fallback) { $adb = $fallback } else {
    Write-Error "adb not found on PATH or at $fallback"
    exit 1
  }
} else {
  $adb = $adb.Source
}

$devices = & $adb devices | Select-String "\tdevice$"
if (-not $devices) {
  Write-Error "No adb device connected - make sure BlueStacks is running."
  exit 1
}

Write-Host "Building $Flavor ($BuildType) APK..."
flutter build apk --flavor $Flavor "--$BuildType"
if ($LASTEXITCODE -ne 0) { Write-Error "flutter build apk failed."; exit 1 }

$apkPath = "build/app/outputs/flutter-apk/app-$Flavor-$BuildType.apk"
if (-not (Test-Path $apkPath)) {
  Write-Error "Expected APK not found at $apkPath"
  exit 1
}

Write-Host "Installing $apkPath to BlueStacks..."
& $adb install -r $apkPath
if ($LASTEXITCODE -ne 0) { Write-Error "adb install failed."; exit 1 }

Write-Host "Done - $Flavor ($BuildType) is installed and up to date on BlueStacks."
