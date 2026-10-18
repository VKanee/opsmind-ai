$ErrorActionPreference = "Stop"

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

Push-Location "$PSScriptRoot\..\apps\web"
try {
    npm run lint
    npm test
    npm run build
}
finally {
    Pop-Location
}
