"""复习相关的路由和业务逻辑"""
import uuid
import re
from collections import Counter
from typing import Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from app.schemas.text import (
    APIResponse,
    GeneratedMaterial,
    GenerateMaterialRequest,
)
from app.services.ai_config_service import create_user_ai_service, get_user_ai_config
from app.services.data_persistence import data_persistence
from app.services.template_service import template_service
from app.services.text_service import create_text_with_analysis

router = APIRouter(prefix="/api/review", tags=["review"])

@router.post("/generate", response_model=APIResponse)
async def generate_review_material(http_request: Request):
    """生成个性化复习材料"""
    try:
        # 获取用户AI配置
        user_config = get_user_ai_config(http_request)
        if not user_config:
            raise HTTPException(status_code=400, detail="请先配置DeepSeek API密钥")
        
        # 加载练习历史
        history_data = data_persistence.load_practice_history()
        
        if not history_data or len(history_data) == 0:
            raise HTTPException(status_code=400, detail="暂无练习历史，无法生成复习材料")
        
        # 分析用户错误模式
        analysis_data = analyze_user_patterns(history_data)
        
        # 生成复习文章
        user_ai_service = create_user_ai_service(user_config)
        
        # 构建历史统计数据
        history_stats = {
            "total_practices": len(history_data),
            "average_score": sum(getattr(r, 'score', 0) for r in history_data) / len(history_data) if history_data else 0,
            "low_review_count": len([r for r in history_data if getattr(r, 'review_count', 0) <= 2])
        }
        
        # 使用模板渲染提示词并调用统一API
        prompt = template_service.render_generate_review_article_prompt(analysis_data, history_stats)
        response = await user_ai_service.call_ai_api(prompt)
        result = user_ai_service.extract_json_from_response(response)
        review_article = result.get("review_article", "")
        
        # 分析生成的文章获得中文翻译
        prompt = template_service.render_analyze_text_prompt(review_article)
        analysis_response = await user_ai_service.call_ai_api(prompt)
        article_analysis = user_ai_service.extract_json_from_response(analysis_response)
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成复习材料失败: {str(e)}")

@router.post("/generate-practice", response_model=APIResponse)
async def generate_practice_material(request: GenerateMaterialRequest, http_request: Request):
    """基于错题生成新的个性化回译练习材料，并同步完成文本分析。"""
    try:
        user_config = get_user_ai_config(http_request)
        if not user_config:
            raise HTTPException(status_code=400, detail="请先配置DeepSeek API密钥")

        history_data = data_persistence.load_practice_history()
        history_stats = build_generation_history_stats(history_data)
        focus_areas = summarize_focus_areas_from_history(history_data)
        recent_errors = extract_recent_errors(history_data)

        user_ai_service = create_user_ai_service(user_config)
        prompt = template_service.render_generate_practice_material_prompt(
            history_stats=history_stats,
            focus_areas=focus_areas,
            recent_errors=recent_errors,
            topic=request.topic,
            genre=request.genre,
            word_count=request.word_count,
            difficulty=request.difficulty,
            user_level="B2"
        )

        response = await user_ai_service.call_ai_api(prompt)
        try:
            generated_payload = user_ai_service.extract_json_from_response(response)
            generated_material = GeneratedMaterial(**generated_payload)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"AI返回的练习材料不是合法JSON或字段不完整: {str(exc)}"
            )

        from app.routers.texts import analyses_storage, save_data, texts_storage

        created = await create_text_with_analysis(
            content=generated_material.content,
            title=generated_material.title,
            user_ai_service=user_ai_service,
            texts_storage=texts_storage,
            analyses_storage=analyses_storage,
            save_callback=save_data,
            practice_type="translation",
            topic=generated_material.topic,
            folder_id=request.folder_id,
            source="ai_generated_practice",
            extra_fields={
                "generation_metadata": {
                    "estimated_difficulty": generated_material.estimated_difficulty,
                    "targeted_weaknesses": generated_material.targeted_weaknesses,
                    "design_rationale": generated_material.design_rationale,
                }
            }
        )

        analysis = created["analysis"]
        return APIResponse(
            success=True,
            data={
                "text_id": created["text_id"],
                "generated_material": generated_material.model_dump(),
                "analysis_summary": {
                    "difficulty": analysis.get("difficulty"),
                    "word_count": analysis.get("word_count"),
                    "difficult_words": analysis.get("difficult_words", []),
                    "key_points": analysis.get("key_points", []),
                    "focus_areas": focus_areas,
                    "recent_errors_count": len(recent_errors),
                }
            },
            message="个性化练习材料生成成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成个性化练习材料失败: {str(e)}")

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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新复习记录失败: {str(e)}")

