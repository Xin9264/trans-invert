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
# 编辑 backend/.env，设置您的 DEEPSEEK_API_KEY

# 2. 启动服务
./start.sh

# 3. 访问应用
# 前端: http://localhost:3000
# 后端: http://localhost:8000
# API文档: http://localhost:8000/docs
```

⚠️ **重要**: 请确保在 `backend/.env` 文件中设置您的 DeepSeek API 密钥，不要将API密钥提交到代码仓库中！

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

## API 接口概览

提示：部分生成/评估接口需在请求头中携带 AI 配置：
- `x-ai-provider: deepseek|openai|volcano`
- `x-ai-key: <api_key>` 可选：`x-ai-base-url`, `x-ai-model`

文本与练习 `/api/texts`
- POST `/upload` 上传英文文本并生成分析
- GET `/{text_id}` 获取材料详情；GET `/{text_id}/analysis` 获取分析
- POST `/practice/submit` 提交练习并评估；GET `/practice/history` 获取练习历史
- GET `/{text_id}/practice/history` 获取指定材料的历史
- POST `/{text_id}/move` 移动材料到文件夹；DELETE `/{text_id}` 删除材料
- GET `/materials/export` 导出材料；POST `/materials/import` 导入材料
- GET `/practice/history/export` 导出历史；POST `/practice/history/import` 导入历史

作文练习 `/api/essays`
- POST `/generate` 流式生成范文
- POST `/sessions` 创建会话；GET `/sessions/{id}` 获取会话
- POST `/sessions/{id}/submit` 提交作文评估；GET `/history` 获取作文历史
- DELETE `/sessions/{id}` 删除会话

文件夹 `/api/folders`
- GET `/` 列出；POST `/` 新建；GET `/{folder_id}` 获取；PUT `/{folder_id}` 更新；DELETE `/{folder_id}` 删除
- GET `/tree/all` 获取树形结构

复习助手 `/api/review`
- POST `/generate` 基于历史生成复习材料
- GET `/stats` 获取复习统计；POST `/mark/{text_id}` 标记复习完成

配置 `/api/config`
- GET `/scan-keys` 扫描环境变量；GET `/current-config` 当前配置
- POST `/set-api-key` 设置密钥；POST `/test-connection` 测试连接

备份与恢复 `/api/backup`
- GET `/export` 导出统一快照（folders/texts/analyses/history）
- POST `/import?mode=merge|replace&dry_run=true|false` 导入快照（支持预览）

示例（导出备份）
```bash
curl -sS http://localhost:8000/api/backup/export -o backup.json
```
