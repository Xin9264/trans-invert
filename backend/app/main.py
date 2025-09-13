"""Refactored main application using DDD architecture"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.settings import settings
from app.schemas.text import APIResponse

# Import existing services
from app.services.ai_service import ai_service
from app.services.template_service import template_service
from app.services.data_persistence import data_persistence

# Import DDD components
from app.infrastructure.container import DIContainer
from app.routers.texts import create_text_router
from app.routers.practice import create_practice_router
from app.routers.folders import create_folder_router
from app.routers.review import create_review_router

# Import legacy routers for config and backup
from app.routers import config, backup


# Initialize data storage
texts_storage = {}
analyses_storage = {}
practice_history = []
folders_storage = {}


def initialize_data():
    """Initialize data from local files"""
    global practice_history, texts_storage, analyses_storage, folders_storage
    try:
        print("🔄 Loading data from local files...")
        loaded_history, loaded_texts, loaded_analyses, loaded_folders = data_persistence.load_all_data()

        practice_history = loaded_history
        texts_storage = loaded_texts
        analyses_storage = loaded_analyses
        folders_storage = loaded_folders

        print(f"✅ Data loaded successfully: {len(practice_history)} history records, "
              f"{len(texts_storage)} texts, {len(analyses_storage)} analyses, "
              f"{len(folders_storage)} folders")
    except Exception as e:
        print(f"❌ Data loading failed: {e}")
        print("ℹ️  Starting with empty data stores")


# Initialize data on startup
initialize_data()

# Create DI container
container = DIContainer(
    texts_storage=texts_storage,
    analyses_storage=analyses_storage,
    practice_history=practice_history,
    folders_storage=folders_storage,
    ai_service=ai_service,
    template_service=template_service,
    data_persistence_service=data_persistence
)

# 创建FastAPI应用
app = FastAPI(
    title="Trans Invert API",
    description="回译法语言练习平台后端API",
    version="2.0.0",  # Updated to 2.0.0 for DDD refactor
    debug=settings.DEBUG
)

# 配置CORS - 开发和部署阶段允许所有源
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有源，生产环境应该配置具体域名
    allow_credentials=False,  # 使用 * 时必须设为 False
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Register DDD routers
app.include_router(create_text_router(container))
app.include_router(create_practice_router(container))
app.include_router(create_folder_router(container))
app.include_router(create_review_router(container))

# Register legacy routers (for config and backup functionality)
app.include_router(config.router)
app.include_router(backup.router)

# API根路径（仅在开发环境或没有静态文件时显示）
static_dir = "/app/static"
if not os.path.exists(static_dir):
    @app.get("/", response_model=APIResponse)
    async def root():
        """根路径"""
        return APIResponse(
            success=True,
            data={"message": "Trans Invert API", "version": "2.0.0"},
            message="API运行正常"
        )

# 静态文件服务（生产环境）
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

@app.get("/health", response_model=APIResponse)
async def health_check():
    """健康检查"""
    return APIResponse(
        success=True,
        data={
            "status": "healthy",
            "environment": settings.APP_ENV,
            "deepseek_configured": bool(settings.DEEPSEEK_API_KEY)
        },
        message="服务运行正常"
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP异常处理"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "message": "请求处理失败"
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """通用异常处理"""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "内部服务器错误",
            "message": "服务暂时不可用，请稍后重试"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.DEBUG
    )
