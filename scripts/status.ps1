$ErrorActionPreference = "Stop"

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Desktop 当前未运行。"
    Write-Host "启动项目请双击“启动项目.cmd”，或在终端执行 .\scripts\start.ps1"
    exit 0
}

Push-Location "$PSScriptRoot\.."
try {
    docker compose ps
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "工作台：http://localhost:8080"
Write-Host "中文 API 使用说明：http://localhost:8080/docs"
Write-Host "开发者 Swagger：  http://localhost:8080/swagger"
