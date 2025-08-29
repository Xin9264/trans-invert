"""文本相关的数据模型"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class TextUploadRequest(BaseModel):
    """文本上传请求"""
    content: str = Field(..., min_length=10, max_length=10000, description="英文文本内容")
    title: Optional[str] = Field(None, max_length=200, description="文本标题（可选）")
    practice_type: Optional[str] = Field(default="translation", description="练习类型：translation(回译), essay(作文)")
    topic: Optional[str] = Field(default=None, max_length=500, description="作文原始题目（仅作文类型使用）")

class TextAnalysisResponse(BaseModel):
    """AI文本分析响应"""
    text_id: str = Field(..., description="文本唯一标识")
    translation: str = Field(..., description="中文翻译")
    difficult_words: List[Dict[str, str]] = Field(..., description="难词列表，包含word和meaning")
    difficulty: int = Field(..., ge=1, le=5, description="难度等级(1-5)")
    key_points: List[str] = Field(..., description="关键词汇或短语")
    word_count: int = Field(..., description="单词数量")

class PracticeSubmitRequest(BaseModel):
    """练习提交请求"""
    text_id: str = Field(..., description="文本ID")
    user_input: str = Field(..., min_length=1, description="用户输入的英文")

class PracticeEvaluationResponse(BaseModel):
    """练习评估响应"""
    score: int = Field(..., ge=0, le=100, description="得分(0-100)")
    corrections: List[Dict[str, str]] = Field(..., description="纠错建议")
    overall_feedback: str = Field(..., description="整体评价")
    is_acceptable: bool = Field(..., description="是否可接受（语法和语义基本正确）")

class PracticeHistoryRecord(BaseModel):
    """练习历史记录"""
    id: str = Field(..., description="记录ID")
    timestamp: str = Field(..., description="练习时间")
    text_title: str = Field(..., description="文章标题")
    text_content: str = Field(..., description="英文原文")
    chinese_translation: str = Field(..., description="中文翻译")
    user_input: str = Field(..., description="用户输入")
    ai_evaluation: Dict[str, Any] = Field(..., description="AI评价")
    score: int = Field(..., ge=0, le=100, description="得分")
    practice_type: Optional[str] = Field(default="translation", description="练习类型：translation(回译), essay(作文)")
    topic: Optional[str] = Field(default=None, description="作文原始题目（仅作文类型使用）")

class PracticeHistoryExport(BaseModel):
    """练习历史导出格式"""
    export_version: str = Field(default="1.0", description="导出格式版本")
    export_time: str = Field(..., description="导出时间")
    total_records: int = Field(..., description="记录总数")
    records: List[PracticeHistoryRecord] = Field(..., description="练习记录列表")

class PracticeHistoryImportRequest(BaseModel):
    """练习历史导入请求"""
    data: PracticeHistoryExport = Field(..., description="导入数据")

class APIResponse(BaseModel):
    """统一API响应格式"""
    success: bool = Field(..., description="请求是否成功")
    data: Optional[Any] = Field(None, description="响应数据")
    message: str = Field("", description="响应消息")
    error: Optional[str] = Field(None, description="错误信息")
