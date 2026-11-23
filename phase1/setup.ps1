# CrossPaste Phase 1 setup script (Windows PowerShell)
# Run from the folder you extracted this to:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "CrossPaste Phase 1 setup" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan

$root = $PSScriptRoot
Write-Host "Working directory: $root"

# Sanity check Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Install Node 20+ first." -ForegroundColor Red
    exit 1
}

# 1. Relay deps
Write-Host ""
Write-Host "[1/4] Installing relay dependencies..." -ForegroundColor Yellow
Push-Location "$root\mock-relay"
npm install --no-audit --no-fund
Pop-Location
Write-Host "      done." -ForegroundColor Green

# 2. Scaffold Expo app
Write-Host ""
Write-Host "[2/4] Scaffolding Expo app (this takes 1-2 minutes)..." -ForegroundColor Yellow
Push-Location $root
if (Test-Path "crosspaste-app") {
    Write-Host "      crosspaste-app already exists, skipping scaffold." -ForegroundColor DarkYellow
} else {
    npx --yes create-expo-app@latest crosspaste-app --template blank
}
Pop-Location
Write-Host "      done." -ForegroundColor Green

# 3. expo-clipboard
Write-Host ""
Write-Host "[3/4] Installing expo-clipboard..." -ForegroundColor Yellow
Push-Location "$root\crosspaste-app"
npx expo install expo-clipboard
Pop-Location
Write-Host "      done." -ForegroundColor Green

# 4. Copy our App.tsx over the generated one
Write-Host ""
Write-Host "[4/4] Copying App.tsx into the Expo project..." -ForegroundColor Yellow
Copy-Item "$root\expo-app\App.tsx" "$root\crosspaste-app\App.tsx" -Force
Write-Host "      done." -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps - open TWO terminals in: $root" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Terminal 1:" -ForegroundColor White
Write-Host "    cd mock-relay"
Write-Host "    npm start"
Write-Host ""
Write-Host "  Terminal 2:" -ForegroundColor White
Write-Host "    cd crosspaste-app"
Write-Host "    npx expo start"
Write-Host ""
Write-Host "On your phone:" -ForegroundColor Cyan
Write-Host "  1. Install 'Expo Go' from the Play Store"
Write-Host "  2. Open Expo Go, scan the QR code from Terminal 2"
Write-Host "  3. Type the laptop's IP (printed by Terminal 1), tap Connect"
Write-Host ""
Write-Host "Load the Chrome extension:" -ForegroundColor Cyan
Write-Host "  1. Open chrome://extensions in Chrome or Edge"
Write-Host "  2. Enable Developer mode (top-right toggle)"
Write-Host "  3. Click 'Load unpacked', select:"
Write-Host "     $root\chrome-extension"
Write-Host ""
Write-Host "Then select text on any webpage, right-click,"
Write-Host "'Send selection to phone', and paste in any Android app." -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: phone and laptop must be on the SAME Wi-Fi." -ForegroundColor Magenta
Write-Host ""
