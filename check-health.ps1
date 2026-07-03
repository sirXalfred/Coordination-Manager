# check-health.ps1 - Verify all dev services are responding
# Usage: .\check-health.ps1 [-StartupDelaySeconds 8] [-StateFile .cm-dev-state.json]

[CmdletBinding()]
param(
    [int]$StartupDelaySeconds = 8,
    [int]$MaxWaitSeconds = 45,
    [int]$PollIntervalSeconds = 3,
    [string]$StateFile = (Join-Path $(if ($PSScriptRoot) { $PSScriptRoot } elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { (Get-Location).Path }) ".cm-dev-state.json")
)

$ErrorActionPreference = "Stop"

function Test-Http {
    param(
        [string]$Url,
        [int]$ExpectedStatusCode = 200
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 6
        return [pscustomobject]@{
            ok = ($response.StatusCode -eq $ExpectedStatusCode)
            detail = "HTTP $($response.StatusCode)"
        }
    } catch {
        return [pscustomobject]@{
            ok = $false
            detail = $_.Exception.Message
        }
    }
}

function Test-ListeningPort {
    param([int]$Port)

    try {
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listener) {
            return [pscustomobject]@{ ok = $true; detail = "TCP listener active" }
        }

        return [pscustomobject]@{ ok = $false; detail = "No listener detected" }
    } catch {
        return [pscustomobject]@{ ok = $false; detail = $_.Exception.Message }
    }
}

function Test-GuardianProcess {
    try {
        $guardianNode = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -eq "node.exe" -and
                $_.CommandLine -and
                $_.CommandLine -match "discord-guardian"
            } |
            Select-Object -First 1

        if ($guardianNode) {
            return [pscustomobject]@{ ok = $true; detail = "Node PID $($guardianNode.ProcessId) running" }
        }

        return [pscustomobject]@{ ok = $false; detail = "No discord-guardian node process detected" }
    } catch {
        return [pscustomobject]@{ ok = $false; detail = $_.Exception.Message }
    }
}

Start-Sleep -Seconds $StartupDelaySeconds

$deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
$serviceChecks = @(
    [pscustomobject]@{ service = "Web"; endpoint = "http://localhost:5173"; tester = { Test-Http -Url "http://localhost:5173" } },
    [pscustomobject]@{ service = "API"; endpoint = "http://localhost:3001/health"; tester = { Test-Http -Url "http://localhost:3001/health" } },
    [pscustomobject]@{ service = "Bot"; endpoint = "localhost:3002"; tester = { Test-ListeningPort -Port 3002 } },
    [pscustomobject]@{ service = "Guardian"; endpoint = "console-only"; tester = { Test-GuardianProcess } },
    [pscustomobject]@{ service = "Docs"; endpoint = "http://localhost:5174"; tester = { Test-Http -Url "http://localhost:5174" } }
)

$latestResults = @{}

while ((Get-Date) -lt $deadline) {
    $allPassNow = $true

    foreach ($serviceCheck in $serviceChecks) {
        if ($latestResults.ContainsKey($serviceCheck.service) -and $latestResults[$serviceCheck.service].ok) {
            continue
        }

        $result = & $serviceCheck.tester
        $latestResults[$serviceCheck.service] = $result
        if (-not $result.ok) {
            $allPassNow = $false
        }
    }

    if ($allPassNow) {
        break
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}

$results = foreach ($serviceCheck in $serviceChecks) {
    [pscustomobject]@{
        service = $serviceCheck.service
        endpoint = $serviceCheck.endpoint
        check = $latestResults[$serviceCheck.service]
    }
}

$allPass = $true
Write-Host "Coordination Manager Health"
Write-Host "---------------------------"
foreach ($result in $results) {
    $status = if ($result.check.ok) { "PASS" } else { "FAIL" }
    if (-not $result.check.ok) {
        $allPass = $false
    }

    Write-Host ("[{0}] {1} ({2}) - {3}" -f $status, $result.service, $result.endpoint, $result.check.detail)
}

if ($allPass) {
    Write-Host "Result: ALL SERVICES HEALTHY"
    exit 0
}

Write-Host "Result: FAILURES DETECTED"
exit 1
