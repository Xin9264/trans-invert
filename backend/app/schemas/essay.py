"""作文练习相关的数据模型"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class EssayGenerationRequest(BaseModel):
    """作文生成请求"""
    topic: str  # 作文题目
    exam_type: str  # 考试类型：ielts, toefl, cet4, cet6, gre
    requirements: Optional[str] = None  # 额外要求

class EssayGenerationResponse(BaseModel):
    """作文生成响应"""
    english_essay: str  # 生成的英文作文
    chinese_translation: str  # 对应的中文翻译
    topic: str  # 作文题目
    exam_type: str  # 考试类型
    word_count: int  # 单词数
    estimated_score: Optional[int] = None  # 预估分数

class EssaySession(BaseModel):
    """作文练习会话"""
    id: str  # 会话ID
    topic: str  # 作文题目
    exam_type: str  # 考试类型
    sample_essay: str  # 范文
    chinese_translation: str  # 中文翻译
    created_at: str  # 创建时间
    status: str  # 状态：active, completed

class EssaySubmitRequest(BaseModel):
    """作文提交请求"""
    session_id: str  # 会话ID
    user_essay: str  # 用户写的作文

class EssayEvaluationResponse(BaseModel):
    """作文评估响应"""
    overall_score: int  # 总分（0-100）
    detailed_scores: Dict[str, int]  # 详细分数：grammar, vocabulary, structure, content
    strengths: List[str]  # 优点
    improvements: List[str]  # 改进建议
    specific_corrections: List[Dict[str, str]]  # 具体修改建议
    overall_feedback: str  # 整体评价

class EssayHistoryRecord(BaseModel):
    """作文练习历史记录"""
    id: str  # 记录ID
    session_id: str  # 会话ID
    topic: str  # 作文题目
    exam_type: str  # 考试类型
    sample_essay: str  # 范文
    chinese_translation: str  # 中文翻译
    user_essay: str  # 用户作文
    evaluation: EssayEvaluationResponse  # 评估结果
    timestamp: str  # 提交时间
    overall_score: int  # 总分（便于排序）