ERROR_KEYWORDS = [
    "冠词", "时态", "介词", "单复数", "主谓一致", "词汇", "搭配", "语序", "句子结构",
    "从句", "虚拟语气", "过去式", "完成时", "被动语态", "动词形式", "名词", "形容词",
    "副词", "逻辑", "语义", "自然度", "表达", "不地道", "过度简化", "复杂度"
]

ENGLISH_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "should", "would",
    "could", "because", "use", "used", "word", "words", "sentence", "grammar",
}


def build_generation_history_stats(history_data: List) -> Dict[str, Any]:
    """Build compact stats for the practice-material prompt."""
    total_practiced = len(history_data or [])
    if not total_practiced:
        return {"total_practiced": 0, "avg_score": "N/A"}

    scores = [int(getattr(record, "score", 0) or 0) for record in history_data]
    avg_score = round(sum(scores) / total_practiced, 1)
    return {"total_practiced": total_practiced, "avg_score": avg_score}


def iter_history_corrections(history_data: List):
    """Yield corrections with their parent history record, newest first."""
    records = sorted(
        history_data or [],
        key=lambda record: getattr(record, "timestamp", ""),
        reverse=True
    )

    for record in records:
        evaluation = getattr(record, "ai_evaluation", {}) or {}
        corrections = evaluation.get("corrections", [])
        if not isinstance(corrections, list):
            continue
        for correction in corrections:
            if isinstance(correction, dict):
                yield record, correction


def summarize_focus_areas_from_history(history_data: List, limit: int = 5) -> List[str]:
    """Summarize frequent weakness areas from correction reasons with a local Counter."""
    counter: Counter[str] = Counter()

    for _, correction in iter_history_corrections(history_data):
        reason = str(correction.get("reason", "")).strip()
        if not reason:
            continue

        matched = False
        for keyword in ERROR_KEYWORDS:
            if keyword in reason:
                counter[keyword] += 1
                matched = True

        for token in re.findall(r"[A-Za-z]{3,}", reason.lower()):
            if token not in ENGLISH_STOPWORDS:
                counter[token] += 1
                matched = True

        if not matched:
            counter[reason[:40]] += 1

    return [f"{area}（{count}次）" for area, count in counter.most_common(limit)]


def extract_recent_errors(history_data: List, limit: int = 8) -> List[Dict[str, Any]]:
    """Extract recent concrete correction examples for the generation prompt."""
    recent_errors = []

    for record, correction in iter_history_corrections(history_data):
        reason = str(correction.get("reason", "")).strip()
        suggestion = str(correction.get("suggestion", "")).strip()
        user_wrote = str(correction.get("original", "")).strip()
        if not reason and not suggestion and not user_wrote:
            continue

        text_content = getattr(record, "text_content", "") or ""
        original_excerpt = " ".join(text_content.split())[:240]
        recent_errors.append({
            "original": original_excerpt or user_wrote,
            "user_wrote": user_wrote or "(缺失)",
            "suggestion": suggestion or "(缺失)",
            "reason": reason or "未说明",
        })
        if len(recent_errors) >= limit:
            break

    return recent_errors

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
