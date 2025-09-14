"""File-based repository implementations"""
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from ..domain.entities import (
    TextMaterial, TextAnalysis, PracticeRecord, Folder, ReviewStats
)
from ..domain.value_objects import (
    TextId, PracticeId, FolderId, TextContent, Translation,
    DifficultyLevel, DifficultWord, Score, Correction, Timestamp, PracticeType
)
from ..domain.repositories import (
    TextMaterialRepository, TextAnalysisRepository,
    PracticeRecordRepository, FolderRepository, ReviewStatsRepository
)
from ..domain.services import ReviewAnalysisService


class FileTextMaterialRepository(TextMaterialRepository):
    """File-based implementation of TextMaterialRepository"""

    def __init__(self, data_store: Dict[str, Any]):
        self.data_store = data_store

    async def save(self, text_material: TextMaterial) -> None:
        """Save text material to file store"""
        self.data_store[text_material.id.value] = {
            "id": text_material.id.value,
            "title": text_material.title,
            "content": text_material.content.content,
            "word_count": text_material.word_count,
            "created_at": text_material.created_at.to_iso_string(),
            "practice_type": text_material.practice_type.value,
            "topic": text_material.topic,
            "folder_id": text_material.folder_id.value if text_material.folder_id else None,
            "last_opened": text_material.last_opened.to_iso_string() if text_material.last_opened else None
        }

    async def find_by_id(self, text_id: TextId) -> Optional[TextMaterial]:
        """Find text material by ID"""
        data = self.data_store.get(text_id.value)
        if not data:
            return None

        return self._data_to_entity(data)

    async def find_all(self, folder_id: Optional[FolderId] = None) -> List[TextMaterial]:
        """Find all text materials, optionally filtered by folder"""
        materials = []
        for data in self.data_store.values():
            if folder_id is not None:
                if data.get("folder_id") != (folder_id.value if folder_id else None):
                    continue
            materials.append(self._data_to_entity(data))
        return materials

    async def delete(self, text_id: TextId) -> bool:
        """Delete text material"""
        if text_id.value in self.data_store:
            del self.data_store[text_id.value]
            return True
        return False

    async def exists(self, text_id: TextId) -> bool:
        """Check if text material exists"""
        return text_id.value in self.data_store

    def _data_to_entity(self, data: Dict[str, Any]) -> TextMaterial:
        """Convert data dictionary to TextMaterial entity"""
        return TextMaterial(
            id=TextId(data["id"]),
            title=data["title"],
            content=TextContent(data["content"]),
            created_at=Timestamp.from_iso_string(data["created_at"]),
            practice_type=PracticeType(data.get("practice_type", "translation")),
            topic=data.get("topic"),
            folder_id=FolderId(data["folder_id"]) if data.get("folder_id") else None,
            last_opened=Timestamp.from_iso_string(data["last_opened"]) if data.get("last_opened") else None
        )


class FileTextAnalysisRepository(TextAnalysisRepository):
    """File-based implementation of TextAnalysisRepository"""

    def __init__(self, data_store: Dict[str, Any]):
        self.data_store = data_store

    async def save(self, analysis: TextAnalysis) -> None:
        """Save text analysis to file store"""
        self.data_store[analysis.text_id.value] = {
            "text_id": analysis.text_id.value,
            "translation": analysis.translation.content,
            "difficult_words": [
                {"word": dw.word, "meaning": dw.meaning}
                for dw in analysis.difficult_words
            ],
            "difficulty": analysis.difficulty.level,
            "key_points": analysis.key_points,
            "word_count": len(analysis.translation.content.split()),  # Approximate
            "analyzed_at": analysis.analyzed_at.to_iso_string()
        }

    async def find_by_text_id(self, text_id: TextId) -> Optional[TextAnalysis]:
        """Find analysis by text ID"""
        data = self.data_store.get(text_id.value)
        if not data:
            return None

        return self._data_to_entity(data)

    async def exists(self, text_id: TextId) -> bool:
        """Check if analysis exists for text"""
        return text_id.value in self.data_store

    async def delete(self, text_id: TextId) -> bool:
        """Delete analysis for text"""
        if text_id.value in self.data_store:
            del self.data_store[text_id.value]
            return True
        return False

    async def find_all(self) -> List[TextAnalysis]:
        """Find all text analyses"""
        return [self._data_to_entity(data) for data in self.data_store.values()]

    def _data_to_entity(self, data: Dict[str, Any]) -> TextAnalysis:
        """Convert data dictionary to TextAnalysis entity"""
        return TextAnalysis(
            text_id=TextId(data["text_id"]),
            translation=Translation(data["translation"]),
            difficult_words=[
                DifficultWord(word=dw["word"], meaning=dw["meaning"])
                for dw in data.get("difficult_words", [])
            ],
            difficulty=DifficultyLevel(data["difficulty"]),
            key_points=data.get("key_points", []),
            analyzed_at=Timestamp.from_iso_string(data.get("analyzed_at", datetime.now().isoformat()))
        )


