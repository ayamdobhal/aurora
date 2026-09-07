$ErrorActionPreference = 'Stop'
$global:AuroraInstallerTestRoot = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString())
$global:AuroraInstallerTestCalls = @()
$global:AuroraInstallerTestFailApply = $false
function Assert($condition, $message) { if (-not $condition) { throw $message } }
function spicetify {
    $global:AuroraInstallerTestCalls += ($args -join ' ')
    $global:LASTEXITCODE = 0
    if ($args[0] -eq '-c') { return (Join-Path $global:AuroraInstallerTestRoot 'custom config/config.ini') }
    if ($args[0] -eq 'apply' -and $global:AuroraInstallerTestFailApply) { $global:LASTEXITCODE = 7 }
}
function Invoke-WebRequest {
    param($Uri, $OutFile, [switch]$UseBasicParsing)
    Copy-Item (Join-Path $global:AuroraInstallerTestRoot 'fixture.zip') $OutFile
}
$OldTemp = $env:TEMP
try {
    New-Item -ItemType Directory -Force "$global:AuroraInstallerTestRoot/custom config/Themes/aurora", "$global:AuroraInstallerTestRoot/archive/theme", "$global:AuroraInstallerTestRoot/archive/extensions" | Out-Null
    $env:TEMP = $global:AuroraInstallerTestRoot
    Set-Content "$global:AuroraInstallerTestRoot/custom config/config.ini" 'extensions = unrelated.js|old.js'
    Set-Content "$global:AuroraInstallerTestRoot/custom config/Themes/aurora/.aurora-extensions" 'old.js'
    Set-Content "$global:AuroraInstallerTestRoot/archive/theme/user.css" 'body {}'
    Set-Content "$global:AuroraInstallerTestRoot/archive/theme/color.ini" '[Base]'
    Set-Content "$global:AuroraInstallerTestRoot/archive/extensions/current.js" '// built'
    Set-Content "$global:AuroraInstallerTestRoot/archive/BUILD.txt" 'fixture-sha'
    Compress-Archive "$global:AuroraInstallerTestRoot/archive/*" "$global:AuroraInstallerTestRoot/fixture.zip"
    & "$PSScriptRoot/../install.ps1"
    Assert ($global:AuroraInstallerTestCalls -contains 'config extensions old.js-') 'Stale owned extension not removed'
    Assert (-not ($global:AuroraInstallerTestCalls -contains 'config extensions unrelated.js-')) 'Unrelated extension removed'
    Assert ((Get-Content "$global:AuroraInstallerTestRoot/custom config/Themes/aurora/.aurora-build").Trim() -eq 'fixture-sha') 'Missing installed build marker'
    $global:AuroraInstallerTestFailApply = $true
    $failed = $false
    try { & "$PSScriptRoot/../install.ps1" } catch { $failed = $true }
    Assert $failed 'Installer swallowed native command failure'
    # Malformed downloads must fail before replacing a working theme.
    Remove-Item "$global:AuroraInstallerTestRoot/archive/BUILD.txt"
    Compress-Archive "$global:AuroraInstallerTestRoot/archive/*" "$global:AuroraInstallerTestRoot/fixture.zip" -Force
    Set-Content "$global:AuroraInstallerTestRoot/custom config/Themes/aurora/user.css" 'keep-me'
    $failed = $false
    try { & "$PSScriptRoot/../install.ps1" } catch { $failed = $true }
    Assert $failed 'Invalid archive accepted'
    Assert ((Get-Content "$global:AuroraInstallerTestRoot/custom config/Themes/aurora/user.css").Trim() -eq 'keep-me') 'Invalid archive damaged existing theme'
    Write-Host 'PASS: custom config path, stale-owned cleanup, unrelated preservation, apply failure and invalid archive'
} finally {
    $env:TEMP = $OldTemp
    Remove-Item $global:AuroraInstallerTestRoot -Recurse -Force
}
