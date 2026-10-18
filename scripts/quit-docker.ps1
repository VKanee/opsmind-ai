$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path "$PSScriptRoot\.."

Push-Location $repoRoot
try {
    docker compose stop
} finally {
    Pop-Location
}

$dockerProcesses = @("Docker Desktop", "com.docker.backend", "com.docker.build")
foreach ($name in $dockerProcesses) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

Write-Host "OpsMind AI 容器已停止，Docker Desktop 已关闭。"
Write-Host "项目数据库仍保存在 Docker 数据卷中，下次启动时会继续使用。"
