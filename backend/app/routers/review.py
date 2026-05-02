"""复习相关的路由和业务逻辑"""
import uuid
from collections import Counter
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
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

@router.post("/mark/{record_id}", response_model=APIResponse)
async def mark_reviewed(record_id: str):
    """标记复习完成，并按 SM-2 算法刷新下次复习时间。"""
    try:
        history_data = data_persistence.load_practice_history()

        target = None
        for record in history_data:
            if getattr(record, "id", None) == record_id:
                target = record
                break

        if target is None:
            raise HTTPException(status_code=404, detail="练习记录不存在")

        prev_ease = getattr(target, "ease_factor", 2.0)
        prev_last = getattr(target, "last_reviewed", None)
        prev_count = getattr(target, "review_count", 0) or 0

        next_at, new_ease = schedule_next_review(
            score=int(getattr(target, "score", 0)),
            review_count=prev_count,
            prev_ease=prev_ease,
            prev_last_reviewed=prev_last,
        )

        target.review_count = prev_count + 1
        target.last_reviewed = datetime.now().isoformat()
        target.next_review_at = next_at
        target.ease_factor = new_ease

        data_persistence.save_practice_history(history_data)

        return APIResponse(
            success=True,
            data={
                "next_review_at": next_at,
                "ease_factor": new_ease,
                "review_count": target.review_count,
            },
            message="复习记录更新成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新复习记录失败: {str(e)}")


