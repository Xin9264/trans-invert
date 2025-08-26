"""DeepSeek AI服务"""
import json
import re
from typing import Dict, Any, Optional
import httpx
from app.core.settings import settings
from app.services.template_service import template_service

class DeepSeekService:
    """DeepSeek API客户端"""
    
    def __init__(self):
        self.base_url = settings.DEEPSEEK_BASE_URL.rstrip('/')
        self.api_key = settings.DEEPSEEK_API_KEY
        self.model = settings.DEEPSEEK_MODEL
        
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY is required")
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def _call_api(self, prompt: str, temperature: float = 0.3) -> str:
        """调用DeepSeek API"""
        payload = {
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
            "temperature": temperature,
            "max_tokens": 2000
        }
        
        timeout = httpx.Timeout(30.0, connect=10.0)
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload
                )
                response.raise_for_status()
                
                result = response.json()
                return result["choices"][0]["message"]["content"]
                
        except httpx.RequestError as e:
            raise Exception(f"DeepSeek API请求失败: {str(e)}")
        except httpx.HTTPStatusError as e:
            raise Exception(f"DeepSeek API错误 {e.response.status_code}: {e.response.text}")
        except (KeyError, IndexError) as e:
            raise Exception(f"DeepSeek API响应格式错误: {str(e)}")
    
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
            required_fields = ["translation", "grammar_points", "difficulty", "key_points"]
            for field in required_fields:
                if field not in result:
                    raise Exception(f"AI响应缺少必要字段: {field}")
            
            # 确保数据类型正确
            result["difficulty"] = int(result["difficulty"])
            if not isinstance(result["grammar_points"], list):
                result["grammar_points"] = []
            if not isinstance(result["key_points"], list):
                result["key_points"] = []
            
            return result
            
        except Exception as e:
            # 返回默认结果
            return {
                "translation": f"文本分析失败: {str(e)}",
                "grammar_points": ["分析失败，请稍后重试"],
                "difficulty": 3,
                "key_points": ["分析失败"]
            }
    
    async def evaluate_answer_stream(
        self, 
        original_text: str, 
        translation: str, 
        user_input: str
    ):
        """流式评估用户答案"""
        try:
            # 使用模板渲染提示词
            prompt = template_service.render_evaluate_answer_prompt(
                original_text=original_text,
                translation=translation,
                user_input=user_input
            )
            
            # 准备流式请求
            payload = {
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "stream": True  # 启用流式响应
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            timeout = httpx.Timeout(60.0, connect=10.0)
            
            # 流式请求
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", f"{self.base_url}/chat/completions", 
                                       headers=headers, json=payload) as response:
                    response.raise_for_status()
                    
                    collected_content = ""
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]  # 移除 "data: " 前缀
                            if data_str.strip() == "[DONE]":
                                break
                            
                            try:
                                import json
                                data = json.loads(data_str)
                                if "choices" in data and len(data["choices"]) > 0:
                                    delta = data["choices"][0].get("delta", {})
                                    if "content" in delta:
                                        content = delta["content"]
                                        collected_content += content
                                        
                                        # 尝试解析JSON进度
                                        progress = self._calculate_json_progress(collected_content)
                                        yield {
                                            "type": "progress",
                                            "content": content,
                                            "progress": progress,
                                            "full_content": collected_content
                                        }
                            except json.JSONDecodeError:
                                continue
                    
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
                        # 返回默认结果
                        yield {
                            "type": "complete",
                            "result": {
                                "score": 70,
                                "corrections": [],
                                "overall_feedback": f"评估失败: {str(e)}，请稍后重试。",
                                "is_acceptable": True
                            },
                            "progress": 100
                        }
                        
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
            response = await self._call_api(prompt, temperature=0.2)
            
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

# 创建全局DeepSeek服务实例
deepseek_service = DeepSeekService()
