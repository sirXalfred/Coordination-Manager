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
    [string]$ServiceCommand,

    [string]$LogPath
)

$ErrorActionPreference = "Stop"
$markerDir = Join-Path $PSScriptRoot ".cm-stop-markers"
$markerPath = Join-Path $markerDir "$ServiceName.requested"
if (-not $LogPath) {
    $logDir = Join-Path $PSScriptRoot ".cm-dev-logs"
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    $LogPath = Join-Path $logDir "$ServiceName.log"
} else {
    $logDir = Split-Path -Parent $LogPath
    if ($logDir) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
}

if (Test-Path $LogPath) {
    Remove-Item $LogPath -Force -ErrorAction SilentlyContinue
}

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
$transcriptStarted = $false

try {
    Start-Transcript -Path $LogPath -Force | Out-Null
    $transcriptStarted = $true
    Invoke-Expression $ServiceCommand
} finally {
    if ($transcriptStarted) {
        Stop-Transcript | Out-Null
    }
}

if (Test-Path $markerPath) {
    Remove-Item $markerPath -Force -ErrorAction SilentlyContinue
    exit 0
}

Write-Host "Service '$ServiceName' exited unexpectedly. Keeping this tab open for diagnostics."
Read-Host 'Press Enter to close this tab'
