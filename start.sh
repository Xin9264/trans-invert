#!/bin/bash
set -euo pipefail

# Trans Invert 本地启动脚本（无 Docker，直接在本机跑前后端）

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

if command -v python3.12 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3.12)"
elif command -v python3.11 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3.11)"
else
  echo "❌ 需要 Python 3.11 或 3.12。当前依赖不兼容 Python 3.13。"
  exit 1
fi
PYTHON_VERSION="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"

echo "🚀 启动 Trans Invert 回译法语言练习平台（本地模式）"

# ---------- 后端 ----------
echo "🐍 准备后端环境..."
cd "$BACKEND_DIR"

if [ -d ".venv" ]; then
  VENV_VERSION="$(".venv/bin/python" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
  if [ "$VENV_VERSION" != "$PYTHON_VERSION" ]; then
    echo "   当前 .venv 使用 Python ${VENV_VERSION}，重建为 Python ${PYTHON_VERSION}"
    rm -rf .venv
  fi
fi

if [ ! -d ".venv" ]; then
  echo "   创建虚拟环境 .venv"
  "$PYTHON_BIN" -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate
echo "   使用 Python $(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')"
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo "🚀 启动后端 (uvicorn) ..."
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload \
  > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$LOG_DIR/backend.pid"
deactivate

# 等待后端健康
echo "⏳ 等待后端就绪..."
for i in {1..20}; do
  if curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
    echo "✅ 后端已就绪 (pid=$BACKEND_PID)"
    break
  fi
  sleep 1
  if [ "$i" -eq 20 ]; then
    echo "❌ 后端启动失败，请查看 $LOG_DIR/backend.log"
    exit 1
  fi
done

# ---------- 前端 ----------
echo "📦 准备前端环境..."
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  echo "   安装依赖 npm install"
  npm install
fi

echo "🚀 启动前端 (vite) ..."
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$LOG_DIR/frontend.pid"

cd "$ROOT_DIR"

cat <<EOF

✅ 启动完成！

📱 前端:   http://localhost:3000
🔧 后端:   http://localhost:8000
📋 API 文档: http://localhost:8000/docs

📝 日志：
   后端 → $LOG_DIR/backend.log
   前端 → $LOG_DIR/frontend.log

🛑 停止服务： ./stop.sh
EOF
