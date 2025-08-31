"""文本处理路由"""
import uuid
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
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
from app.services.ai_service import ai_service, AIService
from app.services.data_persistence import data_persistence

router = APIRouter(prefix="/api/texts", tags=["texts"])

# 内存存储（简化版，生产环境应使用数据库）
texts_storage: Dict[str, Dict[str, Any]] = {}

def get_user_ai_config(request: Request) -> Optional[Dict[str, str]]:
    """从请求头中获取用户的AI配置"""
    headers = request.headers
    
    provider = headers.get('x-ai-provider')
    api_key = headers.get('x-ai-key')
    base_url = headers.get('x-ai-base-url')
    model = headers.get('x-ai-model')
    
    if not provider or not api_key:
        return None
        
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
analyses_storage: Dict[str, Dict[str, Any]] = {}
practice_history: List[PracticeHistoryRecord] = []
folders_storage: Dict[str, Dict[str, Any]] = {}

def initialize_data():
    """初始化数据，从本地文件加载"""
    global practice_history, texts_storage, analyses_storage, folders_storage
    try:
        print("🔄 正在从本地文件加载数据...")
        loaded_history, loaded_texts, loaded_analyses, loaded_folders = data_persistence.load_all_data()
        
        practice_history = loaded_history
        texts_storage = loaded_texts
        analyses_storage = loaded_analyses
        folders_storage = loaded_folders
        
        print(f"✅ 数据加载完成: {len(practice_history)} 条历史记录, {len(texts_storage)} 个文本, {len(analyses_storage)} 个分析结果, {len(folders_storage)} 个文件夹")
    except Exception as e:
        print(f"❌ 数据加载失败: {e}")

def save_data():
    """保存所有数据到本地文件"""
    try:
        data_persistence.save_all_data(practice_history, texts_storage, analyses_storage, folders_storage)
        print("💾 数据已自动保存到本地文件")
    except Exception as e:
        print(f"❌ 数据保存失败: {e}")

# 启动时自动加载数据
initialize_data()

# AI配置路由已移除 - 现在使用浏览器本地存储管理API key

# 注意：原有的AI配置路由（/ai/status, /ai/configure, /ai/providers, /ai/switch）
# 已被移除，因为现在使用浏览器本地存储来管理用户的API key配置

def count_words(text: str) -> int:
    """计算单词数量"""
    return len(text.strip().split())

