param(
  [switch]$SkipAudit,
  [switch]$SkipGitleaks,
  [switch]$SkipMonorepoTests,
  [switch]$InstallGitleaks,
  [switch]$GitleaksFullHistory,
  [string]$GitleaksSinceRef,
  [string]$GitleaksCheckpointFile = '.git\gitleaks-checkpoint.json'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$codeDir = Join-Path $root 'Code'
$workflowDir = Join-Path $root '.github\workflows'
$gitleaksCheckpointPath = if ([System.IO.Path]::IsPathRooted($GitleaksCheckpointFile)) {
  $GitleaksCheckpointFile
}
else {
  Join-Path $root $GitleaksCheckpointFile
}

$failed = @()

function Run-Step {
  param(
    [Parameter(Mandatory = $true)] [string]$Name,
    [Parameter(Mandatory = $true)] [scriptblock]$Action
  )

  Write-Host "`n==> $Name" -ForegroundColor Cyan
  try {
    & $Action
    Write-Host "[PASS] $Name" -ForegroundColor Green
  }
  catch {
    Write-Host "[FAIL] $Name -- $($_.Exception.Message)" -ForegroundColor Red
    $script:failed += $Name
  }
}

function Require-Command {
  param([Parameter(Mandatory = $true)] [string]$CommandName)
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $CommandName"
  }
}

function Get-GitCommitHash {
  param([Parameter(Mandatory = $true)] [string]$RefName)

  $hashOutput = & git rev-parse --verify $RefName 2>$null
  $exitCode = $LASTEXITCODE
  $hash = ($hashOutput | Select-Object -First 1).Trim()
  if ($exitCode -ne 0 -or [string]::IsNullOrWhiteSpace($hash)) {
    throw "Unable to resolve git ref: $RefName"
  }

  return $hash
}

function Test-GitAncestor {
  param(
    [Parameter(Mandatory = $true)] [string]$Ancestor,
    [Parameter(Mandatory = $true)] [string]$Descendant
  )

  & git merge-base --is-ancestor $Ancestor $Descendant 2>$null
  return $LASTEXITCODE -eq 0
}

function Get-GitleaksCheckpoint {
  if (-not (Test-Path $gitleaksCheckpointPath)) {
    return $null
  }

  try {
    return Get-Content -Raw -Path $gitleaksCheckpointPath | ConvertFrom-Json
  }
  catch {
    throw "Unable to parse gitleaks checkpoint file: $gitleaksCheckpointPath"
  }
}

function Save-GitleaksCheckpoint {
  param(
    [Parameter(Mandatory = $true)] [string]$HeadCommit,
    [Parameter(Mandatory = $true)] [string]$ScanMode,
    [string]$ScanStartRef
  )

  $checkpointDir = Split-Path -Parent $gitleaksCheckpointPath
  if (-not (Test-Path $checkpointDir)) {
    New-Item -ItemType Directory -Path $checkpointDir -Force | Out-Null
  }

  $payload = [ordered]@{
    lastScannedCommit = $HeadCommit
    lastScannedAt = (Get-Date).ToString('o')
    scanMode = $ScanMode
  }

  if ($ScanStartRef) {
    $payload.scanStartRef = $ScanStartRef
  }

  $payload | ConvertTo-Json | Set-Content -Path $gitleaksCheckpointPath
}

function Get-GitleaksScanPlan {
  param([Parameter(Mandatory = $true)] [string]$HeadCommit)

  if ($GitleaksFullHistory) {
    return @{
      Mode = 'full-history'
      LogOpts = $null
      Skip = $false
      Description = 'full git history'
      ScanStartRef = $null
    }
  }

  if ($GitleaksSinceRef) {
    $sinceCommit = Get-GitCommitHash -RefName $GitleaksSinceRef
    if ($sinceCommit -eq $HeadCommit) {
      return @{
        Mode = 'explicit-ref'
        LogOpts = $null
        Skip = $true
        Description = "no commits after explicit ref $GitleaksSinceRef"
        ScanStartRef = $sinceCommit
      }
    }

    if (-not (Test-GitAncestor -Ancestor $sinceCommit -Descendant $HeadCommit)) {
      throw "Gitleaks since-ref is not an ancestor of HEAD: $GitleaksSinceRef"
    }

    return @{
      Mode = 'explicit-ref'
      LogOpts = "$sinceCommit..$HeadCommit"
      Skip = $false
      Description = "git delta from $GitleaksSinceRef"
      ScanStartRef = $sinceCommit
    }
  }

  $checkpoint = Get-GitleaksCheckpoint
  if ($null -eq $checkpoint -or [string]::IsNullOrWhiteSpace($checkpoint.lastScannedCommit)) {
    return @{
      Mode = 'full-history'
      LogOpts = $null
      Skip = $false
      Description = 'full git history (no checkpoint found)'
      ScanStartRef = $null
    }
  }

  $checkpointCommit = Get-GitCommitHash -RefName $checkpoint.lastScannedCommit
  if ($checkpointCommit -eq $HeadCommit) {
    return @{
      Mode = 'checkpoint'
      LogOpts = $null
      Skip = $true
      Description = 'no new commits since the last checkpoint'
      ScanStartRef = $checkpointCommit
    }
  }

  if (-not (Test-GitAncestor -Ancestor $checkpointCommit -Descendant $HeadCommit)) {
    throw "Checkpoint commit is not an ancestor of HEAD. Re-run with -GitleaksFullHistory or set -GitleaksSinceRef. Checkpoint: $checkpointCommit"
  }

  return @{
    Mode = 'checkpoint'
    LogOpts = "$checkpointCommit..$HeadCommit"
    Skip = $false
    Description = "git delta since checkpoint $checkpointCommit"
    ScanStartRef = $checkpointCommit
  }
}

