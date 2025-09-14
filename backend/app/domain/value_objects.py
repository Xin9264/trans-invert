"""Value objects for the domain layer"""
from dataclasses import dataclass
from typing import List, Dict, Any
from datetime import datetime
from enum import Enum


@dataclass(frozen=True)
class TextId:
    """Value object for text identifier"""
    value: str

    def __post_init__(self):
        if not self.value or not isinstance(self.value, str):
            raise ValueError("TextId must be a non-empty string")


@dataclass(frozen=True)
class PracticeId:
    """Value object for practice session identifier"""
    value: str

    def __post_init__(self):
        if not self.value or not isinstance(self.value, str):
            raise ValueError("PracticeId must be a non-empty string")


@dataclass(frozen=True)
class FolderId:
    """Value object for folder identifier"""
    value: str

    def __post_init__(self):
        if not self.value or not isinstance(self.value, str):
            raise ValueError("FolderId must be a non-empty string")


@dataclass(frozen=True)
class TextContent:
    """Value object for text content"""
    content: str

    def __post_init__(self):
        if not self.content or len(self.content.strip()) < 10:
            raise ValueError("Text content must be at least 10 characters")
        if len(self.content) > 10000:
            raise ValueError("Text content cannot exceed 10000 characters")

    @property
    def word_count(self) -> int:
        return len(self.content.strip().split())


@dataclass(frozen=True)
class Translation:
    """Value object for Chinese translation"""
    content: str

    def __post_init__(self):
        if not self.content or not isinstance(self.content, str):
            raise ValueError("Translation must be a non-empty string")


@dataclass(frozen=True)
class DifficultyLevel:
    """Value object for difficulty level"""
    level: int

    def __post_init__(self):
        if not isinstance(self.level, int) or not (1 <= self.level <= 5):
            raise ValueError("Difficulty level must be an integer between 1 and 5")


@dataclass(frozen=True)
class Score:
    """Value object for practice score"""
    value: int

    def __post_init__(self):
        if not isinstance(self.value, int) or not (0 <= self.value <= 100):
            raise ValueError("Score must be an integer between 0 and 100")


@dataclass(frozen=True)
class DifficultWord:
    """Value object for difficult word with meaning"""
    word: str
    meaning: str

    def __post_init__(self):
        if not self.word or not self.meaning:
            raise ValueError("Both word and meaning must be non-empty strings")


@dataclass(frozen=True)
class Correction:
    """Value object for practice correction"""
    original: str
    corrected: str
    explanation: str

    def __post_init__(self):
        if not all([self.original, self.corrected, self.explanation]):
            raise ValueError("All correction fields must be non-empty strings")


class PracticeType(Enum):
    """Enumeration for practice types"""
    TRANSLATION = "translation"
    WRITING = "writing"
    COMPREHENSION = "comprehension"


class AIProvider(Enum):
    """Enumeration for AI providers"""
    DEEPSEEK = "deepseek"
    OPENAI = "openai"
    VOLCANO = "volcano"


@dataclass(frozen=True)
class AIConfiguration:
    """Value object for AI provider configuration"""
    provider: AIProvider
    api_key: str
    base_url: str
    model: str

    def __post_init__(self):
        if not self.api_key:
            raise ValueError("API key cannot be empty")
        if not self.base_url:
            raise ValueError("Base URL cannot be empty")
        if not self.model:
            raise ValueError("Model cannot be empty")


@dataclass(frozen=True)
class Timestamp:
    """Value object for timestamps"""
    value: datetime

    def to_iso_string(self) -> str:
        return self.value.isoformat()

    @classmethod
    def now(cls) -> 'Timestamp':
        return cls(datetime.now())

    @classmethod
    def from_iso_string(cls, iso_string: str) -> 'Timestamp':
        return cls(datetime.fromisoformat(iso_string))