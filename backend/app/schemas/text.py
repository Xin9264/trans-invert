"""文本相关的数据模型"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class TextUploadRequest(BaseModel):
    """文本上传请求"""
    content: str = Field(..., min_length=10, max_length=10000, description="英文文本内容")
    title: Optional[str] = Field(None, max_length=200, description="文本标题（可选）")

class TextAnalysisResponse(BaseModel):
    """AI文本分析响应"""
    text_id: str = Field(..., description="文本唯一标识")
    translation: str = Field(..., description="中文翻译")
    grammar_points: List[str] = Field(..., description="语法要点")
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

class APIResponse(BaseModel):
    """统一API响应格式"""
    success: bool = Field(..., description="请求是否成功")
    data: Optional[Any] = Field(None, description="响应数据")
    message: str = Field("", description="响应消息")
    error: Optional[str] = Field(None, description="错误信息")
