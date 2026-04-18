# aurora — one-shot installer for Windows
# Usage: iwr -useb https://raw.githubusercontent.com/ayamdobhal/aurora/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$ReleaseUrl = "https://github.com/ayamdobhal/aurora/releases/latest/download/aurora.zip"
$ThemeName = "aurora"
$SpicetifyDir = Join-Path $env:APPDATA "spicetify"

function Info($msg) { Write-Host "==> $msg" -ForegroundColor Blue }
function Die($msg)  { Write-Host "error: $msg" -ForegroundColor Red; exit 1 }

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    Die "spicetify is required. Install from https://spicetify.app"
}
if (-not (Test-Path $SpicetifyDir)) {
    Die "Spicetify config not found at $SpicetifyDir. Run 'spicetify' once first."
}

$Tmp = Join-Path $env:TEMP "aurora-install-$(Get-Random)"
New-Item -ItemType Directory -Path $Tmp | Out-Null

try {
    Info "Downloading latest aurora release"
    $ZipPath = Join-Path $Tmp "aurora.zip"
    Invoke-WebRequest -Uri $ReleaseUrl -OutFile $ZipPath -UseBasicParsing

    Info "Extracting"
    $ExtractPath = Join-Path $Tmp "aurora"
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractPath -Force

    $ThemesDir = Join-Path $SpicetifyDir "Themes"
    $TargetTheme = Join-Path $ThemesDir $ThemeName
    Info "Copying theme to $TargetTheme"
    New-Item -ItemType Directory -Path $ThemesDir -Force | Out-Null
    if (Test-Path $TargetTheme) { Remove-Item -Recurse -Force $TargetTheme }
    Copy-Item -Recurse (Join-Path $ExtractPath "theme") $TargetTheme

    $ExtensionsDir = Join-Path $SpicetifyDir "Extensions"
    Info "Copying extensions to $ExtensionsDir"
    New-Item -ItemType Directory -Path $ExtensionsDir -Force | Out-Null
    $ExtFiles = Get-ChildItem (Join-Path $ExtractPath "extensions") -Filter *.js
    foreach ($ext in $ExtFiles) {
        Copy-Item $ext.FullName $ExtensionsDir -Force
    }

    Info "Configuring spicetify"
    spicetify config current_theme $ThemeName | Out-Null
    $ExtNames = ($ExtFiles | ForEach-Object { $_.Name }) -join "|"
    if ($ExtNames) {
        spicetify config extensions $ExtNames | Out-Null
    }

    Info "Applying"
    spicetify apply

    Info "Done. aurora is installed."
} finally {
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
