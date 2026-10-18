$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path "$PSScriptRoot\.."
$logDirectory = Join-Path $repoRoot ".dev"
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

foreach ($port in @(8000, 5173)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "端口 $port 已被占用。若 Docker 正在运行，请先执行 .\scripts\stop.ps1。"
    }
}

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

@{
    api = $api.Id
    web = $web.Id
} | ConvertTo-Json | Set-Content -Encoding utf8NoBOM (Join-Path $logDirectory "dev-processes.json")

Write-Host "后端进程 PID：$($api.Id)"
Write-Host "前端进程 PID：$($web.Id)"
Write-Host "工作台地址：http://localhost:5173"
Write-Host "API 文档： http://localhost:8000/docs"
Write-Host "停止服务请执行：.\scripts\dev-stop.ps1"
