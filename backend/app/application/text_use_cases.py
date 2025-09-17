"""Use cases for text management bounded context"""
import uuid
from typing import List, Optional, Dict, Any, AsyncGenerator
from datetime import datetime

from ..domain.entities import TextMaterial, TextAnalysis
from ..domain.value_objects import (
    TextId, TextContent, Translation, DifficultyLevel,
    DifficultWord, Timestamp, FolderId, PracticeType
)
from ..domain.repositories import TextMaterialRepository, TextAnalysisRepository
from .dtos import (
    TextUploadCommand, TextAnalysisQuery, MoveTextCommand,
    TextMaterialDto, TextAnalysisDto
)
from .interfaces import AIServiceInterface


class UploadTextUseCase:
    """Use case for uploading text materials"""

    def __init__(
        self,
        text_repository: TextMaterialRepository,
        ai_service: AIServiceInterface
    ):
        self.text_repository = text_repository
        self.ai_service = ai_service

    async def execute(self, command: TextUploadCommand) -> str:
        """Upload text material and trigger AI analysis"""
        # Generate unique ID
        text_id = TextId(str(uuid.uuid4()))

        # Create text content value object
        content = TextContent(command.content)

        # Determine practice type
        practice_type = PracticeType(command.practice_type) if command.practice_type else PracticeType.TRANSLATION

        # Create folder ID if provided
        folder_id = FolderId(command.folder_id) if command.folder_id else None

        # Create text material entity
        text_material = TextMaterial(
            id=text_id,
            title=command.title or f"文本_{text_id.value[:8]}",
            content=content,
            created_at=Timestamp.now(),
            practice_type=practice_type,
            topic=command.topic,
            folder_id=folder_id
        )

        # Save text material
        await self.text_repository.save(text_material)

        # Trigger AI analysis in background
        await self.ai_service.analyze_text_async(text_id.value, command.content)

        return text_id.value


class UploadTextStreamUseCase:
    """Use case for uploading text materials with streaming AI analysis"""

    def __init__(
        self,
        text_repository: TextMaterialRepository,
        ai_service: AIServiceInterface,
    ):
        self.text_repository = text_repository
        self.ai_service = ai_service

    async def execute(self, command: TextUploadCommand) -> AsyncGenerator[dict, None]:
        """Upload text material and stream AI analysis progress"""

        text_id = TextId(str(uuid.uuid4()))
        content = TextContent(command.content)
        practice_type = (
            PracticeType(command.practice_type)
            if command.practice_type
            else PracticeType.TRANSLATION
        )
        folder_id = FolderId(command.folder_id) if command.folder_id else None

        text_material = TextMaterial(
            id=text_id,
            title=command.title or f"文本_{text_id.value[:8]}",
            content=content,
            created_at=Timestamp.now(),
            practice_type=practice_type,
            topic=command.topic,
            folder_id=folder_id,
        )

        await self.text_repository.save(text_material)

        initial_chunk = {
            "type": "init",
            "text_id": text_id.value,
            "title": text_material.title,
            "progress": 5,
            "message": "文本已保存，正在召唤AI分析…",
            "word_count": text_material.word_count,
        }
        yield initial_chunk

        async for chunk in self.ai_service.analyze_text_stream(
            text_id.value, command.content
        ):
            chunk.setdefault("text_id", text_id.value)
            if chunk.get("type") == "complete" and "analysis" in chunk:
                chunk["analysis"]["word_count"] = text_material.word_count
            yield chunk

