# run-dev-service.ps1 - Entrypoint for a single CM dev service window/tab
# Usage:
#   .\run-dev-service.ps1 -Title "[CM] WEB" -CodeDir "C:\...\Code" -ServiceCommand "pnpm dev:web"

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ServiceName,

    [Parameter(Mandatory = $true)]
    [string]$Title,

    [Parameter(Mandatory = $true)]
    [string]$CodeDir,

    [Parameter(Mandatory = $true)]
    [string]$ServiceCommand
)

$ErrorActionPreference = "Stop"
$markerDir = Join-Path $PSScriptRoot ".cm-stop-markers"
$markerPath = Join-Path $markerDir "$ServiceName.requested"

[Console]::Title = $Title
$Host.UI.RawUI.WindowTitle = $Title
Set-Location $CodeDir

# Keep the intended title even if child shells/tools attempt to change it.
$__cmOriginalPrompt = $function:prompt
function global:prompt {
    [Console]::Title = $Title
    $Host.UI.RawUI.WindowTitle = $Title
    & $__cmOriginalPrompt
}

[Console]::Title = $Title
$Host.UI.RawUI.WindowTitle = $Title
Invoke-Expression $ServiceCommand

if (Test-Path $markerPath) {
    Remove-Item $markerPath -Force -ErrorAction SilentlyContinue
    exit 0
}

Write-Host "Service '$ServiceName' exited unexpectedly. Keeping this tab open for diagnostics."
Read-Host 'Press Enter to close this tab'