class FilePracticeRecordRepository(PracticeRecordRepository):
    """File-based implementation of PracticeRecordRepository"""

    def __init__(self, data_store: List[Dict[str, Any]]):
        self.data_store = data_store

    async def save(self, record: PracticeRecord) -> None:
        """Save practice record to file store"""
        record_data = {
            "id": record.id.value,
            "timestamp": record.session.submitted_at.to_iso_string(),
            "text_title": record.text_title,
            "text_content": record.text_content.content,
            "chinese_translation": record.chinese_translation.content,
            "user_input": record.session.user_input,
            "ai_evaluation": {
                "score": record.session.evaluation.score.value,
                "corrections": [
                    {
                        "original": c.original,
                        "corrected": c.corrected,
                        "explanation": c.explanation
                    }
                    for c in record.session.evaluation.corrections
                ],
                "overall_feedback": record.session.evaluation.overall_feedback,
                "is_acceptable": record.session.evaluation.is_acceptable
            } if record.session.evaluation else {},
            "score": record.session.evaluation.score.value if record.session.evaluation else 0,
            "review_count": record.review_count,
            "last_reviewed": record.last_reviewed.to_iso_string() if record.last_reviewed else None,
            "error_patterns": record.error_patterns
        }

        # Remove existing record with same ID if exists
        self.data_store[:] = [r for r in self.data_store if r.get("id") != record.id.value]

        # Add new record
        self.data_store.append(record_data)

        # Sort by timestamp (newest first)
        self.data_store.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    async def find_by_id(self, record_id: PracticeId) -> Optional[PracticeRecord]:
        """Find practice record by ID"""
        for data in self.data_store:
            if data.get("id") == record_id.value:
                return self._data_to_entity(data)
        return None

    async def find_all(self) -> List[PracticeRecord]:
        """Find all practice records"""
        result = []
        for data in self.data_store:
            # Convert to dict if it's a Pydantic model
            if hasattr(data, 'model_dump'):
                data_dict = data.model_dump()
            elif hasattr(data, 'dict'):
                data_dict = data.dict()
            else:
                data_dict = data
            result.append(self._data_to_entity(data_dict))
        return result

    async def find_by_text_content(self, text_content: str) -> List[PracticeRecord]:
        """Find practice records by text content"""
        records = []
        for data in self.data_store:
            if data.get("text_content", "").strip() == text_content.strip():
                records.append(self._data_to_entity(data))
        return records

    async def count_total(self) -> int:
        """Count total practice records"""
        return len(self.data_store)

    async def find_needing_review(self) -> List[PracticeRecord]:
        """Find records that need review"""
        records = await self.find_all()
        return [record for record in records if record.needs_review]

    def _data_to_entity(self, data: Dict[str, Any]) -> PracticeRecord:
        """Convert data dictionary to PracticeRecord entity"""
        from ..domain.entities import PracticeSession, PracticeEvaluation

        # Create evaluation if exists
        evaluation = None
        if data.get("ai_evaluation"):
            eval_data = data["ai_evaluation"]
            corrections = []

            # Handle corrections if they exist
            for c in eval_data.get("corrections", []):
                # Only create correction if we have valid data
                original = c.get("original", "")
                suggestion = c.get("suggestion", c.get("corrected", ""))
                explanation = c.get("reason", c.get("explanation", ""))

                if original and suggestion:
                    corrections.append(Correction(
                        original=original,
                        corrected=suggestion,
                        explanation=explanation if explanation else "No explanation provided"
                    ))

            evaluation = PracticeEvaluation(
                score=Score(eval_data.get("score", 0)),
                corrections=corrections,
                overall_feedback=eval_data.get("overall_feedback", ""),
                is_acceptable=eval_data.get("is_acceptable", True),
                evaluated_at=Timestamp.from_iso_string(data.get("timestamp", datetime.now().isoformat()))
            )

        # Create session
        session = PracticeSession(
            id=PracticeId(data["id"]),
            text_id=TextId(str(uuid.uuid4())),  # Temporary, not used in this context
            user_input=data["user_input"],
            submitted_at=Timestamp.from_iso_string(data["timestamp"]),
            evaluation=evaluation
        )

        # Create record
        record = PracticeRecord(
            id=PracticeId(data["id"]),
            session=session,
            text_title=data["text_title"],
            text_content=TextContent(data["text_content"]),
            chinese_translation=Translation(data["chinese_translation"]),
            review_count=data.get("review_count", 0),
            last_reviewed=Timestamp.from_iso_string(data["last_reviewed"]) if data.get("last_reviewed") else None,
            error_patterns=data.get("error_patterns", [])
        )

        return record


