"""通用AI服务 - 支持多种AI提供商"""
import asyncio
import json
import os
import re
from enum import Enum
from typing import Dict, Any, Optional, List
from openai import OpenAI, AsyncOpenAI
from app.core.settings import settings
from app.services.template_service import template_service

class AIProvider(str, Enum):
    """AI提供商枚举"""
    DEEPSEEK = "deepseek"
    VOLCANO = "volcano"
    OPENAI = "openai"

class AIService:
    """通用AI服务客户端"""
    
    def __init__(self):
        self.config_file = "ai_providers.json"
        self.provider = self._get_provider()
        self.api_key = self._get_api_key()
        self.base_url = self._get_base_url()
        self.model = self._get_model()
        
        # 检查配置
        if not self.api_key:
            self._create_default_env()
            raise ValueError(f"AI配置未找到，请配置相应的API密钥")
        
        # 初始化客户端
        self.client = self._init_client()
        self.async_client = self._init_async_client()
    
    def _get_provider(self) -> AIProvider:
        """获取AI提供商"""
        provider = os.getenv("AI_PROVIDER", "").lower()
        if provider == "volcano":
            return AIProvider.VOLCANO
        elif provider == "openai":
            return AIProvider.OPENAI
        else:
            return AIProvider.DEEPSEEK  # 默认使用DeepSeek
    
    def _get_api_key(self) -> str:
        """获取API密钥 - 扫描多种可能的环境变量"""
        possible_keys = []
        
        if self.provider == AIProvider.VOLCANO:
            possible_keys = ["ARK_API_KEY", "VOLCANO_API_KEY", "DOUBAO_API_KEY"]
        elif self.provider == AIProvider.OPENAI:
            possible_keys = ["OPENAI_API_KEY", "OPENAI_KEY", "GPT_API_KEY"]
        else:  # DEEPSEEK
            possible_keys = ["DEEPSEEK_API_KEY", "DEEPSEEK_KEY"]
        
        # 扫描所有可能的环境变量
        for key_name in possible_keys:
            api_key = os.getenv(key_name, "").strip()
            if api_key and api_key != "your_deepseek_api_key_here" and api_key != "your_openai_api_key_here" and api_key != "your_ark_api_key_here":
                print(f"✅ 找到有效的API密钥: {key_name}")
                return api_key
        
        print(f"⚠️ 未找到有效的API密钥，扫描的变量: {possible_keys}")
        return ""
    
    def _get_base_url(self) -> str:
        """获取API基础URL"""
        if self.provider == AIProvider.VOLCANO:
            return os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
        elif self.provider == AIProvider.OPENAI:
            return os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        else:
            return os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    
    def _get_model(self) -> str:
        """获取模型名称"""
        if self.provider == AIProvider.VOLCANO:
            return os.getenv("ARK_MODEL", "doubao-1-5-pro-32k-250115")
        elif self.provider == AIProvider.OPENAI:
            return os.getenv("OPENAI_MODEL", "gpt-4.1")
        else:
            return os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    
    def _init_client(self) -> OpenAI:
        """初始化同步客户端"""
        timeout = 1800 if self.provider == AIProvider.VOLCANO else 30
        return OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=timeout
        )
    
    def _init_async_client(self) -> AsyncOpenAI:
        """初始化异步客户端"""
        timeout = 1800 if self.provider == AIProvider.VOLCANO else 30
        return AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=timeout
        )
    
    def _create_default_env(self):
        """创建默认的.env文件"""
        env_path = ".env"
        if not os.path.exists(env_path):
            default_env_content = """# AI服务配置
# 选择AI提供商: deepseek, volcano, openai
AI_PROVIDER=deepseek

# DeepSeek 配置
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# 火山引擎 配置
ARK_API_KEY=your_ark_api_key_here
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL=doubao-seed-1-6-250615

# OpenAI 配置
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1

# 应用配置
APP_ENV=dev
APP_HOST=0.0.0.0
APP_PORT=8000
DEBUG=true
ALLOWED_ORIGINS=http://localhost:3000
"""
            with open(env_path, 'w', encoding='utf-8') as f:
                f.write(default_env_content)
            print(f"✅ 已创建默认配置文件: {env_path}")
    
    def reconfigure(self, provider: str = None, api_key: str = None, base_url: str = None, model: str = None):
        """动态重新配置AI服务"""
        try:
            # 更新提供商
            if provider:
                # 验证提供商是否有效
                if provider not in [p.value for p in AIProvider]:
                    raise ValueError(f"不支持的AI提供商: {provider}")
                
                # 临时更新环境变量
                os.environ["AI_PROVIDER"] = provider
                self.provider = AIProvider(provider)
            
            # 更新API密钥
            if api_key:
                if self.provider == AIProvider.VOLCANO:
                    os.environ["ARK_API_KEY"] = api_key
                elif self.provider == AIProvider.OPENAI:
                    os.environ["OPENAI_API_KEY"] = api_key
                else:
                    os.environ["DEEPSEEK_API_KEY"] = api_key
                self.api_key = api_key
            else:
                self.api_key = self._get_api_key()
            
            # 更新基础URL
            if base_url:
                if self.provider == AIProvider.VOLCANO:
                    os.environ["ARK_BASE_URL"] = base_url
                elif self.provider == AIProvider.OPENAI:
                    os.environ["OPENAI_BASE_URL"] = base_url
                else:
                    os.environ["DEEPSEEK_BASE_URL"] = base_url
                self.base_url = base_url
            else:
                self.base_url = self._get_base_url()
            
            # 更新模型
            if model:
                if self.provider == AIProvider.VOLCANO:
                    os.environ["ARK_MODEL"] = model
                elif self.provider == AIProvider.OPENAI:
                    os.environ["OPENAI_MODEL"] = model
                else:
                    os.environ["DEEPSEEK_MODEL"] = model
                self.model = model
            else:
                self.model = self._get_model()
            
            # 检查API密钥
            if not self.api_key:
                raise ValueError(f"缺少{self.provider.value}的API密钥")
            
            # 重新初始化客户端
            self.client = self._init_client()
            self.async_client = self._init_async_client()
            
            # 保存配置到文件
            if api_key:  # 只有提供了新的API密钥才保存
                self._save_config(self.provider.value, api_key, self.base_url, self.model)
            
            print(f"✅ AI服务已重新配置: {self.get_provider_info()}")
            return True
            
        except Exception as e:
            print(f"❌ AI服务重新配置失败: {e}")
            return False
    
    def _load_saved_configs(self) -> Dict[str, Dict[str, str]]:
        """加载已保存的配置"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"⚠️ 加载配置文件失败: {e}")
        return {}
    
    def _save_config(self, provider: str, api_key: str, base_url: str, model: str):
        """保存提供商配置"""
        try:
            configs = self._load_saved_configs()
            configs[provider] = {
                "api_key": api_key,
                "base_url": base_url,
                "model": model,
                "configured_at": json.dumps({"timestamp": "now"})  # 简化的时间戳
            }
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(configs, f, ensure_ascii=False, indent=2)
            
            print(f"✅ 已保存 {provider} 配置")
        except Exception as e:
            print(f"❌ 保存配置失败: {e}")
    
    def get_all_configured_providers(self) -> Dict[str, Dict[str, Any]]:
        """获取所有已配置的提供商"""
        configs = self._load_saved_configs()
        result = {}
        
        for provider, config in configs.items():
            if config.get("api_key"):
                result[provider] = {
                    "provider": provider,
                    "model": config.get("model", ""),
                    "base_url": config.get("base_url", ""),
                    "api_key_configured": True,
                    "api_key_preview": "***已配置***"  # 完全隐藏API密钥
                }
        
        return result
    
    def switch_to_provider(self, provider: str) -> bool:
        """切换到已配置的提供商"""
        try:
            configs = self._load_saved_configs()
            if provider not in configs:
                raise ValueError(f"提供商 {provider} 未配置")
            
            config = configs[provider]
            return self.reconfigure(
                provider=provider,
                api_key=config["api_key"],
                base_url=config["base_url"],
                model=config["model"]
            )
        except Exception as e:
            print(f"❌ 切换提供商失败: {e}")
            return False
    
    def get_provider_info(self) -> Dict[str, Any]:
        """获取当前提供商信息"""
        return {
            "provider": self.provider.value,
            "model": self.model,
            "base_url": self.base_url,
            "api_key_configured": bool(self.api_key),
            "api_key_preview": "***已配置***" if self.api_key else "未配置"  # 完全隐藏API密钥
        }
    
    @staticmethod
    def scan_environment_keys() -> Dict[str, Any]:
        """扫描环境变量中的API密钥配置"""
        scan_result = {
            "deepseek": {"found": False, "keys": [], "valid_key": None},
            "openai": {"found": False, "keys": [], "valid_key": None},
            "volcano": {"found": False, "keys": [], "valid_key": None}
        }
        
        # 定义所有可能的环境变量名
        all_possible_keys = {
            "deepseek": ["DEEPSEEK_API_KEY", "DEEPSEEK_KEY"],
            "openai": ["OPENAI_API_KEY", "OPENAI_KEY", "GPT_API_KEY"],
            "volcano": ["ARK_API_KEY", "VOLCANO_API_KEY", "DOUBAO_API_KEY"]
        }
        
        # 扫描所有环境变量
        for provider, key_names in all_possible_keys.items():
            for key_name in key_names:
                api_key = os.getenv(key_name, "").strip()
                if api_key:
                    scan_result[provider]["keys"].append({
                        "name": key_name,
                        "preview": f"{api_key[:8]}..." if len(api_key) > 8 else "短密钥",
                        "is_placeholder": api_key in ["your_deepseek_api_key_here", "your_openai_api_key_here", "your_ark_api_key_here"]
                    })
                    
                    # 检查是否是有效密钥（非占位符）
                    if api_key not in ["your_deepseek_api_key_here", "your_openai_api_key_here", "your_ark_api_key_here"]:
                        scan_result[provider]["found"] = True
                        if not scan_result[provider]["valid_key"]:
                            scan_result[provider]["valid_key"] = key_name
        
        return {
            "scan_result": scan_result,
            "summary": {
                "total_providers_configured": sum(1 for p in scan_result.values() if p["found"]),
                "recommended_provider": next((k for k, v in scan_result.items() if v["found"]), "deepseek"),
                "needs_configuration": not any(p["found"] for p in scan_result.values())
            }
        }
    
    async def call_ai_api(self, prompt: str, max_tokens: int = 8192) -> str:
        """统一的AI API调用接口"""
        try:
            api_params = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的英语教学助手，专门帮助中国学生学习英语。请严格按照要求返回JSON格式的结果。"
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
            }
            
            # OpenAI 使用 max_completion_tokens，其他提供商使用 max_tokens
            if self.provider == AIProvider.OPENAI:
                api_params["max_completion_tokens"] = max_tokens
            else:
                api_params["max_tokens"] = max_tokens
                
            response = await self.async_client.chat.completions.create(**api_params)
            
            # 处理火山引擎的特殊响应格式
            if self.provider == AIProvider.VOLCANO and hasattr(response.choices[0].message, 'reasoning_content'):
                reasoning = response.choices[0].message.reasoning_content
                content = response.choices[0].message.content
                print(f"💭 推理过程: {reasoning}")
                return content
            
            return response.choices[0].message.content
            
        except Exception as e:
            raise Exception(f"{self.provider.value} API请求失败: {str(e)}")
    
    async def call_ai_api_stream(self, prompt: str, max_tokens: int = 8192):
        """统一的AI API流式调用接口"""
        try:
            stream_params = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的英语教学助手，专门帮助中国学生学习英语。请严格按照要求返回JSON格式的结果。"
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "stream": True
            }
            
            # OpenAI 使用 max_completion_tokens，其他提供商使用 max_tokens
            if self.provider == AIProvider.OPENAI:
                stream_params["max_completion_tokens"] = max_tokens
            else:
                stream_params["max_tokens"] = max_tokens
                
            response = await self.async_client.chat.completions.create(**stream_params)
            
            async for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            raise Exception(f"{self.provider.value} API流式请求失败: {str(e)}")
    
    @staticmethod
    def extract_json_from_response(response: str) -> Dict[str, Any]:
        """从响应中提取JSON内容"""
        try:
            # 尝试直接解析
            return json.loads(response)
        except json.JSONDecodeError:
            # 尝试提取JSON部分
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            
            # 如果无法解析，返回错误信息
            raise Exception(f"无法解析AI响应为JSON格式: {response}")

# 创建全局AI服务实例
try:
    ai_service = AIService()
    print(f"✅ AI服务初始化成功: {ai_service.get_provider_info()}")
except Exception as e:
    print(f"❌ AI服务初始化失败: {e}")
    ai_service = None