"""文本相关的数据模型"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class TextUploadRequest(BaseModel):
    """文本上传请求"""
    content: str = Field(..., min_length=10, max_length=10000, description="英文文本内容")
    title: Optional[str] = Field(None, max_length=200, description="文本标题（可选）")
    practice_type: Optional[str] = Field(default="translation", description="练习类型")
    topic: Optional[str] = Field(None, description="主题")
    folder_id: Optional[str] = Field(None, description="文件夹ID")

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
    # 复习相关字段
    review_count: int = Field(default=0, description="复习次数")
    last_reviewed: Optional[str] = Field(default=None, description="最后复习时间")
    error_patterns: List[str] = Field(default_factory=list, description="错误模式标记")

class PracticeHistoryExport(BaseModel):
    """练习历史导出格式"""
    export_version: str = Field(default="1.0", description="导出格式版本")
    export_time: str = Field(..., description="导出时间")
    total_records: int = Field(..., description="记录总数")
    records: List[PracticeHistoryRecord] = Field(..., description="练习记录列表")

class PracticeHistoryImportRequest(BaseModel):
    """练习历史导入请求"""
    data: PracticeHistoryExport = Field(..., description="导入数据")

class ReviewGenerateResponse(BaseModel):
    """复习材料生成响应"""
    text_id: str = Field(..., description="生成的复习材料ID")
    review_article: str = Field(..., description="复习文章内容")
    analysis_summary: Dict[str, Any] = Field(..., description="用户错误分析总结")

class ReviewStatsResponse(BaseModel):
    """复习统计响应"""
    total_practiced: int = Field(..., description="已练习材料总数")
    need_review: int = Field(..., description="需要复习的材料数量")
    mastered: int = Field(..., description="已掌握的材料数量")
    focus_areas: List[str] = Field(..., description="重点复习领域")
    recent_errors: List[Dict[str, Any]] = Field(..., description="近期错误摘要")

class GenerateMaterialRequest(BaseModel):
    """个性化练习材料生成请求"""
    topic: Optional[str] = Field(None, description="期望主题")
    genre: Optional[str] = Field(None, description="期望体裁")
    word_count: int = Field(default=150, ge=50, le=500, description="目标词数")
    difficulty: int = Field(default=3, ge=1, le=5, description="目标难度(1-5)")
    folder_id: Optional[str] = Field(None, description="生成材料保存到的文件夹ID")

class GeneratedMaterial(BaseModel):
    """AI生成的练习材料元数据"""
    title: str = Field(..., description="英文标题")
    content: str = Field(..., min_length=10, description="英文正文")
    topic: str = Field(..., description="实际话题")
    estimated_difficulty: int = Field(..., ge=1, le=5, description="估计难度")
    word_count: int = Field(..., ge=1, description="实际词数")
    targeted_weaknesses: List[str] = Field(..., description="针对的弱点")
    design_rationale: str = Field(..., description="设计理由")

class APIResponse(BaseModel):
    """统一API响应格式"""
    success: bool = Field(..., description="请求是否成功")
    data: Optional[Any] = Field(None, description="响应数据")
    message: str = Field("", description="响应消息")
    error: Optional[str] = Field(None, description="错误信息")