@router.get("/due", response_model=APIResponse)
async def list_due_reviews(limit: int = 20):
    """返回到期复习列表（next_review_at <= now）。
    没有 next_review_at 的旧记录用 timestamp + 1 天作兜底视为'到期'。"""
    try:
        history_data = data_persistence.load_practice_history()
        now = datetime.now()
        due: List[Dict[str, Any]] = []

        for record in history_data:
            next_at = getattr(record, "next_review_at", None)
            try:
                due_at = (
                    datetime.fromisoformat(next_at) if next_at
                    else datetime.fromisoformat(record.timestamp) + timedelta(days=1)
                )
            except (ValueError, TypeError):
                continue

            if due_at <= now:
                evaluation = getattr(record, "ai_evaluation", {}) or {}
                due.append({
                    "id": record.id,
                    "timestamp": record.timestamp,
                    "text_title": record.text_title,
                    "score": record.score,
                    "review_count": getattr(record, "review_count", 0),
                    "last_reviewed": getattr(record, "last_reviewed", None),
                    "next_review_at": next_at,
                    "overdue_days": round((now - due_at).total_seconds() / 86400.0, 1),
                    "error_categories": getattr(record, "error_patterns", []),
                    "overall_feedback": evaluation.get("overall_feedback", ""),
                })

        # 越逾期越靠前
        due.sort(key=lambda r: r["overdue_days"], reverse=True)
        return APIResponse(
            success=True,
            data={"due": due[:limit], "total": len(due)},
            message=f"到期复习 {len(due)} 条"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取到期复习失败: {str(e)}")

# category -> 中文展示名。与前端 Practice.tsx 的 CATEGORY_LABELS 保持同步。
CATEGORY_LABELS_ZH: Dict[str, str] = {
    "grammar.article": "冠词",
    "grammar.tense": "时态",
    "grammar.aspect": "体（进行/完成）",
    "grammar.number": "单复数",
    "grammar.agreement": "主谓一致",
    "grammar.voice": "语态",
    "grammar.mood": "语气",
    "grammar.preposition": "介词",
    "grammar.conjunction": "连词/从句",
    "grammar.word_order": "语序",
    "grammar.nonfinite": "非谓语动词",
    "grammar.other": "其他语法",
    "lexis.word_choice": "选词",
    "lexis.collocation": "搭配",
    "lexis.register": "语域",
    "lexis.semantic_prosody": "语义韵",
    "lexis.derivation": "构词",
    "discourse.cohesion": "衔接",
    "discourse.information_structure": "信息结构",
    "discourse.reference": "指代",
    "mechanics.spelling": "拼写",
    "mechanics.punctuation": "标点",
    "mechanics.capitalization": "大小写",
}

SEVERITY_WEIGHT = {"critical": 3, "major": 2, "minor": 1}

SOURCE_LABELS_ZH = {
    "L1_transfer": "母语迁移",
    "overgeneralization": "规则泛化",
    "intralingual": "语内混淆",
    "performance_slip": "偶发笔误",
}

# ====== 间隔重复调度（SM-2 风格简化版）======
# 首次提交后的初始间隔（天），按当次得分分档
INITIAL_INTERVAL_DAYS = {"high": 7, "mid": 3, "low": 1}
# 复习时根据本次得分对 ease_factor 的乘法调整
EASE_DELTA = {"high": 1.3, "mid": 1.0, "low": 0.6}
EASE_MIN = 1.3
EASE_MAX = 4.0
INTERVAL_CAP_DAYS = 90


def _score_band(score: int) -> str:
    if score >= 85:
        return "high"
    if score >= 70:
        return "mid"
    return "low"


def schedule_next_review(
    score: int,
    review_count: int,
    prev_ease: Optional[float],
    prev_last_reviewed: Optional[str],
    now: Optional[datetime] = None,
) -> Tuple[str, float]:
    """根据本次得分算出下次复习时间和新的 ease_factor。
    review_count == 0 视为首次：用 INITIAL_INTERVAL_DAYS。
    之后按 SM-2 简化：next_interval = (now - last_reviewed) * adjusted_ease，封顶 90d。"""
    now = now or datetime.now()
    band = _score_band(int(score))

    if review_count <= 0 or not prev_last_reviewed:
        days = INITIAL_INTERVAL_DAYS[band]
        new_ease = float(prev_ease or 2.0)
    else:
        try:
            last = datetime.fromisoformat(prev_last_reviewed)
            elapsed = max(1.0, (now - last).total_seconds() / 86400.0)
        except (ValueError, TypeError):
            elapsed = float(INITIAL_INTERVAL_DAYS[band])

        ease = float(prev_ease or 2.0) * EASE_DELTA[band]
        ease = max(EASE_MIN, min(EASE_MAX, ease))
        new_ease = ease
        days = min(INTERVAL_CAP_DAYS, max(1, int(round(elapsed * ease))))

    next_at = now + timedelta(days=days)
    return next_at.isoformat(), new_ease


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
    """从 corrections 的 category 标签按 severity 加权统计，找出最该重练的语言点。
    输出形如 "冠词（grammar.article, 12 次, 偏母语迁移）"，prompt 直接用。"""
    weighted: Counter = Counter()
    source_per_cat: Dict[str, Counter] = {}
    raw_count: Counter = Counter()

    for _, correction in iter_history_corrections(history_data):
        category = correction.get("category") or "grammar.other"
        severity = correction.get("severity") or "minor"
        source = correction.get("source") or "intralingual"

        weight = SEVERITY_WEIGHT.get(severity, 1)
        weighted[category] += weight
        raw_count[category] += 1
        source_per_cat.setdefault(category, Counter())[source] += 1

    out: List[str] = []
    for category, _ in weighted.most_common(limit):
        label = CATEGORY_LABELS_ZH.get(category, category)
        count = raw_count[category]
        sources = source_per_cat.get(category, Counter())
        top_source, _ = sources.most_common(1)[0] if sources else ("intralingual", 0)
        source_hint = SOURCE_LABELS_ZH.get(top_source, top_source)
        out.append(f"{label}（{category}, {count} 次, 偏{source_hint}）")
    return out


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
    """按 corrections 的 category 一级类别（grammar/lexis/discourse/mechanics）分组统计，
    并分析 source 分布——L1_transfer 占比是中国学习者最值得跟踪的诊断信号。"""
    family_buckets: Dict[str, List[Dict[str, Any]]] = {
        "grammar": [], "lexis": [], "discourse": [], "mechanics": []
    }
    source_counter: Counter = Counter()
    severity_counter: Counter = Counter()

    for _, correction in iter_history_corrections(history_data):
        category = correction.get("category") or "grammar.other"
        family = category.split(".", 1)[0] if "." in category else "grammar"
        if family not in family_buckets:
            family = "grammar"
        family_buckets[family].append(correction)
        source_counter[correction.get("source") or "intralingual"] += 1
        severity_counter[correction.get("severity") or "minor"] += 1

    total_corrections = sum(len(v) for v in family_buckets.values())
    low_review = [r for r in history_data if getattr(r, "review_count", 0) <= 2]

    return {
        "total_records": len(history_data),
        "low_review_count": len(low_review),
        "grammar_error_count": len(family_buckets["grammar"]),
        "vocabulary_error_count": len(family_buckets["lexis"]),
        "structure_error_count": len(family_buckets["discourse"]),
        "mechanics_error_count": len(family_buckets["mechanics"]),
        "source_distribution": dict(source_counter),
        "severity_distribution": dict(severity_counter),
        "l1_transfer_ratio": (
            round(source_counter.get("L1_transfer", 0) / total_corrections, 2)
            if total_corrections else 0.0
        ),
        # recent_errors 给 prompt 用：从所有 family 各取一些代表错误
        "recent_errors": (
            family_buckets["grammar"][:6]
            + family_buckets["lexis"][:6]
            + family_buckets["discourse"][:4]
        ),
        "focus_areas": summarize_focus_areas_from_history(history_data),
    }
