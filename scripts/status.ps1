$ErrorActionPreference = "Stop"

Push-Location "$PSScriptRoot\.."
try {
    docker compose ps
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "工作台：http://localhost:8080"
Write-Host "API 文档：http://localhost:8000/docs"
