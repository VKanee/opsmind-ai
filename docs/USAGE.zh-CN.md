# 中文使用与部署指南

## 1. 这个项目解决什么问题

OpsMind AI 主要解决线上事故处理期间的“信息分散”和“决策缺少证据”问题。
典型流程如下：

1. 监控系统或用户报告发现故障。
2. 值班人员在系统中登记事故、服务、等级和运行信号。
3. 点击“开始 AI 调查”。
4. 系统检索内部处置手册、服务依赖和历史复盘。
5. AI 生成故障假设和处置建议，并显示证据来源。
6. 生产变更进入审批队列。
7. 响应者批准或驳回，系统写入审计日志。

## 2. 目标用户

- SRE、值班工程师和事故指挥者。
- DevOps、平台工程和基础架构团队。
- 需要整理运行手册和复盘资料的技术团队。
- 正在建设企业 AIOps / LLMOps 能力的研发团队。
- 需要展示完整工程能力的求职者。

## 3. 本地启动

### 前提

- Windows 10/11、macOS 或 Linux。
- 已安装 Docker Desktop。

### 启动

在仓库根目录执行：

```powershell
.\scripts\start.ps1
```

如果脚本无法运行，可以直接执行：

```powershell
docker compose up -d --build
```

访问：

```text
http://localhost:8080
```

### 查看状态

```powershell
.\scripts\status.ps1
```

### 关闭

保留数据库并停止容器：

```powershell
.\scripts\stop.ps1
```

这一步会停止 Web、API 和 PostgreSQL 容器，但 Docker Desktop 仍然在后台运行。
Docker Desktop 本身也会占用内存，如果不准备继续使用，可以再关闭它：

```powershell
.\scripts\quit-docker.ps1
```

重新启动：

```powershell
.\scripts\start.ps1
```

`start.ps1` 会在 Docker Desktop 未运行时自动启动 Docker，然后启动项目容器。

彻底关闭并删除演示数据库：

```powershell
docker compose down -v
```

最后一条命令会删除 PostgreSQL 数据卷，只适用于本地演示环境。

## 3.1 Docker 占用磁盘的原因

Docker Desktop 会把以下内容保存到 Windows 的 WSL 虚拟磁盘：

- Web 和 API 镜像。
- PostgreSQL 镜像。
- 构建时产生的临时层和缓存。
- 项目数据库卷。

默认磁盘文件通常位于：

```text
C:\Users\<用户名>\AppData\Local\Docker\wsl\disk\docker_data.vhdx
```

当前实测：

- 镜像约 809 MB。
- 构建缓存约 1.24 GB。
- 数据库卷约 49 MB。
- WSL 虚拟磁盘文件约 3.38 GB。

项目源码、`.venv` 和 `node_modules` 位于 E 盘，不在 C 盘。C 盘占用变化还可能来自
Windows 更新和 Docker Desktop 自身的程序文件。

查看占用：

```powershell
docker system df
```

只清理可安全重建的 Docker 构建缓存：

```powershell
.\scripts\clean-build-cache.ps1
```

清理后 WSL 虚拟磁盘文件可能不会马上缩小，但后续构建不会再继续增加这部分缓存。
不要直接执行 `docker system prune -a --volumes`，除非你确认没有其他 Docker 项目依赖
这些镜像和数据卷。

## 4. 同局域网访问

当前 Docker Compose 已将 Web 端口映射到 `0.0.0.0:8080`。同一网络的同事可以通过
你的局域网 IP 访问。

查看本机 IPv4：

```powershell
ipconfig
```

假设 IPv4 为 `192.168.1.20`，对方访问：

```text
http://192.168.1.20:8080
```

如果无法打开，检查 Windows 防火墙是否允许 8080 入站。不要把演示环境直接暴露到
公网，也不要在里面录入真实企业数据。

## 5. 部署到公网

### 推荐方式

