$ErrorActionPreference = "Stop"

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    $dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path -LiteralPath $dockerDesktop)) {
        throw "未找到 Docker Desktop，请先安装 Docker Desktop。"
    }
    Write-Host "Docker Desktop 尚未运行，正在启动..."
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden

    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 3
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
    }
    if (-not $ready) {
        throw "Docker Desktop 启动超时，请打开 Docker Desktop 检查状态。"
    }
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
Write-Host "中文 API 使用说明：http://localhost:8080/docs"
Write-Host "开发者 Swagger：  http://localhost:8080/swagger"
Write-Host "查看状态：.\scripts\status.ps1"
Write-Host "停止服务：.\scripts\stop.ps1"
