# CrossPaste Phase 2A - build the APK
# Run after setup-android-sdk.ps1.

# IMPORTANT: 'Continue', not 'Stop'. gradle writes warnings / progress to
# STDERR, and PowerShell with 'Stop' would treat that as a terminating error
# and abort the build before it has a chance to finish. We check
# $LASTEXITCODE explicitly after gradle runs.
$ErrorActionPreference = 'Continue'

$root = $PSScriptRoot
$apkPath = "$root\app-project\app\build\outputs\apk\debug\app-debug.apk"

Write-Host ""
Write-Host "Building CrossPaste APK..." -ForegroundColor Cyan
Write-Host ""

if (-not $env:ANDROID_HOME) {
    Write-Host "ANDROID_HOME is not set. Run setup-android-sdk.ps1 first." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "$root\app-project\local.properties")) {
    Write-Host "app-project\local.properties missing. Run setup-android-sdk.ps1 first." -ForegroundColor Red
    exit 1
}

Push-Location "$root\app-project"
try {
    # First build downloads ~200 MB of Gradle deps (AGP, Kotlin, AndroidX).
    # --no-daemon keeps memory usage low (important on 8 GB RAM laptops).
    # 2>&1 merges gradle's stderr into stdout so PowerShell doesn't choke on it.
    gradle assembleDebug --no-daemon --console=plain 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Gradle build failed with exit code $LASTEXITCODE." -ForegroundColor Red
        Write-Host "Scroll up for the error. Common fixes:" -ForegroundColor Red
        Write-Host "  - Close Chrome / other heavy apps (low RAM)" -ForegroundColor Red
        Write-Host "  - Disconnect VPN / Sophos (blocks Maven Central)" -ForegroundColor Red
        Write-Host "  - Re-run setup-android-sdk.ps1 if the SDK got moved" -ForegroundColor Red
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
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Copy app-debug.apk to your phone (USB / Drive / Telegram)"
    Write-Host "  2. Install it (allow 'unknown apps' if prompted)"
    Write-Host "  3. Open CrossPaste, enter the laptop IP, tap Start"
    Write-Host "  4. Switch apps and paste - it should now stay connected"
    Write-Host ""
    Write-Host "Don't forget the ColorOS battery settings (see README)." -ForegroundColor Magenta
} else {
    Write-Host ""
    Write-Host "Build failed - APK not found at expected path." -ForegroundColor Red
    exit 1
}
