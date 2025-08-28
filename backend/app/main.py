"""Trans Invert 后端主应用"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from app.core.settings import settings
from app.routers import texts
from app.schemas.text import APIResponse

# 创建FastAPI应用
app = FastAPI(
    title="Trans Invert API",
    description="回译法语言练习平台后端API",
    version="1.0.0",
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

# 注册路由
app.include_router(texts.router)

# API根路径（仅在开发环境或没有静态文件时显示）
static_dir = "/app/static"
if not os.path.exists(static_dir):
    @app.get("/", response_model=APIResponse)
    async def root():
        """根路径"""
        return APIResponse(
            success=True,
            data={"message": "Trans Invert API", "version": "1.0.0"},
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