@router.post("/upload", response_model=APIResponse)
async def upload_text(request: TextUploadRequest, http_request: Request, background_tasks: BackgroundTasks):
    """上传英文文本并触发AI分析"""
    try:
        # 获取用户的AI配置
        user_config = get_user_ai_config(http_request)
        if not user_config:
            raise HTTPException(
                status_code=400, 
                detail="请先在浏览器中配置AI服务（提供商和API密钥）"
            )
        
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
            "created_at": datetime.now().isoformat(),
            "practice_type": request.practice_type or "translation",
            "topic": request.topic,
            "folder_id": getattr(request, 'folder_id', None)  # 支持文件夹分类
        }
        
        # 自动保存数据
        save_data()
        
        # 后台异步分析文本，传递用户配置
        background_tasks.add_task(analyze_text_background, text_id, request.content, user_config)
        
        return APIResponse(
            success=True,
            data={"text_id": text_id, "word_count": word_count},
            message="文本上传成功，AI正在分析中..."
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文本上传失败: {str(e)}")

async def analyze_text_background(text_id: str, content: str, user_config: Dict[str, str]):
    """后台分析文本"""
    try:
        # 使用用户的AI配置创建临时服务
        user_ai_service = create_user_ai_service(user_config)
        analysis_result = await user_ai_service.analyze_text(content)
        
        # 存储分析结果
        analyses_storage[text_id] = {
            "text_id": text_id,
            "translation": analysis_result["translation"],
            "difficult_words": analysis_result["difficult_words"],
            "difficulty": analysis_result["difficulty"],
            "key_points": analysis_result["key_points"],
            "word_count": count_words(content)
        }
        
        # 自动保存数据
        save_data()
        
        print(f"✅ 文本 {text_id} 分析完成")
        
    except Exception as e:
        print(f"❌ 文本 {text_id} 分析失败: {str(e)}")
        # 存储失败信息
        analyses_storage[text_id] = {
            "text_id": text_id,
            "translation": "分析失败，请重试",
            "difficult_words": [{"word": "分析失败", "meaning": "请稍后重试"}],
            "difficulty": 3,
            "key_points": ["分析失败"],
            "word_count": count_words(content)
        }

async def re_analyze_imported_text(text_id: str, content: str, existing_translation: str):
    """重新分析从历史记录导入的文本"""
    try:
        analysis_result = await ai_service.analyze_text(content)
        
        # 更新分析结果，但保留已有的翻译（来自历史记录）
        analyses_storage[text_id] = {
            "text_id": text_id,
            "translation": existing_translation,  # 保留历史记录中的翻译
            "difficult_words": analysis_result["difficult_words"],
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
        # 首先检查是否在texts_storage中
        if text_id not in texts_storage:
            # 如果不在texts_storage中，检查是否是作文样本ID（在practice_history中）
            essay_record = None
            for record in practice_history:
                if hasattr(record, 'practice_type') and getattr(record, 'practice_type') == 'essay':
                    # 检查是否有匹配的ID模式（可能是从记录ID生成的）
                    if text_id in record.text_content or record.id == text_id:
                        essay_record = record
                        break
            
            if not essay_record:
                # 检查是否是作文范文的文本内容ID
                for record in practice_history:
                    if hasattr(record, 'practice_type') and getattr(record, 'practice_type') == 'essay':
                        # 为作文范文创建虚拟的分析结果
                        if len(record.text_content) > 0:  # 确保有内容
                            # 使用文本内容的哈希作为可能的ID匹配
                            content_hash = str(hash(record.text_content))
                            if text_id in content_hash or text_id == record.id:
                                essay_record = record
                                break
                
                if not essay_record:
                    raise HTTPException(status_code=404, detail="文本不存在")
            
            # 为作文样本创建虚拟的分析结果
            word_count = len(essay_record.text_content.split())
            analysis = {
                "text_id": text_id,
                "translation": essay_record.chinese_translation,
                "difficult_words": [{"word": "作文", "meaning": "essay writing"}],
                "difficulty": 4,  # 作文默认中等偏上难度
                "key_points": ["作文范文", "学习参考"],
                "word_count": word_count
            }
            
            return APIResponse(
                success=True,
                data=TextAnalysisResponse(**analysis),
                message="获取作文分析结果成功"
            )
        
        # 更新最后打开时间
        texts_storage[text_id]["last_opened"] = datetime.now().isoformat()
        save_data()
        
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
async def submit_practice(request: PracticeSubmitRequest, http_request: Request):
    """提交练习答案并获得评估"""
    try:
        # 获取用户的AI配置
        user_config = get_user_ai_config(http_request)
        if not user_config:
            raise HTTPException(
                status_code=400, 
                detail="请先在浏览器中配置AI服务（提供商和API密钥）"
            )
        
        if request.text_id not in texts_storage:
            raise HTTPException(status_code=404, detail="文本不存在")
        
        if request.text_id not in analyses_storage:
            raise HTTPException(status_code=400, detail="文本分析尚未完成，请稍后重试")
        
        # 获取原文和翻译
        original_text = texts_storage[request.text_id]["content"]
        analysis = analyses_storage[request.text_id]
        translation = analysis["translation"]
        
        # 使用用户的AI配置创建临时服务
        user_ai_service = create_user_ai_service(user_config)
        
        # 调用AI评估
        evaluation = await user_ai_service.evaluate_answer(
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
        
        # 自动保存数据
        save_data()
        
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
        # 首先检查是否在texts_storage中
        if text_id not in texts_storage:
            # 如果不在texts_storage中，检查是否是作文样本ID（在practice_history中）
            essay_record = None
            for record in practice_history:
                if hasattr(record, 'practice_type') and getattr(record, 'practice_type') == 'essay':
                    # 检查是否有匹配的ID模式
                    if record.id == text_id or text_id in record.text_content:
                        essay_record = record
                        break
            
            if not essay_record:
                # 第二次尝试：检查是否是作文范文的任何相关ID
                for record in practice_history:
                    if hasattr(record, 'practice_type') and getattr(record, 'practice_type') == 'essay':
                        if len(record.text_content) > 0:
                            # 使用更宽松的匹配条件
                            content_hash = str(hash(record.text_content))
                            if text_id in content_hash or text_id == record.id:
                                essay_record = record
                                break
                
                if not essay_record:
                    raise HTTPException(status_code=404, detail="文本不存在")
            
            # 为作文样本创建虚拟的文本信息
            word_count = len(essay_record.text_content.split())
            data = {
                "text_id": text_id,
                "title": essay_record.text_title,
                "word_count": word_count,
                "practice_type": getattr(essay_record, 'practice_type', 'essay'),
                "topic": getattr(essay_record, 'topic', None)
            }
            
            # 只有明确要求时才返回原文内容
            if include_content:
                data["content"] = essay_record.text_content
            
            return APIResponse(
                success=True,
                data=data,
                message="获取作文文本信息成功"
            )
        
        text_info = texts_storage[text_id]
        
        data = {
            "text_id": text_info["id"],
            "title": text_info["title"],
            "word_count": text_info["word_count"],
            "practice_type": text_info.get("practice_type", "translation"),
            "topic": text_info.get("topic")
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

@router.post("/{text_id}/move", response_model=APIResponse)
async def move_text_to_folder(text_id: str, folder_data: Dict[str, Any]):
    """移动文本到指定文件夹"""
    try:
        if text_id not in texts_storage:
            raise HTTPException(status_code=404, detail="练习材料不存在")
        
        folder_id = folder_data.get("folder_id")
        
        # 🔧 修复：从folders模块导入正确的folders_storage
        if folder_id:
            from .folders import folders_storage as folder_storage
            if folder_id not in folder_storage:
                raise HTTPException(status_code=400, detail="目标文件夹不存在")
            
            target_folder_name = folder_storage[folder_id]["name"]
            move_message = f"练习材料 '{texts_storage[text_id].get('title', '未命名材料')}' 已移动到文件夹 '{target_folder_name}'"
        else:
            move_message = f"练习材料 '{texts_storage[text_id].get('title', '未命名材料')}' 已移动到根目录"
        
        # 更新文本的文件夹关联
        texts_storage[text_id]["folder_id"] = folder_id
        
        # 自动保存数据
        save_data()
        
        return APIResponse(
            success=True,
            data={"text_id": text_id, "folder_id": folder_id},
            message=move_message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"移动练习材料失败: {str(e)}")

@router.get("/", response_model=APIResponse)
async def list_texts(folder_id: Optional[str] = None):
    """获取所有文本列表，支持按文件夹筛选"""
    try:
        texts_list = []
        for text_id, text_info in texts_storage.items():
            # 如果指定了文件夹ID，只返回该文件夹下的文本
            if folder_id is not None:
                if text_info.get("folder_id") != folder_id:
                    continue
            
            # 检查是否有分析结果
            has_analysis = text_id in analyses_storage
            
            texts_list.append({
                "text_id": text_info["id"],
                "title": text_info["title"],
                "word_count": text_info["word_count"],
                "has_analysis": has_analysis,
                "difficulty": analyses_storage.get(text_id, {}).get("difficulty", 0) if has_analysis else 0,
                "last_opened": text_info.get("last_opened"),
                "created_at": text_info.get("created_at", datetime.now().isoformat()),
                "practice_type": text_info.get("practice_type", "translation"),
                "topic": text_info.get("topic"),
                "folder_id": text_info.get("folder_id")  # 包含文件夹信息
            })
        
        # 按创建时间倒序排列（最新的在前面）
        texts_list.sort(key=lambda x: x["created_at"], reverse=True)
        
        filter_msg = f"文件夹筛选下的 " if folder_id else ""
        
        return APIResponse(
            success=True,
            data=texts_list,
            message=f"获取到 {filter_msg}{len(texts_list)} 个文本"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文本列表失败: {str(e)}")

@router.post("/practice/submit-stream")
async def submit_practice_stream(request: PracticeSubmitRequest, http_request: Request):
    """流式提交练习答案并获得评估"""
    try:
        # 获取用户的AI配置
        user_config = get_user_ai_config(http_request)
        if not user_config:
            raise HTTPException(
                status_code=400, 
                detail="请先在浏览器中配置AI服务（提供商和API密钥）"
            )
        
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
                # 使用用户的AI配置创建临时服务
                user_ai_service = create_user_ai_service(user_config)
                
                async for chunk in user_ai_service.evaluate_answer_stream(
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
                    
                    # 自动保存数据
                    save_data()
                    
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

@router.get("/{text_id}/practice/history", response_model=APIResponse)
async def get_text_practice_history(text_id: str):
    """获取特定文本的练习历史记录"""
    try:
        if text_id not in texts_storage:
            raise HTTPException(status_code=404, detail="文本不存在")
        
        # 筛选出该文本的练习记录
        text_practice_records = [
            record for record in practice_history 
            if record.text_content.strip() == texts_storage[text_id]["content"].strip()
        ]
        
        # 按时间倒序排列
        text_practice_records.sort(key=lambda x: x.timestamp, reverse=True)
        
        return APIResponse(
            success=True,
            data=text_practice_records,
            message=f"获取到该文本的 {len(text_practice_records)} 条练习记录"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文本练习历史失败: {str(e)}")

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
        
        # 自动保存数据
        save_data()
        
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
                    "difficult_words": [{"word": "导入", "meaning": "从历史记录导入"}],  # 简化的难词
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

@router.post("/materials/import", response_model=APIResponse)
async def import_practice_materials(import_data: Dict[str, Any]):
    """导入练习材料"""
    try:
        global texts_storage, analyses_storage
        
        # 验证导入数据格式
        if "materials" not in import_data:
            raise HTTPException(status_code=400, detail="导入数据格式错误：缺少materials字段")
        
        materials = import_data["materials"]
        if not isinstance(materials, list):
            raise HTTPException(status_code=400, detail="导入数据格式错误：materials必须是数组")
        
        imported_count = 0
        skipped_count = 0
        
        for material in materials:
            try:
                # 验证必要字段
                required_fields = ["title", "content"]
                for field in required_fields:
                    if field not in material:
                        print(f"跳过材料，缺少字段: {field}")
                        skipped_count += 1
                        continue
                
                # 检查是否已存在相同内容的材料
                content = material["content"].strip()
                material_exists = False
                for existing_text_id, existing_text in texts_storage.items():
                    if existing_text["content"].strip() == content:
                        material_exists = True
                        break
                
                if material_exists:
                    print(f"跳过重复材料: {material.get('title', '未命名')}")
                    skipped_count += 1
                    continue
                
                # 生成新的文本ID或使用原有ID
                text_id = material.get("text_id", str(uuid.uuid4()))
                
                # 如果ID已存在，生成新ID
                if text_id in texts_storage:
                    text_id = str(uuid.uuid4())
                
                # 添加到练习材料库
                texts_storage[text_id] = {
                    "id": text_id,
                    "title": material["title"],
                    "content": content,
                    "word_count": material.get("word_count", count_words(content)),
                    "created_at": material.get("created_at", datetime.now().isoformat())
                }
                
                # 添加分析结果（如果有）
                analysis = material.get("analysis")
                if analysis and isinstance(analysis, dict):
                    # 确保分析结果包含必要字段
                    analyses_storage[text_id] = {
                        "text_id": text_id,
                        "translation": analysis.get("translation", ""),
                        "difficult_words": analysis.get("difficult_words", []),
                        "difficulty": analysis.get("difficulty", 3),
                        "key_points": analysis.get("key_points", []),
                        "word_count": material.get("word_count", count_words(content))
                    }
                else:
                    # 如果没有分析结果，创建默认的
                    analyses_storage[text_id] = {
                        "text_id": text_id,
                        "translation": "需要重新分析",
                        "difficult_words": [{"word": "导入", "meaning": "从材料库导入"}],
                        "difficulty": 3,
                        "key_points": ["从材料库导入"],
                        "word_count": count_words(content)
                    }
                
                imported_count += 1
                print(f"✅ 成功导入练习材料: {material['title']} (ID: {text_id})")
                
            except Exception as e:
                print(f"❌ 导入材料失败: {e}")
                skipped_count += 1
                continue
        
        # 自动保存数据
        save_data()
        
        return APIResponse(
            success=True,
            data={
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "total_materials": len(texts_storage)
            },
            message=f"成功导入 {imported_count} 个练习材料，跳过 {skipped_count} 个重复或错误材料"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入练习材料失败: {str(e)}")

@router.delete("/{text_id}", response_model=APIResponse)
async def delete_text(text_id: str):
    """删除指定的练习材料"""
    try:
        if text_id not in texts_storage:
            raise HTTPException(status_code=404, detail="练习材料不存在")
        
        # 获取要删除的材料信息
        text_info = texts_storage[text_id]
        material_title = text_info.get("title", "未命名材料")
        
        # 删除文本数据
        del texts_storage[text_id]
        
        # 删除对应的分析数据（如果存在）
        if text_id in analyses_storage:
            del analyses_storage[text_id]
        
        # 自动保存数据
        save_data()
        
        return APIResponse(
            success=True,
            data={"text_id": text_id, "title": material_title},
            message=f"练习材料 '{material_title}' 已成功删除"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除练习材料失败: {str(e)}")
