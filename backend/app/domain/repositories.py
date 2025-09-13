"""Repository interfaces for domain entities"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from .entities import (
    TextMaterial, TextAnalysis, PracticeRecord,
    Folder, ReviewStats
)
from .value_objects import TextId, PracticeId, FolderId


class TextMaterialRepository(ABC):
    """Repository interface for text materials"""

    @abstractmethod
    async def save(self, text_material: TextMaterial) -> None:
        """Save a text material"""
        pass

    @abstractmethod
    async def find_by_id(self, text_id: TextId) -> Optional[TextMaterial]:
        """Find text material by ID"""
        pass

    @abstractmethod
    async def find_all(self, folder_id: Optional[FolderId] = None) -> List[TextMaterial]:
        """Find all text materials, optionally filtered by folder"""
        pass

    @abstractmethod
    async def delete(self, text_id: TextId) -> bool:
        """Delete a text material"""
        pass

    @abstractmethod
    async def exists(self, text_id: TextId) -> bool:
        """Check if text material exists"""
        pass


class TextAnalysisRepository(ABC):
    """Repository interface for text analyses"""

    @abstractmethod
    async def save(self, analysis: TextAnalysis) -> None:
        """Save a text analysis"""
        pass

    @abstractmethod
    async def find_by_text_id(self, text_id: TextId) -> Optional[TextAnalysis]:
        """Find analysis by text ID"""
        pass

    @abstractmethod
    async def exists(self, text_id: TextId) -> bool:
        """Check if analysis exists for text"""
        pass

    @abstractmethod
    async def delete(self, text_id: TextId) -> bool:
        """Delete analysis for text"""
        pass


class PracticeRecordRepository(ABC):
    """Repository interface for practice records"""

    @abstractmethod
    async def save(self, record: PracticeRecord) -> None:
        """Save a practice record"""
        pass

    @abstractmethod
    async def find_by_id(self, record_id: PracticeId) -> Optional[PracticeRecord]:
        """Find practice record by ID"""
        pass

    @abstractmethod
    async def find_all(self) -> List[PracticeRecord]:
        """Find all practice records"""
        pass

    @abstractmethod
    async def find_by_text_content(self, text_content: str) -> List[PracticeRecord]:
        """Find practice records by text content"""
        pass

    @abstractmethod
    async def count_total(self) -> int:
        """Count total practice records"""
        pass

    @abstractmethod
    async def find_needing_review(self) -> List[PracticeRecord]:
        """Find records that need review"""
        pass


class FolderRepository(ABC):
    """Repository interface for folders"""

    @abstractmethod
    async def save(self, folder: Folder) -> None:
        """Save a folder"""
        pass

    @abstractmethod
    async def find_by_id(self, folder_id: FolderId) -> Optional[Folder]:
        """Find folder by ID"""
        pass

    @abstractmethod
    async def find_all(self) -> List[Folder]:
        """Find all folders"""
        pass

    @abstractmethod
    async def delete(self, folder_id: FolderId) -> bool:
        """Delete a folder"""
        pass

    @abstractmethod
    async def exists(self, folder_id: FolderId) -> bool:
        """Check if folder exists"""
        pass


class ReviewStatsRepository(ABC):
    """Repository interface for review statistics"""

    @abstractmethod
    async def calculate_stats(self, records: List[PracticeRecord]) -> ReviewStats:
        """Calculate review statistics from practice records"""
        pass