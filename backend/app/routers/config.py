"""配置管理路由"""
import os
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.schemas.text import APIResponse
from app.services.ai_service import AIService

router = APIRouter(prefix="/api/config", tags=["配置管理"])

class APIKeyConfig(BaseModel):
    """API密钥配置模型"""
    provider: str
    api_key: str
    base_url: Optional[str] = None
    model: Optional[str] = None

@router.get("/scan-keys", response_model=APIResponse)
async def scan_environment_keys():
    """扫描环境变量中的API密钥配置"""
    try:
        scan_result = AIService.scan_environment_keys()
        return APIResponse(
            success=True,
            data=scan_result,
            message="环境变量扫描完成"
        )
    except Exception as e:
        return APIResponse(
            success=False,
            error=str(e),
            message="扫描环境变量失败"
        )

@router.post("/set-api-key", response_model=APIResponse)
async def set_api_key(config: APIKeyConfig):
    """手动设置API密钥"""
    try:
        # 验证提供商
        valid_providers = ["deepseek", "openai", "volcano"]
        if config.provider not in valid_providers:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的提供商: {config.provider}，支持的提供商: {valid_providers}"
            )
        
        # 验证API密钥格式
        if not config.api_key or len(config.api_key.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="API密钥长度不足或为空"
            )
        
        # 根据提供商设置对应的环境变量
        if config.provider == "deepseek":
            os.environ["DEEPSEEK_API_KEY"] = config.api_key.strip()
            os.environ["AI_PROVIDER"] = "deepseek"
            if config.base_url:
                os.environ["DEEPSEEK_BASE_URL"] = config.base_url
            if config.model:
                os.environ["DEEPSEEK_MODEL"] = config.model
        elif config.provider == "openai":
            os.environ["OPENAI_API_KEY"] = config.api_key.strip()
            os.environ["AI_PROVIDER"] = "openai"
            if config.base_url:
                os.environ["OPENAI_BASE_URL"] = config.base_url
            if config.model:
                os.environ["OPENAI_MODEL"] = config.model
        elif config.provider == "volcano":
            os.environ["ARK_API_KEY"] = config.api_key.strip()
            os.environ["AI_PROVIDER"] = "volcano"
            if config.base_url:
                os.environ["ARK_BASE_URL"] = config.base_url
            if config.model:
                os.environ["ARK_MODEL"] = config.model
        
        # 尝试初始化AI服务验证配置
        try:
            test_service = AIService()
            provider_info = test_service.get_provider_info()
            
            return APIResponse(
                success=True,
                data={
                    "provider": config.provider,
                    "configured": True,
                    "provider_info": provider_info
                },
                message=f"API密钥配置成功，已切换到{config.provider}提供商"
            )
        except Exception as init_error:
            return APIResponse(
                success=False,
                error=f"API密钥可能无效: {str(init_error)}",
                message="配置已保存但初始化失败，请检查API密钥是否正确"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        return APIResponse(
            success=False,
            error=str(e),
            message="设置API密钥失败"
        )

@router.get("/current-config", response_model=APIResponse)
async def get_current_config():
    """获取当前AI配置"""
    try:
        # 尝试获取当前配置
        try:
            service = AIService()
            provider_info = service.get_provider_info()
            return APIResponse(
                success=True,
                data={
                    "configured": True,
                    "provider_info": provider_info
                },
                message="获取配置成功"
            )
        except Exception:
            # 如果无法初始化，返回环境扫描结果
            scan_result = AIService.scan_environment_keys()
            return APIResponse(
                success=True,
                data={
                    "configured": False,
                    "scan_result": scan_result
                },
                message="未配置有效的API密钥"
            )
    except Exception as e:
        return APIResponse(
            success=False,
            error=str(e),
            message="获取配置失败"
        )

@router.post("/test-connection", response_model=APIResponse)
async def test_ai_connection():
    """测试AI服务连接"""
    try:
        service = AIService()
        
        # 发送测试请求
        test_prompt = "请回复：连接测试成功"
        result = await service._call_api(test_prompt)
        
        return APIResponse(
            success=True,
            data={
                "test_result": result,
                "provider_info": service.get_provider_info()
            },
            message="AI服务连接测试成功"
        )
    except Exception as e:
        return APIResponse(
            success=False,
            error=str(e),
            message="AI服务连接测试失败"
        )