$ErrorActionPreference = "Stop"

Write-Host "开始验证后端..."
Push-Location "$PSScriptRoot\..\apps\api"
try {
    .\.venv\Scripts\ruff.exe check app tests
    .\.venv\Scripts\ruff.exe format --check app tests
    .\.venv\Scripts\mypy.exe app
    .\.venv\Scripts\pytest.exe
    .\.venv\Scripts\python.exe -m app.evaluation
}
finally {
    Pop-Location
}

Write-Host "开始验证前端..."
Push-Location "$PSScriptRoot\..\apps\web"
try {
    npm run lint
    npm test
    npm run build
}

Write-Host "全部验证通过。"
finally {
    Pop-Location
}
