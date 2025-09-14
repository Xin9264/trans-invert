"""Data Transfer Objects (DTOs) for the application layer"""
from dataclasses import dataclass
from typing import List, Dict, Any, Optional


@dataclass
class TextUploadCommand:
    """Command for uploading a text material"""
    content: str
    title: Optional[str] = None
    practice_type: str = "translation"
    topic: Optional[str] = None
    folder_id: Optional[str] = None


@dataclass
class TextAnalysisQuery:
    """Query for getting text analysis"""
    text_id: str


@dataclass
class PracticeSubmissionCommand:
    """Command for submitting a practice session"""
    text_id: str
    user_input: str


@dataclass
class MoveTextCommand:
    """Command for moving text to folder"""
    text_id: str
    folder_id: Optional[str]


@dataclass
class CreateFolderCommand:
    """Command for creating a folder"""
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None


@dataclass
class UpdateFolderCommand:
    """Command for updating a folder"""
    folder_id: str
    name: str
    description: Optional[str] = None


@dataclass
class TextMaterialDto:
    """DTO for text material"""
    text_id: str
    title: str
    word_count: int
    has_analysis: bool
    difficulty: int
    last_opened: Optional[str]
    created_at: str
    practice_type: str
    topic: Optional[str]
    folder_id: Optional[str]


@dataclass
class TextAnalysisDto:
    """DTO for text analysis"""
    text_id: str
    translation: str
    difficult_words: List[Dict[str, str]]
    difficulty: int
    key_points: List[str]
    word_count: int


@dataclass
class PracticeEvaluationDto:
    """DTO for practice evaluation"""
    score: int
    corrections: List[Dict[str, str]]
    overall_feedback: str
    is_acceptable: bool


@dataclass
class PracticeRecordDto:
    """DTO for practice record"""
    id: str
    timestamp: str
    text_title: str
    text_content: str
    chinese_translation: str
    user_input: str
    ai_evaluation: Dict[str, Any]
    score: int
    review_count: int = 0
    last_reviewed: Optional[str] = None
    error_patterns: List[str] = None

    def __post_init__(self):
        if self.error_patterns is None:
            self.error_patterns = []


@dataclass
class FolderDto:
    """DTO for folder"""
    id: str
    name: str
    description: Optional[str]
    created_at: str
    parent_id: Optional[str] = None


@dataclass
class ReviewStatsDto:
    """DTO for review statistics"""
    total_practiced: int
    need_review: int
    mastered: int
    focus_areas: List[str]
    recent_errors: List[Dict[str, Any]]


@dataclass
class AIConfigurationDto:
    """DTO for AI configuration"""
    provider: str
    api_key: str
    base_url: str
    model: str