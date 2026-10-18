$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path "$PSScriptRoot\.."
$pidFile = Join-Path $repoRoot ".dev\dev-processes.json"

if (Test-Path -LiteralPath $pidFile) {
    $processes = Get-Content -Raw -LiteralPath $pidFile | ConvertFrom-Json
    foreach ($processId in @($processes.api, $processes.web)) {
        if ($processId) {
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

foreach ($port in @(8000, 5173)) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "本地开发服务已停止。"
