"""Shared text creation and analysis helpers."""
import uuid
from datetime import datetime
from typing import Any, Callable, Dict, Optional

from app.services.ai_service import AIService, DEEPSEEK_MODEL_FLASH
from app.services.template_service import template_service


def count_words(text: str) -> int:
    """Count whitespace-separated English words."""
    return len((text or "").strip().split())


def _normalize_contrastive_notes(raw: Any) -> list:
    """把 AI 返回的对比要点过滤到结构稳定的形态，缺字段就丢弃。"""
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        point = str(item.get("point", "")).strip()
        en_example = str(item.get("en_example", "")).strip()
        if not point or not en_example:
            continue
        out.append({
            "point": point,
            "en_example": en_example,
            "zh_in_translation": str(item.get("zh_in_translation", "")).strip(),
            "hint": str(item.get("hint", "")).strip(),
        })
    return out


def _normalize_aligned_segments(raw: Any) -> list:
    """把 AI 返回的句段对齐过滤到结构稳定的形态。en/zh 任一为空就丢弃。"""
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        en = str(item.get("en", "")).strip()
        zh = str(item.get("zh", "")).strip()
        if not en or not zh:
            continue
        out.append({"en": en, "zh": zh})
    return out


def normalize_analysis_result(analysis_result: Dict[str, Any], content: str) -> Dict[str, Any]:
    """Validate and normalize the JSON returned by the text-analysis prompt."""
    required_fields = ["translation", "difficult_words", "difficulty", "key_points"]
    for field in required_fields:
        if field not in analysis_result:
            raise Exception(f"AI响应缺少必要字段: {field}")

    analysis_result["difficulty"] = int(analysis_result["difficulty"])
    analysis_result["difficulty"] = max(1, min(5, analysis_result["difficulty"]))

    if not isinstance(analysis_result["difficult_words"], list):
        analysis_result["difficult_words"] = []
    if not isinstance(analysis_result["key_points"], list):
        analysis_result["key_points"] = []

    return {
        "translation": analysis_result["translation"],
        "difficult_words": analysis_result["difficult_words"],
        "difficulty": analysis_result["difficulty"],
        "key_points": analysis_result["key_points"],
        "word_count": count_words(content),
        "contrastive_notes": _normalize_contrastive_notes(analysis_result.get("contrastive_notes")),
        "aligned_segments": _normalize_aligned_segments(analysis_result.get("aligned_segments")),
    }


async def analyze_text_content(content: str, user_ai_service: AIService) -> Dict[str, Any]:
    """Run the existing analyze prompt against text content."""
    prompt = template_service.render_analyze_text_prompt(content)
    response = await user_ai_service.call_ai_api(prompt, model=DEEPSEEK_MODEL_FLASH)
    analysis_result = user_ai_service.extract_json_from_response(response)
    return normalize_analysis_result(analysis_result, content)


def create_text_record(
    *,
    content: str,
    texts_storage: Dict[str, Dict[str, Any]],
    save_callback: Optional[Callable[[], None]] = None,
    title: Optional[str] = None,
    practice_type: str = "translation",
    topic: Optional[str] = None,
    folder_id: Optional[str] = None,
    source: Optional[str] = None,
    extra_fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create and persist a text record without analysis."""
    text_id = str(uuid.uuid4())
    word_count = count_words(content)
    record = {
        "id": text_id,
        "title": title or f"文本_{text_id[:8]}",
        "content": content,
        "word_count": word_count,
        "created_at": datetime.now().isoformat(),
        "practice_type": practice_type,
        "topic": topic,
        "folder_id": folder_id,
    }
    if source:
        record["source"] = source
    if extra_fields:
        record.update(extra_fields)

    texts_storage[text_id] = record
    if save_callback:
        save_callback()

    return {"text_id": text_id, "word_count": word_count, "text": record}


async def analyze_text_into_storage(
    *,
    text_id: str,
    content: str,
    user_ai_service: AIService,
    analyses_storage: Dict[str, Dict[str, Any]],
    save_callback: Optional[Callable[[], None]] = None,
    fallback_on_error: bool = False,
    translation_override: Optional[str] = None,
) -> Dict[str, Any]:
    """Analyze content and store the result for a text id."""
    try:
        analysis = await analyze_text_content(content, user_ai_service)
        if translation_override is not None:
            analysis["translation"] = translation_override
    except Exception as exc:
        print(f"❌ 文本 {text_id} 分析失败: {str(exc)}")
        if not fallback_on_error:
            raise
        analysis = {
            "translation": "分析失败，请重试",
            "difficult_words": [{"word": "分析失败", "meaning": "请稍后重试"}],
            "difficulty": 3,
            "key_points": ["分析失败"],
            "word_count": count_words(content),
        }

    stored_analysis = {"text_id": text_id, **analysis}
    analyses_storage[text_id] = stored_analysis
    if save_callback:
        save_callback()
    return stored_analysis


async def create_text_with_analysis(
    *,
    content: str,
    user_ai_service: AIService,
    texts_storage: Dict[str, Dict[str, Any]],
    analyses_storage: Dict[str, Dict[str, Any]],
    save_callback: Optional[Callable[[], None]] = None,
    title: Optional[str] = None,
    practice_type: str = "translation",
    topic: Optional[str] = None,
    folder_id: Optional[str] = None,
    source: Optional[str] = None,
    extra_fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a text record and synchronously run the existing analysis pipeline."""
    created = create_text_record(
        content=content,
        texts_storage=texts_storage,
        save_callback=save_callback,
        title=title,
        practice_type=practice_type,
        topic=topic,
        folder_id=folder_id,
        source=source,
        extra_fields=extra_fields,
    )
    text_id = created["text_id"]

    try:
        analysis = await analyze_text_into_storage(
            text_id=text_id,
            content=content,
            user_ai_service=user_ai_service,
            analyses_storage=analyses_storage,
            save_callback=save_callback,
            fallback_on_error=False,
        )
    except Exception:
        texts_storage.pop(text_id, None)
        analyses_storage.pop(text_id, None)
        if save_callback:
            save_callback()
        raise

    return {**created, "analysis": analysis}
