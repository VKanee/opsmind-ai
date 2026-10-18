$ErrorActionPreference = "Stop"

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Docker 尚未启动，请先打开 Docker Desktop。"
}

Push-Location "$PSScriptRoot\.."
try {
    if (-not (Test-Path -LiteralPath ".env")) {
        Write-Warning "未找到 .env，将使用本地演示默认配置。公网部署前请参考 deploy/.env.docker.example。"
    }
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose 启动失败，请检查日志。"
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "OpsMind AI 已启动：http://localhost:8080"
Write-Host "API 文档：http://localhost:8000/docs"
Write-Host "查看状态：.\scripts\status.ps1"
Write-Host "停止服务：.\scripts\stop.ps1"
