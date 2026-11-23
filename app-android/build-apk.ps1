# CrossPaste Phase 2B - build the APK
# Run after setup-android-sdk.ps1 AND after placing google-services.json.

$ErrorActionPreference = 'Continue'

$root = $PSScriptRoot
$apkPath = "$root\app\build\outputs\apk\debug\app-debug.apk"

Write-Host ""
Write-Host "Building CrossPaste APK (Phase 2B)..." -ForegroundColor Cyan
Write-Host ""

if (-not $env:ANDROID_HOME) {
    Write-Host "ANDROID_HOME is not set. Run setup-android-sdk.ps1 first." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "$root\local.properties")) {
    Write-Host "local.properties missing. Run setup-android-sdk.ps1 first." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "$root\app\google-services.json")) {
    Write-Host "app\google-services.json is MISSING." -ForegroundColor Red
    Write-Host "  Download it from Firebase Console and place it there." -ForegroundColor Red
    Write-Host "  See docs\firebase-setup.md for instructions." -ForegroundColor Red
    exit 1
}

Push-Location $root
try {
    gradle assembleDebug --no-daemon --console=plain 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Gradle build failed with exit code $LASTEXITCODE." -ForegroundColor Red
        Write-Host "Common fixes:" -ForegroundColor Red
        Write-Host "  - Close Chrome / other heavy apps (low RAM)" -ForegroundColor Red
        Write-Host "  - Disconnect VPN / Sophos (blocks Maven Central)" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

if (Test-Path $apkPath) {
    $sizeKb = [math]::Round((Get-Item $apkPath).Length / 1KB, 0)
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "Build successful!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK: $apkPath" -ForegroundColor Cyan
    Write-Host "Size: $sizeKb KB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next:" -ForegroundColor Cyan
    Write-Host "  1. Copy app-debug.apk to your phone"
    Write-Host "  2. Install it (allow 'unknown apps')"
    Write-Host "  3. Open CrossPaste, enter laptop IP, tap Start"
} else {
    Write-Host "Build failed - APK not found." -ForegroundColor Red
    exit 1
}
