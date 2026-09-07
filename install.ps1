# aurora — one-shot installer for Windows
# Usage: iwr -useb https://raw.githubusercontent.com/ayamdobhal/aurora/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$ReleaseUrl = "https://github.com/ayamdobhal/aurora/releases/latest/download/aurora.zip"
$ThemeName = "aurora"
function Invoke-Spicetify {
    & spicetify @args
    if ($LASTEXITCODE -ne 0) { throw "Spicetify failed ($LASTEXITCODE): $args" }
}

function Info($msg) { Write-Host "==> $msg" -ForegroundColor Blue }
function Die($msg)  { Write-Host "error: $msg" -ForegroundColor Red; exit 1 }

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    Die "spicetify is required. Install from https://spicetify.app"
}
$ConfigFile = (Invoke-Spicetify -c | Out-String).Trim()
if (-not (Test-Path -LiteralPath $ConfigFile -PathType Leaf)) {
    throw "Spicetify config not found: $ConfigFile. Run spicetify once first."
}
$SpicetifyDir = Split-Path $ConfigFile
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

    $ThemeSource = Join-Path $ExtractPath "theme"
    $BuildFile = Join-Path $ExtractPath "BUILD.txt"
    $ExtFiles = @(Get-ChildItem (Join-Path $ExtractPath "extensions") -Filter *.js -File)
    if (-not (Test-Path "$ThemeSource/user.css") -or -not (Test-Path "$ThemeSource/color.ini") -or -not (Test-Path $BuildFile) -or $ExtFiles.Count -eq 0) {
        throw "Invalid Aurora archive: missing theme, revision or built extensions. Retry after the release finishes."
    }
    $Revision = (Get-Content -LiteralPath $BuildFile -Raw).Trim()
    Info "Installing Aurora revision $Revision"
    $Manifest = Join-Path $SpicetifyDir "Themes/aurora/.aurora-extensions"
    $PreviousExtensions = @()
    if (Test-Path $Manifest) { $PreviousExtensions = @(Get-Content -LiteralPath $Manifest) }

    $ThemesDir = Join-Path $SpicetifyDir "Themes"
    $TargetTheme = Join-Path $ThemesDir $ThemeName
    Info "Copying theme to $TargetTheme"
    New-Item -ItemType Directory -Path $ThemesDir -Force | Out-Null
    if (Test-Path $TargetTheme) { Remove-Item -Recurse -Force $TargetTheme }
    Copy-Item -Recurse (Join-Path $ExtractPath "theme") $TargetTheme

    $ExtensionsDir = Join-Path $SpicetifyDir "Extensions"
    Info "Copying extensions to $ExtensionsDir"
    New-Item -ItemType Directory -Path $ExtensionsDir -Force | Out-Null
    foreach ($ext in $ExtFiles) {
        Copy-Item $ext.FullName $ExtensionsDir -Force
    }

    Info "Configuring spicetify"
    Invoke-Spicetify config current_theme $ThemeName | Out-Null
    $ExtNames = ($ExtFiles | ForEach-Object { $_.Name }) -join "|"
    if ($ExtNames) {
        Invoke-Spicetify config extensions $ExtNames | Out-Null
    }

    foreach ($ext in $PreviousExtensions) {
        if ($ext -match '^[^/\\|]+\.js$' -and -not (Test-Path -LiteralPath (Join-Path $ExtractPath "extensions/$ext"))) {
            Invoke-Spicetify config extensions "$ext-" | Out-Null
        }
    }
    $ExtFiles.Name | Set-Content -LiteralPath $Manifest -Encoding Ascii

    Info "Applying"
    Invoke-Spicetify apply

    Copy-Item -LiteralPath $BuildFile (Join-Path $TargetTheme ".aurora-build") -Force
    Info "Done. Aurora $Revision is installed."
} finally {
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
