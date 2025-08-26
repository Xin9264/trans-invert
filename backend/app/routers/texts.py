"""文本处理路由"""
import uuid
import json
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.schemas.text import (
    TextUploadRequest, 
    TextAnalysisResponse, 
    PracticeSubmitRequest,
    PracticeEvaluationResponse,
    APIResponse
)
from app.services.deepseek_service import deepseek_service

router = APIRouter(prefix="/api/texts", tags=["texts"])

# 内存存储（简化版，生产环境应使用数据库）
texts_storage: Dict[str, Dict[str, Any]] = {}
analyses_storage: Dict[str, Dict[str, Any]] = {}

def count_words(text: str) -> int:
    """计算单词数量"""
    return len(text.strip().split())

@router.post("/upload", response_model=APIResponse)
async def upload_text(request: TextUploadRequest, background_tasks: BackgroundTasks):
    """上传英文文本并触发AI分析"""
    try:
        # 生成唯一ID
        text_id = str(uuid.uuid4())
        
        # 计算单词数
        word_count = count_words(request.content)
        
        # 存储文本
        texts_storage[text_id] = {
            "id": text_id,
            "title": request.title or f"文本_{text_id[:8]}",
            "content": request.content,
            "word_count": word_count,
            "created_at": "now"  # 简化时间处理
        }
        
        # 后台异步分析文本
        background_tasks.add_task(analyze_text_background, text_id, request.content)
        
        return APIResponse(
            success=True,
            data={"text_id": text_id, "word_count": word_count},
            message="文本上传成功，AI正在分析中..."
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文本上传失败: {str(e)}")

async def analyze_text_background(text_id: str, content: str):
    """后台分析文本"""
    try:
        analysis_result = await deepseek_service.analyze_text(content)
        
        # 存储分析结果
        analyses_storage[text_id] = {
            "text_id": text_id,
            "translation": analysis_result["translation"],
            "grammar_points": analysis_result["grammar_points"],
            "difficulty": analysis_result["difficulty"],
            "key_points": analysis_result["key_points"],
            "word_count": count_words(content)
        }
        
        print(f"✅ 文本 {text_id} 分析完成")
        
    except Exception as e:
        print(f"❌ 文本 {text_id} 分析失败: {str(e)}")
        # 存储失败信息
        analyses_storage[text_id] = {
            "text_id": text_id,
            "translation": "分析失败，请重试",
            "grammar_points": ["分析失败"],
            "difficulty": 3,
            "key_points": ["分析失败"],
            "word_count": count_words(content)
        }

@router.get("/{text_id}/analysis", response_model=APIResponse)
async def get_text_analysis(text_id: str):
    """获取文本分析结果"""
    try:
        if text_id not in texts_storage:
            raise HTTPException(status_code=404, detail="文本不存在")
        
        if text_id not in analyses_storage:
            return APIResponse(
                success=False,
                message="文本分析正在进行中，请稍后再试"
            )
        
        analysis = analyses_storage[text_id]
        
        return APIResponse(
            success=True,
            data=TextAnalysisResponse(**analysis),
            message="获取分析结果成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取分析结果失败: {str(e)}")

@router.post("/practice/submit", response_model=APIResponse)
async def submit_practice(request: PracticeSubmitRequest):
    """提交练习答案并获得评估"""
    try:
        if request.text_id not in texts_storage:
            raise HTTPException(status_code=404, detail="文本不存在")
        
        if request.text_id not in analyses_storage:
            raise HTTPException(status_code=400, detail="文本分析尚未完成，请稍后重试")
        
        # 获取原文和翻译
        original_text = texts_storage[request.text_id]["content"]
        analysis = analyses_storage[request.text_id]
        translation = analysis["translation"]
        
        # 调用AI评估
        evaluation = await deepseek_service.evaluate_answer(
            original_text=original_text,
            translation=translation,
            user_input=request.user_input
        )
        
        response_data = PracticeEvaluationResponse(
            score=evaluation["score"],
            corrections=evaluation["corrections"],
            overall_feedback=evaluation["overall_feedback"],
            is_acceptable=evaluation["is_acceptable"]
        )
        
        return APIResponse(
            success=True,
            data=response_data,
            message="评估完成"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"练习评估失败: {str(e)}")

@router.get("/{text_id}", response_model=APIResponse)
async def get_text(text_id: str, include_content: bool = False):
    """获取文本信息"""
    try:
        if text_id not in texts_storage:
            raise HTTPException(status_code=404, detail="文本不存在")
        
        text_info = texts_storage[text_id]
        
        data = {
            "text_id": text_info["id"],
            "title": text_info["title"],
            "word_count": text_info["word_count"],
        }
        
        # 只有明确要求时才返回原文内容
        if include_content:
            data["content"] = text_info["content"]
        
        return APIResponse(
            success=True,
            data=data,
            message="获取文本信息成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文本失败: {str(e)}")

@router.get("/", response_model=APIResponse)
async def list_texts():
    """获取所有文本列表"""
    try:
        texts_list = []
        for text_id, text_info in texts_storage.items():
            # 检查是否有分析结果
            has_analysis = text_id in analyses_storage
            
            texts_list.append({
                "text_id": text_info["id"],
                "title": text_info["title"],
                "word_count": text_info["word_count"],
                "has_analysis": has_analysis,
                "difficulty": analyses_storage.get(text_id, {}).get("difficulty", 0) if has_analysis else 0
            })
        
        return APIResponse(
            success=True,
            data=texts_list,
            message=f"获取到 {len(texts_list)} 个文本"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文本列表失败: {str(e)}")

@router.post("/practice/submit-stream")
async def submit_practice_stream(request: PracticeSubmitRequest):
    """流式提交练习答案并获得评估"""
    try:
        if request.text_id not in texts_storage:
            raise HTTPException(status_code=404, detail="文本不存在")
        
        if request.text_id not in analyses_storage:
            raise HTTPException(status_code=400, detail="文本分析尚未完成，请稍后重试")
        
        # 获取原文和翻译
        original_text = texts_storage[request.text_id]["content"]
        analysis = analyses_storage[request.text_id]
        translation = analysis["translation"]
        
        async def generate_stream():
            """生成流式响应"""
            try:
                async for chunk in deepseek_service.evaluate_answer_stream(
                    original_text=original_text,
                    translation=translation,
                    user_input=request.user_input
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
        raise HTTPException(status_code=500, detail=f"提交练习失败: {str(e)}")