class FileFolderRepository(FolderRepository):
    """File-based implementation of FolderRepository"""

    def __init__(self, data_store: Dict[str, Any]):
        self.data_store = data_store

    async def save(self, folder: Folder) -> None:
        """Save folder to file store"""
        self.data_store[folder.id.value] = {
            "id": folder.id.value,
            "name": folder.name,
            "description": folder.description,
            "created_at": folder.created_at.to_iso_string(),
            "parent_id": folder.parent_id.value if folder.parent_id else None
        }

    async def find_by_id(self, folder_id: FolderId) -> Optional[Folder]:
        """Find folder by ID"""
        data = self.data_store.get(folder_id.value)
        if not data:
            return None

        return self._data_to_entity(data)

    async def find_all(self) -> List[Folder]:
        """Find all folders"""
        return [self._data_to_entity(data) for data in self.data_store.values()]

    async def delete(self, folder_id: FolderId) -> bool:
        """Delete folder"""
        if folder_id.value in self.data_store:
            del self.data_store[folder_id.value]
            return True
        return False

    async def exists(self, folder_id: FolderId) -> bool:
        """Check if folder exists"""
        return folder_id.value in self.data_store

    def _data_to_entity(self, data: Dict[str, Any]) -> Folder:
        """Convert data dictionary to Folder entity"""
        return Folder(
            id=FolderId(data["id"]),
            name=data["name"],
            description=data.get("description"),
            created_at=Timestamp.from_iso_string(data["created_at"]),
            parent_id=FolderId(data["parent_id"]) if data.get("parent_id") else None
        )


class FileReviewStatsRepository(ReviewStatsRepository):
    """File-based implementation of ReviewStatsRepository"""

    def __init__(self, review_analysis_service: ReviewAnalysisService):
        self.review_analysis_service = review_analysis_service

    async def calculate_stats(self, records: List[PracticeRecord]) -> ReviewStats:
        """Calculate review statistics from practice records"""
        mastery_levels = self.review_analysis_service.calculate_mastery_level(records)
        focus_areas = self.review_analysis_service.identify_focus_areas(records)
        recent_errors = self.review_analysis_service.get_recent_errors(records)

        return ReviewStats(
            total_practiced=mastery_levels["total_practiced"],
            need_review=mastery_levels["need_review"],
            mastered=mastery_levels["mastered"],
            focus_areas=focus_areas,
            recent_errors=recent_errors,
            calculated_at=Timestamp.now()
        )