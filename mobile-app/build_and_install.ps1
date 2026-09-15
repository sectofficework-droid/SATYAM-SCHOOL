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
  $fallbacks = @(
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
  )
  $found = $fallbacks | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($found) { $adb = $found } else {
    Write-Error "adb not found on PATH or at any of: $($fallbacks -join ', ')"
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
# -t is required: --flavor only picks the Android-side product flavor
# (package name/icon/label), NOT which Dart entry point gets compiled.
# Without it, flutter defaults to lib/main.dart, which this codebase wires
# to delegate to the teacher entry point - so a `student`/`attendance`
# build would silently ship running teacher's code under the wrong app's
# name/icon.
flutter build apk --flavor $Flavor -t "lib/main_$Flavor.dart" "--$BuildType"
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