1. 准备 Linux 云服务器。
2. 安装 Docker 和 Docker Compose。
3. 克隆仓库。
4. 将 `deploy/.env.docker.example` 复制为仓库根目录的 `.env`，并修改：
   - 更换 `OPSMIND_JWT_SECRET`。
   - 更换演示账号密码。
   - 决定是否保留 `OPSMIND_SEED_DEMO_DATA=true`。
   - 配置模型接口。
5. 执行：

```bash
docker compose up -d --build
```

6. 安装 Caddy，使用仓库示例 `deploy/Caddyfile.example` 配置域名和 HTTPS。
7. 云安全组只开放 22、80、443。

启动 Caddy 的示例：

```bash
caddy run --config deploy/Caddyfile.example
```

如果希望把配置复制到本地文件再修改：

```bash
cp deploy/Caddyfile.example deploy/Caddyfile
caddy run --config deploy/Caddyfile
```

`deploy/Caddyfile.example` 中的域名需要替换为真实域名：

```text
opsmind.example.com
```

将 `opsmind.example.com` 替换成你的真实域名，并先完成 DNS 解析。

也可以使用系统服务方式运行 Caddy：

```bash
caddy run --config deploy/Caddyfile
```

### 临时公网演示

可以使用 Cloudflare Tunnel：

```bash
cloudflared tunnel --url http://localhost:8080
```

或 ngrok：

```bash
ngrok http 8080
```

这类链接是临时的，不适合长期使用，也不要在其中输入真实敏感信息。

## 6. GitHub 仓库与在线访问的关系

GitHub 只保存源代码，不会自动启动 FastAPI、PostgreSQL 和 React 服务。

- 查看代码和文档：直接打开 GitHub 仓库。
- 体验系统：需要本地 Docker、局域网环境或公网服务器。
- GitHub Pages 不能单独承载这个项目，因为后端需要数据库和 API 服务。

## 7. 本地源码开发

Docker 方式和源码开发方式二选一。Docker 正在运行时，8000 和 5173 端口可能被占用，
请先执行 `.\scripts\stop.ps1`。

启动 PowerShell 开发模式：

```powershell
.\scripts\dev.ps1
```

该脚本会在后台启动 API 和前端开发服务器，日志写入 `.dev/`。

停止：

```powershell
.\scripts\dev-stop.ps1
```

前端地址：

```text
http://localhost:5173
```

API 地址：

```text
http://localhost:8000
```

中文 API 使用说明：

```text
http://localhost:8080/docs
```

开发者交互式 Swagger：

```text
http://localhost:8080/swagger
```

## 8. 演示账号

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| 管理员 | `admin@opsmind.local` | `OpsMind!2026` |
| 响应者 | `responder@opsmind.local` | `OpsMind!2026` |
| 只读用户 | `viewer@opsmind.local` | `OpsMind!2026` |

角色差异：

- 管理员可以新增知识、创建事故、发起调查和审批。
- 响应者可以创建事故、发起调查和审批。
- 只读用户可以查看全部页面，但不能执行写操作。

## 9. 连接真实模型

默认 `OPSMIND_LLM_MODE=demo`，不需要模型密钥。

使用 OpenAI 兼容接口时，在 `.env` 或环境变量中配置：

```text
OPSMIND_LLM_MODE=openai_compatible
OPSMIND_LLM_BASE_URL=https://api.openai.com/v1
OPSMIND_LLM_API_KEY=你的密钥
OPSMIND_LLM_MODEL=你的模型名称
```

配置后重新启动 API。模型返回结构异常时，系统会自动回退到演示分析器。

## 10. 常见问题

### 页面打不开

先检查容器状态：

```powershell
docker compose ps
```

再看日志：

```powershell
docker compose logs -f api web
```

### 端口被占用

修改 `compose.yaml` 中 Web 的 `8080:80` 映射，例如改成 `8081:80`，然后访问
`http://localhost:8081`。

### 修改了演示数据但页面没变化

演示数据只在数据库为空时初始化。需要重建演示库：

```powershell
docker compose down -v
.\scripts\start.ps1
```

### 中文搜索效果不理想

当前使用本地中文二元分词和哈希向量，适合演示和中小知识库。生产环境应接入
pgvector 和经过验证的 Embedding 模型。
