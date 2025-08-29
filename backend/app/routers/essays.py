"""作文练习路由"""
import uuid
import json
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.schemas.essay import (
    EssayGenerationRequest,
    EssayGenerationResponse,
    EssaySession,
    EssaySubmitRequest,
    EssayEvaluationResponse,
    EssayHistoryRecord
)
from app.schemas.text import APIResponse
from app.services.ai_service import ai_service, AIService
from app.services.data_persistence import data_persistence

# 导入texts.py中的全局变量和函数
from app.routers.texts import practice_history, save_data

router = APIRouter(prefix="/api/essays", tags=["essays"])

# 内存存储（简化版，生产环境应使用数据库）
essay_sessions: Dict[str, EssaySession] = {}
essay_history: List[EssayHistoryRecord] = []

def get_user_ai_config(request: Request) -> Dict[str, str]:
    """从请求头中获取用户的AI配置"""
    headers = request.headers
    
    provider = headers.get('x-ai-provider')
    api_key = headers.get('x-ai-key')
    base_url = headers.get('x-ai-base-url')
    model = headers.get('x-ai-model')
    
    if not provider or not api_key:
        raise HTTPException(
            status_code=400, 
            detail="请先在浏览器中配置AI服务（提供商和API密钥）"
        )
        
    return {
        'provider': provider,
        'api_key': api_key,
        'base_url': base_url,
        'model': model
    }

def create_user_ai_service(user_config: Dict[str, str]) -> AIService:
    """为用户创建临时的AI服务实例"""
    from app.services.ai_service import AIProvider
    
    # 创建一个新的AI服务实例，使用用户的配置
    temp_service = AIService.__new__(AIService)  # 不调用__init__
    temp_service.config_file = None  # 不使用配置文件
    
    # 设置提供商
    provider_str = user_config['provider'].lower()
    if provider_str == "volcano":
        temp_service.provider = AIProvider.VOLCANO
    elif provider_str == "openai":
        temp_service.provider = AIProvider.OPENAI
    else:
        temp_service.provider = AIProvider.DEEPSEEK
    
    # 设置配置
    temp_service.api_key = user_config['api_key']
    
    # 设置默认URL和模型
    if user_config.get('base_url'):
        temp_service.base_url = user_config['base_url']
    else:
        if temp_service.provider == AIProvider.VOLCANO:
            temp_service.base_url = "https://ark.cn-beijing.volces.com/api/v3"
        elif temp_service.provider == AIProvider.OPENAI:
            temp_service.base_url = "https://api.openai.com/v1"
        else:
            temp_service.base_url = "https://api.deepseek.com"
    
    if user_config.get('model'):
        temp_service.model = user_config['model']
    else:
        if temp_service.provider == AIProvider.VOLCANO:
            temp_service.model = "doubao-1-5-pro-32k-250115"
        elif temp_service.provider == AIProvider.OPENAI:
            temp_service.model = "gpt-4.1"
        else:
            temp_service.model = "deepseek-chat"
    
    # 初始化客户端
    temp_service.client = temp_service._init_client()
    temp_service.async_client = temp_service._init_async_client()
    
    return temp_service

def count_words(text: str) -> int:
    """计算单词数量"""
    return len(text.strip().split())

@router.post("/generate")
async def generate_essay_stream(request: EssayGenerationRequest, http_request: Request):
    """流式生成作文范文"""
    try:
        # 获取用户的AI配置
        user_config = get_user_ai_config(http_request)
        
        async def generate_stream():
            """生成流式响应"""
            try:
                # 使用用户的AI配置创建临时服务
                user_ai_service = create_user_ai_service(user_config)
                
                async for chunk in user_ai_service.generate_essay_stream(
                    topic=request.topic,
                    exam_type=request.exam_type,
                    requirements=request.requirements
                ):
                    # 将每个chunk转换为SSE格式
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                
                # 发送结束标记
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                # 发送错误信息
                error_chunk = {
                    "type": "error",
                    "error": str(e),
                    "progress": 0
                }
                yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成作文失败: {str(e)}")

