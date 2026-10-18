$ErrorActionPreference = "Stop"

Write-Host "将删除 Docker 构建缓存，但保留镜像、容器、数据库卷和项目源码。"
$answer = Read-Host "确认继续吗？输入 y 继续"
if ($answer -notin @("y", "Y", "yes", "YES")) {
    Write-Host "已取消。"
    exit 0
}

docker builder prune -f
Write-Host "Docker 构建缓存已清理。"
Write-Host "可用 docker system df 查看当前磁盘占用。"
