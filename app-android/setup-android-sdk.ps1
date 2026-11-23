# CrossPaste Phase 2B - one-time Android SDK + Gradle setup
# Same as Phase 2A, just relocated under app-android/.
# Total download: ~250 MB. Takes ~5 minutes. Run once.

$ErrorActionPreference = 'Continue'

$root = $PSScriptRoot
$sdkDir = "$root\android-sdk"
$cmdlineToolsDir = "$sdkDir\cmdline-tools\latest"
$gradleDir = "$root\gradle-dist"
$gradleVersion = "8.10.2"
$gradleHome = "$gradleDir\gradle-$gradleVersion"

Write-Host ""
Write-Host "CrossPaste Phase 2B - Android SDK + Gradle setup" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Working directory: $root"
Write-Host ""

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Host "Java not found. Install JDK 17+ first." -ForegroundColor Red
    exit 1
}
$javaOutput = & { $ErrorActionPreference = 'Continue'; java -version 2>&1 }
$javaVersion = ($javaOutput | Select-Object -First 1).ToString()
Write-Host "Java: $javaVersion" -ForegroundColor DarkGray

# Step 1: cmdline-tools
Write-Host ""
if (Test-Path "$cmdlineToolsDir\bin\sdkmanager.bat") {
    Write-Host "[1/6] cmdline-tools already installed." -ForegroundColor DarkYellow
} else {
    Write-Host "[1/6] Downloading Android cmdline-tools (~80 MB)..." -ForegroundColor Yellow
    $url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    $zip = "$root\cmdline-tools.zip"
    try { Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing }
    catch { Write-Host "      Download failed: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
    $tmp = "$sdkDir\cmdline-tools-tmp"
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    New-Item -ItemType Directory -Force -Path "$sdkDir\cmdline-tools" | Out-Null
    Move-Item "$tmp\cmdline-tools" $cmdlineToolsDir -Force
    Remove-Item $tmp -Recurse -Force
    Remove-Item $zip
    Write-Host "      done." -ForegroundColor Green
}

# Step 2: ANDROID_HOME
Write-Host ""
Write-Host "[2/6] Setting ANDROID_HOME..." -ForegroundColor Yellow
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkDir, "User")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $sdkDir, "User")
$env:ANDROID_HOME = $sdkDir
$env:ANDROID_SDK_ROOT = $sdkDir
Write-Host "      ANDROID_HOME = $sdkDir" -ForegroundColor Green

$sdkmanager = "$cmdlineToolsDir\bin\sdkmanager.bat"

# Step 3: licenses
Write-Host ""
Write-Host "[3/6] Accepting SDK licenses..." -ForegroundColor Yellow
$yesInput = ("y`r`n" * 20)
$yesInput | & $sdkmanager --licenses 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "      licenses failed ($LASTEXITCODE)" -ForegroundColor Red; exit 1 }
Write-Host "      done." -ForegroundColor Green

# Step 4: install packages
Write-Host ""
Write-Host "[4/6] Installing platform-tools, android-34, build-tools-34 (~120 MB)..." -ForegroundColor Yellow
& $sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" 2>&1 |
    Select-String "Installing|done|Loading|=" |
    ForEach-Object { Write-Host "      $($_.Line.Trim())" -ForegroundColor DarkGray }
if ($LASTEXITCODE -ne 0) { Write-Host "      install failed ($LASTEXITCODE)" -ForegroundColor Red; exit 1 }
Write-Host "      done." -ForegroundColor Green

# Step 5: Gradle
Write-Host ""
if (Test-Path "$gradleHome\bin\gradle.bat") {
    Write-Host "[5/6] Gradle already installed." -ForegroundColor DarkYellow
} else {
    Write-Host "[5/6] Downloading Gradle $gradleVersion (~128 MB)..." -ForegroundColor Yellow
    $url = "https://services.gradle.org/distributions/gradle-$gradleVersion-bin.zip"
    $zip = "$root\gradle.zip"
    try { Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing }
    catch { Write-Host "      Download failed: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
    New-Item -ItemType Directory -Force -Path $gradleDir | Out-Null
    Expand-Archive -Path $zip -DestinationPath $gradleDir -Force
    Remove-Item $zip
    Write-Host "      done." -ForegroundColor Green
}

$gradleBin = "$gradleHome\bin"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$gradleBin*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$gradleBin", "User")
}
$env:Path += ";$gradleBin"
$env:GRADLE_HOME = $gradleHome
[Environment]::SetEnvironmentVariable("GRADLE_HOME", $gradleHome, "User")
Write-Host "      GRADLE_HOME = $gradleHome" -ForegroundColor Green

# Step 6: local.properties
Write-Host ""
Write-Host "[6/6] Writing local.properties..." -ForegroundColor Yellow
$sdkDirForward = $sdkDir -replace '\\', '/'
Set-Content -Path "$root\local.properties" -Value "sdk.dir=$sdkDirForward" -Encoding ASCII
Write-Host "      sdk.dir = $sdkDirForward" -ForegroundColor Green

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1. Place google-services.json at app\google-services.json"
Write-Host "     (see docs\firebase-setup.md if you haven't yet)"
Write-Host "  2. Run: .\build-apk.ps1"
Write-Host ""
