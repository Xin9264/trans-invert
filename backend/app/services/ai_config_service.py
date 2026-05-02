"""Helpers for request-scoped DeepSeek configuration."""
from typing import Dict, Optional

from fastapi import Request

from app.services.ai_service import AIProvider, AIService, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL


def get_user_ai_config(request: Request) -> Optional[Dict[str, str]]:
    """Read DeepSeek API configuration from request headers."""
    api_key = request.headers.get("x-ai-key")
    base_url = request.headers.get("x-ai-base-url") or DEEPSEEK_BASE_URL

    if not api_key:
        return None

    return {
        "provider": AIProvider.DEEPSEEK.value,
        "api_key": api_key,
        "base_url": base_url,
        "model": DEEPSEEK_MODEL,
    }


def create_user_ai_service(user_config: Dict[str, str]) -> AIService:
    """Create a temporary DeepSeek AIService instance from request headers."""
    temp_service = AIService.__new__(AIService)
    temp_service.config_file = None
    temp_service.provider = AIProvider.DEEPSEEK
    temp_service.api_key = user_config["api_key"]
    temp_service.base_url = user_config.get("base_url") or DEEPSEEK_BASE_URL
    temp_service.model = DEEPSEEK_MODEL
    temp_service.client = temp_service._init_client()
    temp_service.async_client = temp_service._init_async_client()
    return temp_service
