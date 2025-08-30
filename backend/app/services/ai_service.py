"""通用AI服务 - 支持多种AI提供商"""
import asyncio
import json
import os
import re
from enum import Enum
from typing import Dict, Any, Optional
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
    
    async def _call_api(self, prompt: str) -> str:
        """调用AI API"""
        try:
            # 根据提供商设置不同的参数
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
                api_params["max_completion_tokens"] = 2000
            else:
                api_params["max_tokens"] = 2000
                
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
    
    def _extract_json_from_response(self, response: str) -> Dict[str, Any]:
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
    
    async def analyze_text(self, text_content: str) -> Dict[str, Any]:
        """分析英文文本"""
        try:
            # 使用模板渲染提示词
            prompt = template_service.render_analyze_text_prompt(text_content)
            
            # 调用API
            response = await self._call_api(prompt)
            
            # 解析JSON响应
            result = self._extract_json_from_response(response)
            
            # 验证必要字段
            required_fields = ["translation", "difficult_words", "difficulty", "key_points"]
            for field in required_fields:
                if field not in result:
                    raise Exception(f"AI响应缺少必要字段: {field}")
            
            # 确保数据类型正确
            result["difficulty"] = int(result["difficulty"])
            if not isinstance(result["difficult_words"], list):
                result["difficult_words"] = []
            if not isinstance(result["key_points"], list):
                result["key_points"] = []
            
            return result
            
        except Exception as e:
            # 返回默认结果
            return {
                "translation": f"文本分析失败: {str(e)}",
                "difficult_words": [{"word": "分析失败", "meaning": "请稍后重试"}],
                "difficulty": 3,
                "key_points": ["分析失败"]
            }
    
    async def evaluate_answer_stream(
        self, 
        original_text: str, 
        translation: str, 
        user_input: str
    ):
        """流式评估用户答案，带重试机制"""
        max_retries = 2
        
        for attempt in range(max_retries + 1):
            try:
                # 发送重试状态通知
                if attempt > 0:
                    yield {
                        "type": "progress",
                        "progress": 0,
                        "content": f"正在重试 (尝试 {attempt + 1}/{max_retries + 1})..."
                    }
                    # 短暂等待
                    await asyncio.sleep(1)
                
                # 进行实际的流式评估
                success = False
                last_error = None
                
                async for result in self._do_stream_evaluation(original_text, translation, user_input, attempt + 1, max_retries + 1):
                    yield result
                    
                    # 检查是否成功完成
                    if result.get("type") == "complete":
                        success = True
                        return  # 成功完成，退出所有重试
                    elif result.get("type") == "error":
                        last_error = result.get("error", "未知错误")
                        break  # 跳出内层循环，进行重试
                
                if success:
                    return
                    
            except Exception as e:
                last_error = str(e)
                print(f"⚠️ 第 {attempt + 1} 次尝试失败: {e}")
                
                if attempt < max_retries:
                    yield {
                        "type": "progress",
                        "progress": 0,
                        "content": f"网络异常，正在重试... ({attempt + 2}/{max_retries + 1})"
                    }
                    await asyncio.sleep(2)  # 等待后重试
                    continue
        
        # 所有重试都失败了，返回默认结果
        print(f"❌ 所有重试都失败，返回默认结果。最后错误: {last_error}")
        yield {
            "type": "complete",
            "result": {
                "score": 70,
                "corrections": [],
                "overall_feedback": f"评估服务暂时不可用，请稍后重试。错误: {last_error or '网络连接异常'}",
                "is_acceptable": True
            },
            "progress": 100
        }
    
    async def _do_stream_evaluation(
        self, 
        original_text: str, 
        translation: str, 
        user_input: str,
        current_attempt: int,
        max_attempts: int
    ):
        """执行单次流式评估"""
        try:
            # 使用模板渲染提示词
            prompt = template_service.render_evaluate_answer_prompt(
                original_text=original_text,
                translation=translation,
                user_input=user_input
            )
            
            yield {
                "type": "progress",
                "progress": 10,
                "content": f"开始AI评估... (尝试 {current_attempt}/{max_attempts})"
            }
            
            # 流式评估
            stream_params = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True
            }
            
            # OpenAI 使用 max_completion_tokens，其他提供商使用 max_tokens
            if self.provider == AIProvider.OPENAI:
                stream_params["max_completion_tokens"] = 2000
            else:
                stream_params["max_tokens"] = 2000
                
            response = await self.async_client.chat.completions.create(**stream_params)
            
            collected_content = ""
            chunk_count = 0
            
            async for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    collected_content += content
                    chunk_count += 1
                    
                    # 计算进度
                    progress = self._calculate_json_progress(collected_content)
                    yield {
                        "type": "progress",
                        "content": content,
                        "progress": min(90, progress),
                        "full_content": collected_content
                    }
            
            # 验证响应内容
            if len(collected_content.strip()) < 10:
                raise Exception("AI响应内容为空或过短")
            
            if chunk_count == 0:
                raise Exception("没有收到有效的流式数据")
            
            # 处理完整响应
            try:
                result = self._extract_json_from_response(collected_content)
                
                # 验证和清理数据
                required_fields = ["score", "corrections", "overall_feedback", "is_acceptable"]
                for field in required_fields:
                    if field not in result:
                        raise Exception(f"AI响应缺少必要字段: {field}")
                
                result["score"] = int(result["score"])
                result["score"] = max(0, min(100, result["score"]))
                
                if not isinstance(result["corrections"], list):
                    result["corrections"] = []
                
                result["is_acceptable"] = bool(result["is_acceptable"])
                
                yield {
                    "type": "complete",
                    "result": result,
                    "progress": 100
                }
                
            except Exception as e:
                # 解析失败，抛出异常让重试机制处理
                raise Exception(f"解析AI响应失败: {str(e)}")
                
        except Exception as e:
            yield {
                "type": "error",
                "error": str(e),
                "progress": 0
            }

    def _calculate_json_progress(self, content: str) -> int:
        """根据JSON字段的出现情况计算进度"""
        progress = 0
        
        # 定义关键字段及其权重
        key_fields = {
            '"score"': 25,
            '"corrections"': 25, 
            '"overall_feedback"': 25,
            '"is_acceptable"': 25
        }
        
        for field, weight in key_fields.items():
            if field in content:
                progress += weight
        
        # 如果包含完整的JSON结构，给予额外分数
        if content.count('{') > 0 and content.count('}') > 0:
            if content.count('{') == content.count('}'):
                progress = min(100, progress + 10)
        
        return min(100, progress)

    async def evaluate_answer(
        self, 
        original_text: str, 
        translation: str, 
        user_input: str
    ) -> Dict[str, Any]:
        """评估用户答案"""
        try:
            # 使用模板渲染提示词
            prompt = template_service.render_evaluate_answer_prompt(
                original_text=original_text,
                translation=translation,
                user_input=user_input
            )
            
            # 调用API
            response = await self._call_api(prompt)
            
            # 解析JSON响应
            result = self._extract_json_from_response(response)
            
            # 验证必要字段
            required_fields = ["score", "corrections", "overall_feedback", "is_acceptable"]
            for field in required_fields:
                if field not in result:
                    raise Exception(f"AI响应缺少必要字段: {field}")
            
            # 确保数据类型正确
            result["score"] = int(result["score"])
            result["score"] = max(0, min(100, result["score"]))  # 限制在0-100范围内
            
            if not isinstance(result["corrections"], list):
                result["corrections"] = []
            
            result["is_acceptable"] = bool(result["is_acceptable"])
            
            return result
            
        except Exception as e:
            # 返回默认评估结果
            return {
                "score": 70,
                "corrections": [],
                "overall_feedback": f"评估失败: {str(e)}，请稍后重试。",
                "is_acceptable": True
            }

    async def generate_essay(
        self, 
        topic: str, 
        exam_type: str, 
        requirements: str = None
    ) -> Dict[str, Any]:
        """生成作文范文"""
        try:
            # 使用模板渲染提示词
            prompt = template_service.render_generate_essay_prompt(
                topic=topic,
                exam_type=exam_type,
                requirements=requirements
            )
            
            # 调用API
            response = await self._call_api(prompt)
            
            # 解析JSON响应
            result = self._extract_json_from_response(response)
            
            # 验证必要字段
            required_fields = ["english_essay", "chinese_translation"]
            for field in required_fields:
                if field not in result:
                    raise Exception(f"AI响应缺少必要字段: {field}")
            
            return result
            
        except Exception as e:
            # 返回默认结果
            return {
                "english_essay": f"作文生成失败: {str(e)}",
                "chinese_translation": f"作文生成失败: {str(e)}"
            }

    async def generate_essay_stream(
        self, 
        topic: str, 
        exam_type: str, 
        requirements: str = None
    ):
        """流式生成作文范文"""
        try:
            # 使用模板渲染提示词
            prompt = template_service.render_generate_essay_prompt(
                topic=topic,
                exam_type=exam_type,
                requirements=requirements
            )
            
            yield {
                "type": "progress",
                "progress": 10,
                "content": "开始生成作文范文..."
            }
            
            # 流式生成
            stream_params = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True
            }
            
            # OpenAI 使用 max_completion_tokens，其他提供商使用 max_tokens
            if self.provider == AIProvider.OPENAI:
                stream_params["max_completion_tokens"] = 3000
            else:
                stream_params["max_tokens"] = 3000
                
            response = await self.async_client.chat.completions.create(**stream_params)
            
            collected_content = ""
            chunk_count = 0
            
            async for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    collected_content += content
                    chunk_count += 1
                    
                    # 计算进度
                    progress = self._calculate_essay_progress(collected_content)
                    yield {
                        "type": "progress",
                        "content": content,
                        "progress": min(90, progress),
                        "full_content": collected_content
                    }
            
            # 验证响应内容
            if len(collected_content.strip()) < 10:
                raise Exception("AI响应内容为空或过短")
            
            # 处理完整响应
            try:
                result = self._extract_json_from_response(collected_content)
                
                # 验证必要字段
                required_fields = ["english_essay", "chinese_translation"]
                for field in required_fields:
                    if field not in result:
                        raise Exception(f"AI响应缺少必要字段: {field}")
                
                yield {
                    "type": "complete",
                    "result": result,
                    "progress": 100
                }
                
            except Exception as e:
                raise Exception(f"解析AI响应失败: {str(e)}")
                
        except Exception as e:
            yield {
                "type": "error",
                "error": str(e),
                "progress": 0
            }

    def _calculate_essay_progress(self, content: str) -> int:
        """根据作文生成的进度计算百分比"""
        progress = 0
        
        # 定义关键字段及其权重
        key_fields = {
            '"english_essay"': 50,
            '"chinese_translation"': 50
        }
        
        for field, weight in key_fields.items():
            if field in content:
                progress += weight
        
        # 根据内容长度增加进度
        if len(content) > 100:
            progress += 10
        if len(content) > 500:
            progress += 10
        if len(content) > 1000:
            progress += 10
        
        return min(100, progress)

    async def evaluate_essay_stream(
        self, 
        topic: str,
        exam_type: str,
        sample_essay: str,
        user_essay: str
    ):
        """流式评估用户作文"""
        try:
            # 使用模板渲染提示词
            prompt = template_service.render_evaluate_essay_prompt(
                topic=topic,
                exam_type=exam_type,
                sample_essay=sample_essay,
                user_essay=user_essay
            )
            
            yield {
                "type": "progress",
                "progress": 10,
                "content": "开始AI作文评估..."
            }
            
            # 流式评估
            stream_params = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True
            }
            
            # OpenAI 使用 max_completion_tokens，其他提供商使用 max_tokens
            if self.provider == AIProvider.OPENAI:
                stream_params["max_completion_tokens"] = 2500
            else:
                stream_params["max_tokens"] = 2500
                
            response = await self.async_client.chat.completions.create(**stream_params)
            
            collected_content = ""
            chunk_count = 0
            
            async for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    collected_content += content
                    chunk_count += 1
                    
                    # 计算进度
                    progress = self._calculate_essay_evaluation_progress(collected_content)
                    yield {
                        "type": "progress",
                        "content": content,
                        "progress": min(90, progress),
                        "full_content": collected_content
                    }
            
            # 验证响应内容
            if len(collected_content.strip()) < 10:
                raise Exception("AI响应内容为空或过短")
            
            # 处理完整响应
            try:
                result = self._extract_json_from_response(collected_content)
                
                # 验证必要字段
                required_fields = ["overall_score", "detailed_scores", "strengths", "improvements", "specific_corrections", "overall_feedback"]
                for field in required_fields:
                    if field not in result:
                        raise Exception(f"AI响应缺少必要字段: {field}")
                
                # 根据考试类型验证和调整分数
                result = self._validate_essay_scores(result, exam_type)
                
                if not isinstance(result["strengths"], list):
                    result["strengths"] = []
                if not isinstance(result["improvements"], list):
                    result["improvements"] = []
                if not isinstance(result["specific_corrections"], list):
                    result["specific_corrections"] = []
                
                yield {
                    "type": "complete",
                    "result": result,
                    "progress": 100
                }
                
            except Exception as e:
                raise Exception(f"解析AI响应失败: {str(e)}")
                
        except Exception as e:
            yield {
                "type": "error",
                "error": str(e),
                "progress": 0
            }

    def _calculate_essay_evaluation_progress(self, content: str) -> int:
        """根据作文评估的进度计算百分比"""
        progress = 0
        
        # 定义关键字段及其权重
        key_fields = {
            '"overall_score"': 20,
            '"detailed_scores"': 20,
            '"strengths"': 15,
            '"improvements"': 15,
            '"specific_corrections"': 15,
            '"overall_feedback"': 15
        }
        
        for field, weight in key_fields.items():
            if field in content:
                progress += weight
        
        return min(100, progress)

    def _validate_essay_scores(self, result: Dict[str, Any], exam_type: str) -> Dict[str, Any]:
        """根据考试类型验证和调整分数"""
        # 考试类型对应的分数范围
        score_ranges = {
            'ielts': {'min': 0, 'max': 9, 'step': 0.5},  # 雅思：0-9分，0.5分制
            'toefl': {'min': 0, 'max': 30, 'step': 1},   # 托福：0-30分，整数
            'cet4': {'min': 0, 'max': 100, 'step': 1},   # 四级：0-100分，整数
            'cet6': {'min': 0, 'max': 100, 'step': 1},   # 六级：0-100分，整数
            'gre': {'min': 0, 'max': 6, 'step': 0.5}     # GRE：0-6分，0.5分制
        }
        
        # 获取当前考试类型的分数范围，默认使用100分制
        score_config = score_ranges.get(exam_type, {'min': 0, 'max': 100, 'step': 1})
        min_score = score_config['min']
        max_score = score_config['max']
        step = score_config['step']
        
        # 验证总分
        overall_score = float(result.get("overall_score", 0))
        overall_score = max(min_score, min(max_score, overall_score))
        
        # 根据step调整分数（四舍五入到最近的有效分数）
        if step == 0.5:
            overall_score = round(overall_score * 2) / 2
        else:
            overall_score = round(overall_score)
        
        result["overall_score"] = overall_score
        
        # 验证分项得分
        if "detailed_scores" in result and isinstance(result["detailed_scores"], dict):
            for key, score in result["detailed_scores"].items():
                score = float(score)
                score = max(min_score, min(max_score, score))
                
                # 根据step调整分数
                if step == 0.5:
                    score = round(score * 2) / 2
                else:
                    score = round(score)
                
                result["detailed_scores"][key] = score
        
        return result

# 创建全局AI服务实例
try:
    ai_service = AIService()
    print(f"✅ AI服务初始化成功: {ai_service.get_provider_info()}")
except Exception as e:
    print(f"❌ AI服务初始化失败: {e}")
    ai_service = None