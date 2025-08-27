"""文本处理路由"""
import uuid
import json
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from app.schemas.text import (
    TextUploadRequest, 
    TextAnalysisResponse, 
    PracticeSubmitRequest,
    PracticeEvaluationResponse,
    PracticeHistoryRecord,
    PracticeHistoryExport,
    PracticeHistoryImportRequest,
    APIResponse
)
from app.services.deepseek_service import deepseek_service

router = APIRouter(prefix="/api/texts", tags=["texts"])

# 内存存储（简化版，生产环境应使用数据库）
texts_storage: Dict[str, Dict[str, Any]] = {}
analyses_storage: Dict[str, Dict[str, Any]] = {}
practice_history: List[PracticeHistoryRecord] = []

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

async def re_analyze_imported_text(text_id: str, content: str, existing_translation: str):
    """重新分析从历史记录导入的文本"""
    try:
        analysis_result = await deepseek_service.analyze_text(content)
        
        # 更新分析结果，但保留已有的翻译（来自历史记录）
        analyses_storage[text_id] = {
            "text_id": text_id,
            "translation": existing_translation,  # 保留历史记录中的翻译
            "grammar_points": analysis_result["grammar_points"],
            "difficulty": analysis_result["difficulty"],
            "key_points": analysis_result["key_points"],
            "word_count": count_words(content)
        }
        
        print(f"✅ 导入文本 {text_id} 重新分析完成")
        
    except Exception as e:
        print(f"❌ 导入文本 {text_id} 重新分析失败: {str(e)}")
        # 保持原有的简化分析结果

