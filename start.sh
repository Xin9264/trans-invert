#!/bin/bash
set -euo pipefail

# Trans Invert 启动脚本（支持 docker compose v2）

echo "🚀 启动 Trans Invert 回译法语言练习平台..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
  echo "❌ 未检测到 Docker，请先安装 Docker"
  exit 1
fi

# 选择 compose 命令（优先使用 docker compose）
COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  else
    echo "❌ 未检测到 docker compose 或 docker-compose"
    exit 1
  fi
fi

# 选择 compose 文件（优先使用根目录 docker-compose.yml）
COMPOSE_FILE_FLAG=""
if [ -f ./docker-compose.yml ]; then
  echo "📦 使用 docker-compose.yml"
else
  echo "📦 使用 docker-compose.dev.yml"
  COMPOSE_FILE_FLAG="-f docker-compose.dev.yml"
fi

echo "🛑 停止现有容器..."
set +e
$COMPOSE $COMPOSE_FILE_FLAG down
set -e

# 构建并启动
echo "🔨 构建并启动服务..."
set +e
$COMPOSE $COMPOSE_FILE_FLAG up -d --build
dc_status=$?
set -e

if [ $dc_status -ne 0 ]; then
  echo "❌ 启动失败。常见原因：无法从 DockerHub 拉取镜像（网络/权限问题）。"
  echo "👉 解决方案1：为基础镜像指定国内镜像源后重试："
  echo "   export PY_BASE_IMAGE=registry.docker-cn.com/library/python:3.11-slim"
  echo "   export NODE_BASE_IMAGE=registry.docker-cn.com/library/node:18-alpine"
  echo "   ./start.sh"
  echo "   （可替换为其它镜像，如 docker.m.daocloud.io/library/... 或 hub.uuuadc.top/library/...）"
  echo "👉 解决方案2：在 Docker Desktop 设置 registry-mirrors 后重试。"
  echo "👉 解决方案3：本地开发模式启动（无需 Docker）："
  echo "   1) 后端：cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload"
  echo "   2) 前端：cd frontend && npm install && npm run dev"
  exit 1
fi

# 等待后台健康（最多 ~40s）
echo "⏳ 等待后端服务健康就绪..."
for i in {1..20}; do
  if curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
    echo "✅ 后端已就绪"
    break
  fi
  sleep 2
done

echo "📊 当前容器状态："
$COMPOSE $COMPOSE_FILE_FLAG ps

echo
echo "✅ 启动完成！"
echo
echo "📱 前端:  http://localhost:3000"
echo "🔧 后端:  http://localhost:8000"
echo "📋 文档:  http://localhost:8000/docs"
echo
echo "💡 提示：无需 backend/.env，您可以在前端中通过『API 配置』输入密钥，或调用后端 /api/config 接口动态设置。"
echo
echo "📝 查看日志: $COMPOSE $COMPOSE_FILE_FLAG logs -f"
echo "🛑 停止服务: $COMPOSE $COMPOSE_FILE_FLAG down"
echo
