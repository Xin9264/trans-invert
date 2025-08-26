#!/bin/bash

# Trans Invert 启动脚本

echo "🚀 启动 Trans Invert 回译法语言练习平台..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 检查环境变量文件
if [ ! -f "backend/.env" ]; then
    echo "📝 创建环境变量文件..."
    cp backend/.env.example backend/.env
    echo "⚠️  请编辑 backend/.env 文件，配置您的 DeepSeek API Key"
    echo "   DEEPSEEK_API_KEY=your-api-key-here"
    read -p "按回车键继续..."
fi

# 停止可能存在的容器
echo "🛑 停止现有容器..."
docker-compose -f docker-compose.dev.yml down

# 构建并启动服务
echo "🔨 构建并启动服务..."
docker-compose -f docker-compose.dev.yml up -d --build

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 15

# 检查服务状态
echo "📊 检查服务状态..."
docker-compose -f docker-compose.dev.yml ps

# 测试后端API
echo "🧪 测试后端API..."
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ 后端API正常"
else
    echo "⚠️  后端API可能还在启动中"
fi

# 显示访问信息
echo ""
echo "✅ 启动完成！"
echo ""
echo "📱 前端应用: http://localhost:3000"
echo "🔧 后端API: http://localhost:8000"
echo "📋 API文档: http://localhost:8000/docs"
echo ""
echo "🔄 核心流程测试："
echo "1. 打开前端应用 http://localhost:3000"
echo "2. 上传英文文本"
echo "3. 等待AI分析完成"
echo "4. 开始练习（看中文写英文）"
echo "5. 获得AI评分反馈"
echo ""
echo "📝 查看日志: docker-compose -f docker-compose.dev.yml logs -f"
echo "🛑 停止服务: docker-compose -f docker-compose.dev.yml down"
echo ""