@router.post("/sessions")
async def create_essay_session(request: EssayGenerationRequest, http_request: Request):
    """流式创建作文练习会话"""
    try:
        # 获取用户的AI配置
        user_config = get_user_ai_config(http_request)
        
        async def generate_stream():
            """生成流式响应"""
            try:
                # 使用用户的AI配置创建临时服务
                user_ai_service = create_user_ai_service(user_config)
                
                # 初始化变量
                session_id = str(uuid.uuid4())
                english_essay = ""
                chinese_translation = ""
                
                # 流式生成作文
                async for chunk in user_ai_service.generate_essay_stream(
                    topic=request.topic,
                    exam_type=request.exam_type,
                    requirements=request.requirements
                ):
                    # 处理不同类型的响应
                    chunk_type = chunk.get("type")
                    
                    if chunk_type == "progress":
                        # 发送进度更新，包含实时内容
                        progress_chunk = {
                            "type": "progress",
                            "progress": chunk.get("progress", 0),
                            "content": chunk.get("content", "正在生成...")
                        }
                        yield f"data: {json.dumps(progress_chunk, ensure_ascii=False)}\n\n"
                        
                        # 如果有完整内容，同时发送内容更新
                        if "full_content" in chunk:
                            content_chunk = {
                                "type": "content",
                                "content": chunk["full_content"],
                                "progress": chunk.get("progress", 0)
                            }
                            yield f"data: {json.dumps(content_chunk, ensure_ascii=False)}\n\n"
                    
                    elif chunk_type == "complete":
                        # 处理完成响应
                        result = chunk.get("result", {})
                        english_essay = result.get("english_essay", "")
                        chinese_translation = result.get("chinese_translation", "")
                        
                        # 创建完整的会话对象
                        session = EssaySession(
                            id=session_id,
                            topic=request.topic,
                            exam_type=request.exam_type,
                            sample_essay=english_essay,
                            chinese_translation=chinese_translation,
                            created_at=datetime.now().isoformat(),
                            status="active"
                        )
                        
                        # 保存会话
                        essay_sessions[session_id] = session
                        
                        # 将生成的范文保存为练习历史记录（作为学习材料）
                        try:
                            from app.schemas.text import PracticeHistoryRecord
                            
                            # 创建一个特殊的练习历史记录，标记为"作文"类型
                            essay_study_record = PracticeHistoryRecord(
                                id=str(uuid.uuid4()),
                                timestamp=datetime.now().isoformat(),
                                text_title=f"作文范文：{request.topic[:50]}{'...' if len(request.topic) > 50 else ''}",
                                text_content=english_essay,
                                chinese_translation=chinese_translation,
                                user_input="",  # 范文阶段没有用户输入
                                ai_evaluation={
                                    "score": 100,  # 范文默认满分
                                    "corrections": [],
                                    "overall_feedback": "这是AI生成的作文范文，供学习参考。",
                                    "is_acceptable": True
                                },
                                score=100,
                                practice_type="essay"  # 添加练习类型标识
                            )
                            
                            # 添加到练习历史中
                            practice_history.append(essay_study_record)
                            practice_history.sort(key=lambda x: x.timestamp, reverse=True)
                            
                            # 保存数据
                            save_data()
                            
                            print(f"✅ 作文范文已保存为学习材料: {essay_study_record.id}")
                        except Exception as e:
                            print(f"⚠️ 保存作文范文失败: {e}")
                        
                        # 发送完成信息
                        complete_chunk = {
                            "type": "complete",
                            "result": session.dict(),
                            "progress": 100
                        }
                        yield f"data: {json.dumps(complete_chunk, ensure_ascii=False)}\n\n"
                        
                        # 发送结束标记
                        yield "data: [DONE]\n\n"
                        return
                    
                    elif chunk_type == "error":
                        # 转发错误信息
                        yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                        return
                
            except Exception as e:
                # 发送错误信息
                error_chunk = {
                    "type": "error",
                    "error": str(e),
                    "progress": 0
                }
                yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建作文会话失败: {str(e)}")

@router.get("/sessions/{session_id}", response_model=APIResponse)
async def get_essay_session(session_id: str):
    """获取作文练习会话"""
    try:
        if session_id not in essay_sessions:
            raise HTTPException(status_code=404, detail="作文练习会话不存在")
        
        session = essay_sessions[session_id]
        
        return APIResponse(
            success=True,
            data=session,
            message="获取作文会话成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取作文会话失败: {str(e)}")

@router.post("/sessions/{session_id}/submit")
async def submit_essay_stream(session_id: str, request: EssaySubmitRequest, http_request: Request):
    """流式提交作文并获得评估"""
    try:
        if session_id not in essay_sessions:
            raise HTTPException(status_code=404, detail="作文练习会话不存在")
        
        # 获取用户的AI配置
        user_config = get_user_ai_config(http_request)
        
        session = essay_sessions[session_id]
        
        async def generate_stream():
            """生成流式评估响应"""
            evaluation_result = None
            try:
                # 使用用户的AI配置创建临时服务
                user_ai_service = create_user_ai_service(user_config)
                
                async for chunk in user_ai_service.evaluate_essay_stream(
                    topic=session.topic,
                    exam_type=session.exam_type,
                    sample_essay=session.sample_essay,
                    user_essay=request.user_essay
                ):
                    # 保存完整的评估结果
                    if chunk.get("type") == "complete":
                        evaluation_result = chunk.get("result")
                    
                    # 将每个chunk转换为SSE格式
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                
                # 在流式响应完成后保存历史记录
                if evaluation_result:
                    history_record = EssayHistoryRecord(
                        id=str(uuid.uuid4()),
                        session_id=session_id,
                        topic=session.topic,
                        exam_type=session.exam_type,
                        sample_essay=session.sample_essay,
                        chinese_translation=session.chinese_translation,
                        user_essay=request.user_essay,
                        evaluation=EssayEvaluationResponse(**evaluation_result),
                        timestamp=datetime.now().isoformat(),
                        overall_score=evaluation_result["overall_score"]
                    )
                    essay_history.append(history_record)
                    
                    # 按时间倒序排列（最新的在前面）
                    essay_history.sort(key=lambda x: x.timestamp, reverse=True)
                    
                    # 更新会话状态
                    session.status = "completed"
                    
                    print(f"✅ 作文评估记录已保存: {history_record.id}, 得分: {history_record.overall_score}")
                
                # 发送结束标记
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                # 发送错误信息
                error_chunk = {
                    "type": "error",
                    "error": str(e),
                    "progress": 0
                }
                yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提交作文失败: {str(e)}")

@router.get("/history", response_model=APIResponse)
async def get_essay_history():
    """获取作文练习历史记录"""
    try:
        return APIResponse(
            success=True,
            data=essay_history,
            message=f"获取到 {len(essay_history)} 条作文历史记录"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取作文历史记录失败: {str(e)}")

@router.delete("/sessions/{session_id}", response_model=APIResponse)
async def delete_essay_session(session_id: str):
    """删除作文练习会话"""
    try:
        if session_id not in essay_sessions:
            raise HTTPException(status_code=404, detail="作文练习会话不存在")
        
        del essay_sessions[session_id]
        
        return APIResponse(
            success=True,
            data={"session_id": session_id},
            message="作文练习会话已删除"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除作文会话失败: {str(e)}")