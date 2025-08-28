"""应用配置设置"""
import os
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

class Settings(BaseModel):
    """应用设置"""
    
    # 应用基础配置
    APP_ENV: str = os.getenv("APP_ENV", "dev")
    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT: int = int(os.getenv("APP_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # AI 服务配置
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "deepseek")
    
    # DeepSeek API 配置
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    DEEPSEEK_MODEL: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    
    # 火山引擎 API 配置
    ARK_API_KEY: str = os.getenv("ARK_API_KEY", "")
    ARK_BASE_URL: str = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
    ARK_MODEL: str = os.getenv("ARK_MODEL", "doubao-1-5-pro-32k-250115")
    
    # OpenAI API 配置
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4.1")
    
    # CORS 配置
    ALLOWED_ORIGINS: List[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://trans-invert-6msn9n32f-wang-xins-projects-60bfd166.vercel.app,https://*.vercel.app").split(",")
    
    # 速率限制配置
    ENABLE_RATE_LIMIT: bool = os.getenv("ENABLE_RATE_LIMIT", "false").lower() == "true"
    REQUESTS_PER_MINUTE: int = int(os.getenv("REQUESTS_PER_MINUTE", "60"))
    
    class Config:
        case_sensitive = True

# 创建全局设置实例
settings = Settings()
