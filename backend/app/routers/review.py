"""复习相关的路由和业务逻辑"""
import uuid
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from app.schemas.text import APIResponse, ReviewGenerateResponse, ReviewStatsResponse
from app.services.data_persistence import data_persistence
from app.services.ai_service import AIService, AIProvider

router = APIRouter(prefix="/api/review", tags=["review"])

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

@router.post("/generate", response_model=APIResponse)
async def generate_review_material(http_request: Request):
    """生成个性化复习材料"""
    try:
        # 获取用户AI配置
        user_config = get_user_ai_config(http_request)
        if not user_config:
            raise HTTPException(status_code=400, detail="请先配置AI服务")
        
        # 加载练习历史
        history_data = data_persistence.load_practice_history()
        
        if not history_data or len(history_data) == 0:
            raise HTTPException(status_code=400, detail="暂无练习历史，无法生成复习材料")
        
        # 分析用户错误模式
        analysis_data = analyze_user_patterns(history_data)
        
        # 生成复习文章
        user_ai_service = create_user_ai_service(user_config)
        review_article = await user_ai_service.generate_review_article(analysis_data, history_data)
        
        # 分析生成的文章获得中文翻译
        article_analysis = await user_ai_service.analyze_text(review_article)
        
        # 创建新的练习材料
        text_id = str(uuid.uuid4())
        
        # 加载当前的texts和analyses数据
        from app.routers.texts import texts_storage, analyses_storage
        
        texts_storage[text_id] = {
            "id": text_id,
            "title": f"复习材料_{datetime.now().strftime('%m%d')}",
            "content": review_article,
            "word_count": len(review_article.split()),
            "created_at": datetime.now().isoformat(),
            "practice_type": "review",
            "source": "ai_generated_review",
            "folder_id": None
        }
        
        # 保存分析结果
        analyses_storage[text_id] = {
            "text_id": text_id,
            "translation": article_analysis["translation"],
            "difficult_words": article_analysis.get("difficult_words", []),
            "difficulty": 4,  # 复习材料默认中等偏上难度
            "key_points": ["复习重点", "错误总结", "学习建议"],
            "word_count": len(review_article.split())
        }
        
        # 保存数据
        from app.routers.texts import save_data
        save_data()
        
        return APIResponse(
            success=True,
            data={
                "text_id": text_id,
                "review_article": review_article,
                "analysis_summary": analysis_data
            },
            message="复习材料生成成功"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成复习材料失败: {str(e)}")

@router.get("/stats", response_model=APIResponse)
async def get_review_stats():
    """获取复习统计"""
    try:
        # 加载练习历史
        history_data = data_persistence.load_practice_history()
        
        if not history_data:
            return APIResponse(
                success=True,
                data={
                    "total_practiced": 0,
                    "need_review": 0,
                    "mastered": 0,
                    "focus_areas": [],
                    "recent_errors": []
                }
            )
        
        # 计算统计数据
        total_practiced = len(history_data)
        need_review = len([r for r in history_data if getattr(r, 'review_count', 0) <= 2])
        mastered = len([r for r in history_data if getattr(r, 'review_count', 0) >= 5])
        
        # 分析错误模式
        analysis_data = analyze_user_patterns(history_data)
        
        return APIResponse(
            success=True,
            data={
                "total_practiced": total_practiced,
                "need_review": need_review,
                "mastered": mastered,
                "focus_areas": analysis_data.get("focus_areas", []),
                "recent_errors": analysis_data.get("recent_errors", [])[:5]  # 只返回前5个
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取复习统计失败: {str(e)}")

@router.post("/mark/{text_id}", response_model=APIResponse)
async def mark_reviewed(text_id: str):
    """标记复习完成"""
    try:
        # 加载练习历史
        history_data = data_persistence.load_practice_history()
        
        # 查找对应的练习记录
        updated = False
        for record in history_data:
            if hasattr(record, 'id') and record.id == text_id:
                # 增加复习次数
                if not hasattr(record, 'review_count'):
                    record.review_count = 0
                record.review_count += 1
                record.last_reviewed = datetime.now().isoformat()
                updated = True
                break
        
        if not updated:
            raise HTTPException(status_code=404, detail="练习记录不存在")
        
        # 保存数据
        data_persistence.save_practice_history(history_data)
        
        return APIResponse(
            success=True,
            message="复习记录更新成功"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新复习记录失败: {str(e)}")

def analyze_user_patterns(history_data: List) -> Dict[str, Any]:
    """分析用户的错误模式"""
    # 按复习次数分组
    low_review = [r for r in history_data if getattr(r, 'review_count', 0) <= 2]
    medium_review = [r for r in history_data if 3 <= getattr(r, 'review_count', 0) <= 5]
    
    # 提取错误模式
    grammar_errors = []
    vocabulary_errors = []
    structure_errors = []
    
    for record in low_review[-10:]:  # 只分析最近10条低复习记录
        if hasattr(record, 'ai_evaluation') and record.ai_evaluation:
            corrections = record.ai_evaluation.get('corrections', [])
            for correction in corrections:
                # 分类错误类型
                reason = correction.get('reason', '').lower()
                if any(word in reason for word in ['grammar', 'tense', '语法', '时态']):
                    grammar_errors.append(correction)
                elif any(word in reason for word in ['vocabulary', 'word', '词汇', '单词']):
                    vocabulary_errors.append(correction)
                elif any(word in reason for word in ['structure', 'sentence', '结构', '句子']):
                    structure_errors.append(correction)
    
    return {
        "total_records": len(history_data),
        "low_review_count": len(low_review),
        "grammar_error_count": len(grammar_errors),
        "vocabulary_error_count": len(vocabulary_errors),
        "structure_error_count": len(structure_errors),
        "recent_errors": grammar_errors + vocabulary_errors + structure_errors,
        "focus_areas": determine_focus_areas(grammar_errors, vocabulary_errors, structure_errors)
    }

def determine_focus_areas(grammar_errors, vocabulary_errors, structure_errors) -> List[str]:
    """确定重点复习领域"""
    areas = []
    if len(grammar_errors) >= 3:
        areas.append("语法和时态运用")
    if len(vocabulary_errors) >= 3:
        areas.append("词汇选择和搭配")
    if len(structure_errors) >= 3:
        areas.append("句子结构组织")
    
    return areas if areas else ["基础语言表达"]