"""Domain entities for the Trans Invert application"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from .value_objects import (
    TextId, TextContent, Translation, DifficultyLevel, DifficultWord,
    PracticeId, Score, Correction, Timestamp, FolderId, PracticeType
)


@dataclass
class TextMaterial:
    """Entity representing an English text material for practice"""
    id: TextId
    title: str
    content: TextContent
    created_at: Timestamp
    practice_type: PracticeType = PracticeType.TRANSLATION
    topic: Optional[str] = None
    folder_id: Optional[FolderId] = None
    last_opened: Optional[Timestamp] = None

    def __post_init__(self):
        if not self.title or len(self.title.strip()) == 0:
            raise ValueError("Title cannot be empty")
        if len(self.title) > 200:
            raise ValueError("Title cannot exceed 200 characters")

    def update_last_opened(self) -> None:
        """Update the last opened timestamp"""
        self.last_opened = Timestamp.now()

    def move_to_folder(self, folder_id: Optional[FolderId]) -> None:
        """Move text material to a folder"""
        self.folder_id = folder_id

    @property
    def word_count(self) -> int:
        return self.content.word_count


@dataclass
class TextAnalysis:
    """Entity representing AI analysis of a text material"""
    text_id: TextId
    translation: Translation
    difficult_words: List[DifficultWord]
    difficulty: DifficultyLevel
    key_points: List[str]
    analyzed_at: Timestamp

    def __post_init__(self):
        if not self.difficult_words:
            self.difficult_words = []
        if not self.key_points:
            self.key_points = []


@dataclass
class PracticeSession:
    """Entity representing a single practice session"""
    id: PracticeId
    text_id: TextId
    user_input: str
    submitted_at: Timestamp
    evaluation: Optional['PracticeEvaluation'] = None

    def __post_init__(self):
        if not self.user_input or len(self.user_input.strip()) == 0:
            raise ValueError("User input cannot be empty")

    def set_evaluation(self, evaluation: 'PracticeEvaluation') -> None:
        """Set the evaluation for this practice session"""
        self.evaluation = evaluation

    def complete_evaluation(self, evaluation: 'PracticeEvaluation') -> None:
        """Complete the evaluation for this practice session"""
        self.evaluation = evaluation

    @property
    def is_evaluated(self) -> bool:
        return self.evaluation is not None

    @property
    def score(self) -> Optional[Score]:
        return self.evaluation.score if self.evaluation else None


@dataclass
class PracticeEvaluation:
    """Entity representing AI evaluation of a practice session"""
    score: Score
    corrections: List[Correction]
    overall_feedback: str
    is_acceptable: bool
    evaluated_at: Timestamp

    def __post_init__(self):
        if not self.overall_feedback:
            raise ValueError("Overall feedback cannot be empty")
        if not self.corrections:
            self.corrections = []


@dataclass
class PracticeRecord:
    """Aggregate root for practice history record"""
    id: PracticeId
    session: PracticeSession
    text_title: str
    text_content: TextContent
    chinese_translation: Translation
    review_count: int = 0
    last_reviewed: Optional[Timestamp] = None
    error_patterns: List[str] = field(default_factory=list)

    def mark_reviewed(self) -> None:
        """Mark this record as reviewed"""
        self.review_count += 1
        self.last_reviewed = Timestamp.now()

    def add_error_pattern(self, pattern: str) -> None:
        """Add an error pattern for this record"""
        if pattern not in self.error_patterns:
            self.error_patterns.append(pattern)

    @property
    def needs_review(self) -> bool:
        """Check if this record needs review based on score and review count"""
        if not self.session.evaluation:
            return False
        return self.session.evaluation.score.value < 80 and self.review_count < 3


@dataclass
class Folder:
    """Entity representing a content organization folder"""
    id: FolderId
    name: str
    description: Optional[str]
    created_at: Timestamp
    parent_id: Optional[FolderId] = None

    def __post_init__(self):
        if not self.name or len(self.name.strip()) == 0:
            raise ValueError("Folder name cannot be empty")
        if len(self.name) > 100:
            raise ValueError("Folder name cannot exceed 100 characters")

    def update_name(self, new_name: str) -> None:
        """Update folder name"""
        if not new_name or len(new_name.strip()) == 0:
            raise ValueError("Folder name cannot be empty")
        if len(new_name) > 100:
            raise ValueError("Folder name cannot exceed 100 characters")
        self.name = new_name

    def update_info(self, new_name: str, new_description: Optional[str] = None) -> None:
        """Update folder information"""
        self.update_name(new_name)
        if new_description is not None:
            self.description = new_description


@dataclass
class ReviewStats:
    """Entity representing review statistics"""
    total_practiced: int
    need_review: int
    mastered: int
    focus_areas: List[str]
    recent_errors: List[Dict[str, Any]]
    calculated_at: Timestamp

    def __post_init__(self):
        if self.total_practiced < 0:
            raise ValueError("Total practiced cannot be negative")
        if self.need_review < 0:
            raise ValueError("Need review cannot be negative")
        if self.mastered < 0:
            raise ValueError("Mastered cannot be negative")