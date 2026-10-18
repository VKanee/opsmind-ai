$ErrorActionPreference = "Stop"

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
