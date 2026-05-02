"""DeepSeek-only AI service."""
import json
import os
import re
from enum import Enum
from typing import Any, Dict

from openai import AsyncOpenAI, OpenAI


DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-v4-pro"


class AIProvider(str, Enum):
    """Supported AI provider."""

    DEEPSEEK = "deepseek"


class AIService:
    """DeepSeek API client using the OpenAI-compatible endpoint."""

    def __init__(self):
        self.config_file = "ai_providers.json"
        self.provider = AIProvider.DEEPSEEK
        self.api_key = self._get_api_key()
        self.base_url = self._get_base_url()
        self.model = self._get_model()

        if not self.api_key:
            raise ValueError("DeepSeek API密钥未配置，请设置 DEEPSEEK_API_KEY 或在浏览器中填写 API Key")

        self.client = self._init_client()
        self.async_client = self._init_async_client()

    def _get_provider(self) -> AIProvider:
        """Return the only supported provider."""
        return AIProvider.DEEPSEEK

    def _get_api_key(self) -> str:
        """Read DeepSeek API key from supported environment variables."""
        for key_name in ["DEEPSEEK_API_KEY", "DEEPSEEK_KEY"]:
            api_key = os.getenv(key_name, "").strip()
            if api_key and api_key != "your_deepseek_api_key_here":
                print(f"✅ 找到有效的DeepSeek API密钥: {key_name}")
                return api_key

        print("⚠️ 未找到有效的DeepSeek API密钥，扫描的变量: ['DEEPSEEK_API_KEY', 'DEEPSEEK_KEY']")
        return ""

    def _get_base_url(self) -> str:
        """Read DeepSeek base URL."""
        return os.getenv("DEEPSEEK_BASE_URL", DEEPSEEK_BASE_URL)

    def _get_model(self) -> str:
        """Use DeepSeek V4 Pro only."""
        return DEEPSEEK_MODEL

    def _init_client(self) -> OpenAI:
        """Initialize sync client."""
        return OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=120,
        )

    def _init_async_client(self) -> AsyncOpenAI:
        """Initialize async client."""
        return AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=120,
        )

    def reconfigure(
        self,
        provider: str = None,
        api_key: str = None,
        base_url: str = None,
        model: str = None,
    ) -> bool:
        """Reconfigure the DeepSeek client."""
        try:
            if provider and provider.lower() != AIProvider.DEEPSEEK.value:
                raise ValueError("当前版本仅支持 DeepSeek")

            if api_key:
                os.environ["DEEPSEEK_API_KEY"] = api_key
                self.api_key = api_key
            else:
                self.api_key = self._get_api_key()

            if base_url:
                os.environ["DEEPSEEK_BASE_URL"] = base_url
                self.base_url = base_url
            else:
                self.base_url = self._get_base_url()

            self.provider = AIProvider.DEEPSEEK
            self.model = DEEPSEEK_MODEL

            if not self.api_key:
                raise ValueError("缺少DeepSeek API密钥")

            self.client = self._init_client()
            self.async_client = self._init_async_client()

            if api_key:
                self._save_config(self.provider.value, api_key, self.base_url, self.model)

            print(f"✅ DeepSeek服务已重新配置: {self.get_provider_info()}")
            return True
        except Exception as e:
            print(f"❌ DeepSeek服务重新配置失败: {e}")
            return False

    def _load_saved_configs(self) -> Dict[str, Dict[str, str]]:
        """Load saved DeepSeek config."""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, "r", encoding="utf-8") as f:
                    configs = json.load(f)
                deepseek_config = configs.get(AIProvider.DEEPSEEK.value)
                return {AIProvider.DEEPSEEK.value: deepseek_config} if deepseek_config else {}
        except Exception as e:
            print(f"⚠️ 加载配置文件失败: {e}")
        return {}

    def _save_config(self, provider: str, api_key: str, base_url: str, model: str):
        """Save DeepSeek config."""
        try:
            configs = {
                AIProvider.DEEPSEEK.value: {
                    "api_key": api_key,
                    "base_url": base_url,
                    "model": DEEPSEEK_MODEL,
                    "configured_at": json.dumps({"timestamp": "now"}),
                }
            }

            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(configs, f, ensure_ascii=False, indent=2)

            print("✅ 已保存 DeepSeek 配置")
        except Exception as e:
            print(f"❌ 保存配置失败: {e}")

    def get_all_configured_providers(self) -> Dict[str, Dict[str, Any]]:
        """Return the saved DeepSeek provider only."""
        configs = self._load_saved_configs()
        config = configs.get(AIProvider.DEEPSEEK.value)
        if not config or not config.get("api_key"):
            return {}

        return {
            AIProvider.DEEPSEEK.value: {
                "provider": AIProvider.DEEPSEEK.value,
                "model": DEEPSEEK_MODEL,
                "base_url": config.get("base_url", DEEPSEEK_BASE_URL),
                "api_key_configured": True,
                "api_key_preview": "***已配置***",
            }
        }

    def switch_to_provider(self, provider: str) -> bool:
        """Keep compatibility with older callers; only DeepSeek is accepted."""
        if provider.lower() != AIProvider.DEEPSEEK.value:
            print(f"❌ 不支持的提供商: {provider}")
            return False

        config = self._load_saved_configs().get(AIProvider.DEEPSEEK.value)
        if not config:
            print("❌ DeepSeek 未配置")
            return False

        return self.reconfigure(
            provider=AIProvider.DEEPSEEK.value,
            api_key=config["api_key"],
            base_url=config.get("base_url", DEEPSEEK_BASE_URL),
            model=DEEPSEEK_MODEL,
        )

    def get_provider_info(self) -> Dict[str, Any]:
        """Return current DeepSeek config metadata."""
        return {
            "provider": AIProvider.DEEPSEEK.value,
            "model": DEEPSEEK_MODEL,
            "base_url": self.base_url,
            "api_key_configured": bool(self.api_key),
            "api_key_preview": "***已配置***" if self.api_key else "未配置",
        }

    @staticmethod
    def scan_environment_keys() -> Dict[str, Any]:
        """Scan DeepSeek API key environment variables."""
        scan_result = {
            "deepseek": {
                "found": False,
                "keys": [],
                "valid_key": None,
            }
        }

        for key_name in ["DEEPSEEK_API_KEY", "DEEPSEEK_KEY"]:
            api_key = os.getenv(key_name, "").strip()
            if not api_key:
                continue

            is_placeholder = api_key == "your_deepseek_api_key_here"
            scan_result["deepseek"]["keys"].append({
                "name": key_name,
                "preview": f"{api_key[:8]}..." if len(api_key) > 8 else "短密钥",
                "is_placeholder": is_placeholder,
            })

            if not is_placeholder:
                scan_result["deepseek"]["found"] = True
                if not scan_result["deepseek"]["valid_key"]:
                    scan_result["deepseek"]["valid_key"] = key_name

        return {
            "scan_result": scan_result,
            "summary": {
                "total_providers_configured": 1 if scan_result["deepseek"]["found"] else 0,
                "recommended_provider": "deepseek",
                "needs_configuration": not scan_result["deepseek"]["found"],
            },
        }

    async def call_ai_api(self, prompt: str, json_mode: bool = True) -> str:
        """Call DeepSeek Chat Completions API."""
        try:
            api_params: Dict[str, Any] = {
                "model": DEEPSEEK_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的英语教学助手，专门帮助中国学生学习英语。请严格按照要求返回JSON格式的结果。",
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                "reasoning_effort": "high",
                "extra_body": {"thinking": {"type": "enabled"}},
            }
            if json_mode:
                api_params["response_format"] = {"type": "json_object"}

            response = await self.async_client.chat.completions.create(**api_params)

            reasoning = getattr(response.choices[0].message, "reasoning_content", None)
            if reasoning:
                print(f"💭 推理过程: {reasoning}")

            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"DeepSeek API请求失败: {str(e)}")

    async def call_ai_api_stream(self, prompt: str, json_mode: bool = True):
        """Stream DeepSeek Chat Completions API."""
        try:
            stream_params: Dict[str, Any] = {
                "model": DEEPSEEK_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的英语教学助手，专门帮助中国学生学习英语。请严格按照要求返回JSON格式的结果。",
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                "stream": True,
                "reasoning_effort": "high",
                "extra_body": {"thinking": {"type": "enabled"}},
            }
            if json_mode:
                stream_params["response_format"] = {"type": "json_object"}

            response = await self.async_client.chat.completions.create(**stream_params)

            async for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            raise Exception(f"DeepSeek API流式请求失败: {str(e)}")

    @staticmethod
    def extract_json_from_response(response: str) -> Dict[str, Any]:
        """Extract JSON object from an AI response."""
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            json_match = re.search(r"\{[\s\S]*\}", response)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass

            raise Exception(f"无法解析AI响应为JSON格式: {response}")


try:
    ai_service = AIService()
    print(f"✅ DeepSeek服务初始化成功: {ai_service.get_provider_info()}")
except Exception as e:
    print(f"❌ DeepSeek服务初始化失败: {e}")
    ai_service = None
