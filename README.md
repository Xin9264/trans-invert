# Trans Invert 回译法语言练习平台

一个基于AI的英语回译练习平台，帮助用户通过中译英练习提升英语表达能力。

## 核心功能

1. 用户上传英文文本
2. AI语法分析+翻译（DeepSeek V3）
3. 遮盖原文，看中文写英文
4. AI智能评判，提供改进建议


## 技术栈

- **后端**: Python + FastAPI + Jinja2模板
- **前端**: React + TypeScript + Tailwind CSS
- **AI**: DeepSeek V3
- **部署**: Docker + Docker Compose

## 快速启动

```bash
# 1. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，设置 DEEPSEEK_API_KEY

# 2. 启动服务
./start.sh

# 3. 访问应用
# 前端: http://localhost:3000
# 后端: http://localhost:8000
# API文档: http://localhost:8000/docs
```

## 项目结构

```
trans_invert/
├── backend/           # Python FastAPI后端
├── frontend/          # React前端
├── docker-compose.dev.yml
├── start.sh
└── test_api.py
```

---

**核心价值**: 通过AI驱动的回译练习，让英语学习者在实际输出中提升表达能力。