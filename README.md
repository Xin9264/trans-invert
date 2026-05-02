# Trans Invert 回译法语言练习平台

一个本地自用的英语回译练习工具：上传英文文本 → AI 分析+翻译 → 看中文回写英文 → AI 评判与建议。

## 技术栈

- **后端**: Python 3.11 + FastAPI + Jinja2 模板，JSON 文件持久化
- **前端**: React + TypeScript + Vite + Tailwind CSS + Zustand
- **AI**: DeepSeek V4 Pro（`deepseek-v4-pro`），通过 DeepSeek 的 OpenAI 兼容协议调用

## 本地运行

前置：本机已安装 `python3 >= 3.11`、`node >= 18`。

一键启动（后台运行前后端）：

```bash
./start.sh
```

停止：

```bash
./stop.sh
```

访问：
- 前端: http://localhost:3000
- 后端: http://localhost:8000
- API 文档: http://localhost:8000/docs

日志写在 `.logs/{backend,frontend}.log`。

## 手动启动（如果想分别看输出）

后端：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

前端（另开终端）：

```bash
cd frontend
npm install
npm run dev
```

## AI 配置

打开前端页面 → 「DeepSeek」填入 API Key，保存到浏览器本地。
不需要在后端配 `.env`，每次请求会通过请求头把 DeepSeek API Key 带过去。也可以设置环境变量 `DEEPSEEK_API_KEY`。

## 项目结构

```
trans-invert/
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── routers/        # 路由：texts / folders / review / config / backup
│   │   ├── services/       # AI / 模板 / 持久化 / 备份
│   │   ├── schemas/        # Pydantic 模型
│   │   └── templates/      # Jinja2 prompt 模板
│   └── data/               # JSON 持久化数据（gitignore）
├── frontend/               # React + Vite 前端
│   └── src/
│       ├── pages/          # Home / Upload / Practice / History / Review
│       ├── components/
│       ├── store/          # Zustand
│       └── utils/api.ts    # 统一 HTTP 层
├── start.sh / stop.sh      # 本地一键启停
└── package.json            # 顶层脚本快捷方式
```

## 数据备份

```bash
# 导出
curl -sS http://localhost:8000/api/backup/export -o backup.json

# 导入
curl -X POST "http://localhost:8000/api/backup/import?mode=merge" \
     -H "Content-Type: application/json" \
     --data @backup.json
```
