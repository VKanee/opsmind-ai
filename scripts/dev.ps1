$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path "$PSScriptRoot\.."
$logDirectory = Join-Path $repoRoot ".dev"
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

$api = Start-Process `
    -FilePath (Join-Path $repoRoot "apps\api\.venv\Scripts\python.exe") `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000" `
    -WorkingDirectory (Join-Path $repoRoot "apps\api") `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDirectory "api.out.log") `
    -RedirectStandardError (Join-Path $logDirectory "api.err.log") `
    -PassThru

$web = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList "run", "dev" `
    -WorkingDirectory (Join-Path $repoRoot "apps\web") `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDirectory "web.out.log") `
    -RedirectStandardError (Join-Path $logDirectory "web.err.log") `
    -PassThru

Write-Host "API PID: $($api.Id)"
Write-Host "Web PID: $($web.Id)"
Write-Host "Workspace: http://localhost:5173"
Write-Host "API docs:  http://localhost:8000/docs"