class GetTextAnalysisUseCase:
    """Use case for getting text analysis"""

    def __init__(
        self,
        text_repository: TextMaterialRepository,
        analysis_repository: TextAnalysisRepository
    ):
        self.text_repository = text_repository
        self.analysis_repository = analysis_repository

    async def execute(self, query: TextAnalysisQuery) -> Optional[TextAnalysisDto]:
        """Get text analysis by text ID"""
        text_id = TextId(query.text_id)

        # Check if text exists
        text_material = await self.text_repository.find_by_id(text_id)
        if not text_material:
            raise ValueError("Text not found")

        # Update last opened timestamp
        text_material.update_last_opened()
        await self.text_repository.save(text_material)

        # Get analysis
        analysis = await self.analysis_repository.find_by_text_id(text_id)
        if not analysis:
            return None

        # Convert to DTO
        return TextAnalysisDto(
            text_id=analysis.text_id.value,
            translation=analysis.translation.content,
            difficult_words=[
                {"word": dw.word, "meaning": dw.meaning}
                for dw in analysis.difficult_words
            ],
            difficulty=analysis.difficulty.level,
            key_points=analysis.key_points,
            word_count=text_material.word_count
        )


class ListTextMaterialsUseCase:
    """Use case for listing text materials"""

    def __init__(
        self,
        text_repository: TextMaterialRepository,
        analysis_repository: TextAnalysisRepository
    ):
        self.text_repository = text_repository
        self.analysis_repository = analysis_repository

    async def execute(self, folder_id: Optional[str] = None) -> List[TextMaterialDto]:
        """List all text materials, optionally filtered by folder"""
        folder_filter = FolderId(folder_id) if folder_id else None
        text_materials = await self.text_repository.find_all(folder_filter)

        result = []
        for text_material in text_materials:
            # Check if analysis exists
            has_analysis = await self.analysis_repository.exists(text_material.id)
            analysis = await self.analysis_repository.find_by_text_id(text_material.id) if has_analysis else None

            dto = TextMaterialDto(
                text_id=text_material.id.value,
                title=text_material.title,
                word_count=text_material.word_count,
                has_analysis=has_analysis,
                difficulty=analysis.difficulty.level if analysis else 0,
                last_opened=text_material.last_opened.to_iso_string() if text_material.last_opened else None,
                created_at=text_material.created_at.to_iso_string(),
                practice_type=text_material.practice_type.value,
                topic=text_material.topic,
                folder_id=text_material.folder_id.value if text_material.folder_id else None
            )
            result.append(dto)

        # Sort by creation time (newest first)
        result.sort(key=lambda x: x.created_at, reverse=True)
        return result


class MoveTextToFolderUseCase:
    """Use case for moving text to folder"""

    def __init__(self, text_repository: TextMaterialRepository):
        self.text_repository = text_repository

    async def execute(self, command: MoveTextCommand) -> None:
        """Move text material to specified folder"""
        text_id = TextId(command.text_id)

        # Get text material
        text_material = await self.text_repository.find_by_id(text_id)
        if not text_material:
            raise ValueError("Text material not found")

        # Move to folder
        folder_id = FolderId(command.folder_id) if command.folder_id else None
        text_material.move_to_folder(folder_id)

        # Save changes
        await self.text_repository.save(text_material)


class DeleteTextMaterialUseCase:
    """Use case for deleting text material"""

    def __init__(
        self,
        text_repository: TextMaterialRepository,
        analysis_repository: TextAnalysisRepository
    ):
        self.text_repository = text_repository
        self.analysis_repository = analysis_repository

    async def execute(self, text_id: str) -> str:
        """Delete text material and its analysis"""
        text_id_obj = TextId(text_id)

        # Get text material for title
        text_material = await self.text_repository.find_by_id(text_id_obj)
        if not text_material:
            raise ValueError("Text material not found")

        title = text_material.title

        # Delete analysis if exists
        await self.analysis_repository.delete(text_id_obj)

        # Delete text material
        await self.text_repository.delete(text_id_obj)

        return title


class GetTextContentUseCase:
    """Use case for getting text content"""

    def __init__(self, text_repository: TextMaterialRepository):
        self.text_repository = text_repository

    async def execute(self, text_id: str, include_content: bool = False) -> Optional[Dict[str, Any]]:
        """Get text information, optionally including content"""
        text_id_obj = TextId(text_id)

        text_material = await self.text_repository.find_by_id(text_id_obj)
        if not text_material:
            return None

        result = {
            "text_id": text_id,
            "title": text_material.title,
            "word_count": text_material.word_count
        }

        if include_content:
            result["content"] = text_material.content.content

        return result