@router.get("/{text_id}/analysis", response_model=APIResponse)
async def get_text_analysis(text_id: str):
    """获取文本分析结果"""
    try:
        if text_id not in texts_storage:
            raise HTTPException(status_code=404, detail="文本不存在")
        
        if text_id not in analyses_storage:
            return APIResponse(
                success=False,
                message="文本分析正在进行中，稍安勿躁"
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
        
        # 保存练习历史
        history_record = PracticeHistoryRecord(
            id=str(uuid.uuid4()),
            timestamp=datetime.now().isoformat(),
            text_title=texts_storage[request.text_id]["title"],
            text_content=original_text,
            chinese_translation=translation,
            user_input=request.user_input,
            ai_evaluation={
                "score": evaluation["score"],
                "corrections": evaluation["corrections"],
                "overall_feedback": evaluation["overall_feedback"],
                "is_acceptable": evaluation["is_acceptable"]
            },
            score=evaluation["score"]
        )
        practice_history.append(history_record)
        
        # 按时间倒序排列（最新的在前面）
        practice_history.sort(key=lambda x: x.timestamp, reverse=True)
        
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
            evaluation_result = None
            try:
                async for chunk in deepseek_service.evaluate_answer_stream(
                    original_text=original_text,
                    translation=translation,
                    user_input=request.user_input
                ):
                    # 保存完整的评估结果
                    if chunk.get("type") == "complete":
                        evaluation_result = chunk.get("result")
                    
                    # 将每个chunk转换为SSE格式
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                
                # 在流式响应完成后保存历史记录
                if evaluation_result:
                    history_record = PracticeHistoryRecord(
                        id=str(uuid.uuid4()),
                        timestamp=datetime.now().isoformat(),
                        text_title=texts_storage[request.text_id]["title"],
                        text_content=original_text,
                        chinese_translation=translation,
                        user_input=request.user_input,
                        ai_evaluation=evaluation_result,
                        score=evaluation_result["score"]
                    )
                    practice_history.append(history_record)
                    
                    # 按时间倒序排列（最新的在前面）
                    practice_history.sort(key=lambda x: x.timestamp, reverse=True)
                    
                    print(f"✅ 流式练习记录已保存: {history_record.id}, 得分: {history_record.score}")
                
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

@router.get("/practice/history", response_model=APIResponse)
async def get_practice_history():
    """获取练习历史记录"""
    try:
        return APIResponse(
            success=True,
            data=practice_history,
            message=f"获取到 {len(practice_history)} 条历史记录"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取历史记录失败: {str(e)}")

@router.get("/practice/history/export")
async def export_practice_history():
    """导出练习历史为JSON文件"""
    try:
        export_data = PracticeHistoryExport(
            export_time=datetime.now().isoformat(),
            total_records=len(practice_history),
            records=practice_history
        )
        
        # 生成JSON内容
        json_content = export_data.model_dump_json(indent=2)
        
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"practice_history_{timestamp}.json"
        
        return Response(
            content=json_content,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/json; charset=utf-8"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出历史记录失败: {str(e)}")

@router.post("/practice/history/import", response_model=APIResponse)
async def import_practice_history(request: PracticeHistoryImportRequest, background_tasks: BackgroundTasks):
    """导入练习历史并同步添加对应的练习材料"""
    try:
        global practice_history, texts_storage, analyses_storage
        
        imported_records = request.data.records
        
        # 验证导入数据
        if not imported_records:
            raise HTTPException(status_code=400, detail="导入数据为空")
        
        # 合并历史记录，避免重复
        existing_ids = {record.id for record in practice_history}
        new_records = [record for record in imported_records if record.id not in existing_ids]
        
        # 添加新记录
        practice_history.extend(new_records)
        
        # 按时间倒序排列
        practice_history.sort(key=lambda x: x.timestamp, reverse=True)
        
        # 从历史记录中提取练习材料并添加到材料库
        new_materials_count = 0
        existing_materials_count = 0
        
        for record in new_records:
            # 检查是否已存在相同内容的材料（通过内容匹配）
            material_exists = False
            for existing_text_id, existing_text in texts_storage.items():
                if existing_text["content"].strip() == record.text_content.strip():
                    material_exists = True
                    break
            
            if not material_exists:
                # 生成新的文本ID
                text_id = str(uuid.uuid4())
                
                # 添加到练习材料库
                texts_storage[text_id] = {
                    "id": text_id,
                    "title": record.text_title,
                    "content": record.text_content,
                    "word_count": count_words(record.text_content),
                    "created_at": record.timestamp  # 使用历史记录的时间
                }
                
                # 添加对应的分析结果（先使用历史记录中的信息）
                analyses_storage[text_id] = {
                    "text_id": text_id,
                    "translation": record.chinese_translation,
                    "grammar_points": ["从历史记录导入", "可进行练习"],  # 简化的语法要点
                    "difficulty": 3,  # 默认难度
                    "key_points": ["从历史记录导入"],  # 简化的关键词
                    "word_count": count_words(record.text_content)
                }
                
                # 后台重新分析文本以获得更完整的分析结果
                background_tasks.add_task(
                    re_analyze_imported_text, 
                    text_id, 
                    record.text_content, 
                    record.chinese_translation
                )
                
                new_materials_count += 1
                print(f"✅ 从历史记录导入新练习材料: {record.text_title} (ID: {text_id})")
            else:
                existing_materials_count += 1
        
        return APIResponse(
            success=True,
            data={
                "imported_count": len(new_records),
                "total_count": len(practice_history),
                "duplicate_count": len(imported_records) - len(new_records),
                "new_materials_count": new_materials_count,
                "existing_materials_count": existing_materials_count
            },
            message=f"成功导入 {len(new_records)} 条历史记录，跳过 {len(imported_records) - len(new_records)} 条重复记录。新增 {new_materials_count} 个练习材料，{existing_materials_count} 个材料已存在。"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入历史记录失败: {str(e)}")

@router.get("/materials/export")
async def export_practice_materials():
    """导出所有练习材料为JSON文件"""
    try:
        materials = []
        
        for text_id, text_info in texts_storage.items():
            # 获取对应的分析结果
            analysis = analyses_storage.get(text_id)
            
            material = {
                "text_id": text_id,
                "title": text_info["title"],
                "content": text_info["content"],
                "word_count": text_info["word_count"],
                "created_at": text_info["created_at"],
                "analysis": analysis if analysis else None
            }
            materials.append(material)
        
        export_data = {
            "export_version": "1.0",
            "export_time": datetime.now().isoformat(),
            "total_materials": len(materials),
            "materials": materials
        }
        
        # 生成JSON内容
        json_content = json.dumps(export_data, ensure_ascii=False, indent=2)
        
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"practice_materials_{timestamp}.json"
        
        return Response(
            content=json_content,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/json; charset=utf-8"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出练习材料失败: {str(e)}")