Write-Host 'Coordination Manager security process check' -ForegroundColor Yellow
Write-Host "Repo root: $root"

Run-Step -Name 'Verify required commands (git, pnpm)' -Action {
  Require-Command -CommandName 'git'
  Require-Command -CommandName 'pnpm'
}

Run-Step -Name 'Verify governance files (SECURITY, LICENSE, CONTRIBUTING)' -Action {
  $requiredFiles = @('SECURITY.md', 'LICENSE', 'CONTRIBUTING.md')
  foreach ($file in $requiredFiles) {
    $path = Join-Path $root $file
    if (-not (Test-Path $path)) {
      throw "Missing required file: $file"
    }
  }
}

Run-Step -Name 'Verify CI workflow directory exists' -Action {
  if (-not (Test-Path $workflowDir)) {
    throw 'Missing .github/workflows directory'
  }
}

if (-not $SkipAudit) {
  Run-Step -Name 'Run dependency audit (high+critical)' -Action {
    Push-Location $codeDir
    try {
      & pnpm audit --audit-level=high
      if ($LASTEXITCODE -ne 0) {
        throw "pnpm audit failed with exit code $LASTEXITCODE"
      }
    }
    finally {
      Pop-Location
    }
  }
}
else {
  Write-Host "`n[SKIP] Run dependency audit (high+critical)"
}

if (-not $SkipMonorepoTests) {
  Run-Step -Name 'Run monorepo test gate' -Action {
    Push-Location $codeDir
    try {
      & pnpm test
      if ($LASTEXITCODE -ne 0) {
        throw "pnpm test failed with exit code $LASTEXITCODE"
      }
    }
    finally {
      Pop-Location
    }
  }
}
else {
  Write-Host "`n[SKIP] Run monorepo test gate"
}

if ($InstallGitleaks -and -not (Get-Command gitleaks -ErrorAction SilentlyContinue)) {
  Run-Step -Name 'Install gitleaks using winget (official package)' -Action {
    Require-Command -CommandName 'winget'
    & winget install --id Gitleaks.Gitleaks --exact --source winget
    if ($LASTEXITCODE -ne 0) {
      throw "winget install failed with exit code $LASTEXITCODE"
    }
  }
}

if (-not $SkipGitleaks) {
  Run-Step -Name 'Run gitleaks on git history' -Action {
    if (-not (Get-Command gitleaks -ErrorAction SilentlyContinue)) {
      throw 'gitleaks not installed. Re-run with -InstallGitleaks or install manually from the official repo release (github.com/gitleaks/gitleaks). CLI is MIT-licensed; no org license required when invoking the CLI directly.'
    }

    Push-Location $root
    try {
      $headCommit = Get-GitCommitHash -RefName 'HEAD'
      $scanPlan = Get-GitleaksScanPlan -HeadCommit $headCommit
      Write-Host "Using gitleaks scan scope: $($scanPlan.Description)"

      if ($scanPlan.Skip) {
        Write-Host "Gitleaks skipped: $($scanPlan.Description)"
        return
      }

      $baselineFlag = @()
      if (Test-Path (Join-Path $root '.gitleaks-baseline.json')) {
        $baselineFlag = @('--baseline-path', (Join-Path $root '.gitleaks-baseline.json'))
      }

      $gitleaksArgs = @('detect', '--source', '.', '--verbose')
      if ($scanPlan.LogOpts) {
        $gitleaksArgs += @('--log-opts', $scanPlan.LogOpts)
      }
      $gitleaksArgs += $baselineFlag

      & gitleaks @gitleaksArgs
      if ($LASTEXITCODE -ne 0) {
        throw "gitleaks detect failed with exit code $LASTEXITCODE"
      }

      Save-GitleaksCheckpoint -HeadCommit $headCommit -ScanMode $scanPlan.Mode -ScanStartRef $scanPlan.ScanStartRef
      Write-Host "Updated gitleaks checkpoint: $headCommit"
    }
    finally {
      Pop-Location
    }
  }
}
else {
  Write-Host "`n[SKIP] Run gitleaks on git history"
}

Write-Host "`n=============================="
if ($failed.Count -eq 0) {
  Write-Host 'Security process check PASSED' -ForegroundColor Green
  exit 0
}

Write-Host 'Security process check FAILED' -ForegroundColor Red
Write-Host 'Failed steps:' -ForegroundColor Red
$failed | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
exit 1
