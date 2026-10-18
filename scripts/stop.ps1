$ErrorActionPreference = "Stop"

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker 当前未运行，项目已经处于关闭状态。"
    exit 0
}

Push-Location "$PSScriptRoot\.."
try {
    docker compose stop
    if ($LASTEXITCODE -ne 0) {
        throw "停止 Docker Compose 服务失败。"
    }
} finally {
    Pop-Location
}

Write-Host "OpsMind AI 已停止，数据库数据仍然保留。"
Write-Host "重新启动：docker compose start"
